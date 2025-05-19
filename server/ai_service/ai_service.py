"""
Main Flask application for the email analysis service.
Handles HTTP endpoints and coordinates the AI analysis workflow.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
import logging
import traceback
import time
import json
import requests
from orchestrator import EmailAnalysisOrchestrator

# Set up logging
logging.basicConfig(level=logging.DEBUG,
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Configure CORS
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5000", "http://localhost:3000", "http://127.0.0.1:5000", "http://127.0.0.1:3000", "http://host.docker.internal:5000", "http://host.docker.internal:3000"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

# OpenRouter configuration
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL_NAME = os.getenv("MODEL_NAME", "thudm/glm-z1-32b:free")

# Ensure the OpenRouter API key is loaded correctly
if not OPENROUTER_API_KEY:
    logger.error("OPENROUTER_API_KEY is missing. Please check your .env file.")
    raise ValueError("Missing OpenRouter API key. Please set the OPENROUTER_API_KEY environment variable.")

if not OPENROUTER_API_KEY.startswith("sk-or-v1-"):
    logger.error(f"Invalid OpenRouter API key format: {OPENROUTER_API_KEY[:8]}...")
    raise ValueError("Invalid OpenRouter API key format. API key should start with 'sk-or-v1-'")

logger.info(f"API key starts with: {OPENROUTER_API_KEY[:10]}...")

def make_openrouter_request(messages, max_tokens=1000, temperature=0.7, stream=False):
    """Make a request to OpenRouter API."""
    try:
        # If messages is already a complete payload, use it directly
        if isinstance(messages, dict) and "messages" in messages:
            payload = messages
        else:
            # Otherwise construct the payload
            payload = {
                "model": MODEL_NAME,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": stream
            }

        # Format the API key as a proper JWT (Bearer token)
        # OpenRouter expects the API key to be passed as a Bearer token
        auth_token = f"Bearer {OPENROUTER_API_KEY}"

        headers = {
            "Authorization": auth_token,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:5001",
            "X-Title": "Phishing Detector",
            "OpenAI-Organization": "org-123",  # Add organization header
            "OpenAI-Project": "proj-123"  # Add project header
        }

        logger.debug(f"Making request to OpenRouter with payload: {json.dumps(payload, indent=2)}")
        logger.debug(f"Using headers: {json.dumps({k: v for k, v in headers.items() if k != 'Authorization'}, indent=2)}")
        logger.debug(f"Using API key: {OPENROUTER_API_KEY[:10]}...")
        
        response = requests.post(OPENROUTER_API_URL, json=payload, headers=headers)
        
        logger.debug(f"OpenRouter API Response Status: {response.status_code}")
        logger.debug(f"OpenRouter API Response Headers: {response.headers}")
        logger.debug(f"OpenRouter API Response Body: {response.text}")
        
        if response.status_code == 200:
            try:
                response_data = response.json()
                logger.debug(f"Parsed OpenRouter Response: {json.dumps(response_data, indent=2)}")
                
                # Check for rate limit error in successful response
                if "error" in response_data:
                    error_msg = response_data["error"].get("message", "Unknown error")
                    if "Rate limit exceeded" in error_msg:
                        logger.error(f"Rate limit exceeded: {error_msg}")
                        raise ValueError(f"OpenRouter rate limit exceeded. Please try again later or add credits to your account.")
                    else:
                        raise ValueError(f"OpenRouter API error: {error_msg}")
                
                # Validate response structure
                if "choices" not in response_data:
                    logger.error(f"Missing 'choices' in response: {json.dumps(response_data, indent=2)}")
                    raise ValueError("Invalid response format from OpenRouter: missing 'choices'")
                
                if not response_data["choices"]:
                    logger.error("Empty 'choices' array in response")
                    raise ValueError("Invalid response format from OpenRouter: empty 'choices' array")
                
                if "message" not in response_data["choices"][0]:
                    logger.error(f"Missing 'message' in first choice: {json.dumps(response_data['choices'][0], indent=2)}")
                    raise ValueError("Invalid response format from OpenRouter: missing 'message' in first choice")
                
                if "content" not in response_data["choices"][0]["message"]:
                    logger.error(f"Missing 'content' in message: {json.dumps(response_data['choices'][0]['message'], indent=2)}")
                    raise ValueError("Invalid response format from OpenRouter: missing 'content' in message")
                
                # Log the actual content
                content = response_data["choices"][0]["message"]["content"]
                logger.debug(f"AI Model Content: {content}")
                        
                return response_data
            except json.JSONDecodeError as e:
                logger.error(f"JSON Parse Error: {str(e)}")
                logger.error(f"Raw Response: {response.text}")
                raise ValueError(f"Failed to parse OpenRouter API response: {str(e)}")
        elif response.status_code == 429:
            logger.error("Rate limit exceeded")
            raise ValueError("OpenRouter rate limit exceeded. Please try again later or add credits to your account.")
        else:
            logger.error(f"Error from OpenRouter API: {response.text}")
            raise ValueError(f"OpenRouter API request failed with status {response.status_code}: {response.text}")
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error making OpenRouter request: {str(e)}")
        raise ValueError(f"Network error connecting to OpenRouter: {str(e)}")
    except Exception as e:
        logger.error(f"Error making OpenRouter request: {str(e)}")
        logger.error(f"Error traceback: {traceback.format_exc()}")
        raise

# Test OpenRouter connection
try:
    logger.info("Testing OpenRouter connection...")
    test_response = make_openrouter_request([
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Say hello briefly."}
    ], max_tokens=10)
    
    if test_response and "choices" in test_response and len(test_response["choices"]) > 0:
        content = test_response["choices"][0]["message"]["content"]
        logger.info(f"OpenRouter test response: {content}")
        logger.info("OpenRouter connection test successful!")
    else:
        raise ValueError("Invalid response format from OpenRouter")
        
except ValueError as e:
    if "rate limit exceeded" in str(e).lower():
        logger.error("Rate limit exceeded during connection test")
        print("\n⚠️ OpenRouter rate limit exceeded. You have two options:")
        print("1. Wait until your rate limit resets")
        print("2. Add credits to your OpenRouter account to increase your rate limit")
        print("\nFor now, you can still run the service, but it may fail if the rate limit is still exceeded.")
    else:
        logger.error(f"Failed to initialize OpenRouter connection: {str(e)}")
        raise
except Exception as e:
    logger.error(f"Failed to initialize OpenRouter connection: {str(e)}")
    logger.error(f"Error traceback: {traceback.format_exc()}")
    raise

# Initialize AI agents with the new request function
try:
    logger.info("Initializing orchestrator...")
    orchestrator = EmailAnalysisOrchestrator(make_openrouter_request)
    logger.info("Orchestrator initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize AI components: {str(e)}")
    logger.error(f"Error traceback: {traceback.format_exc()}")
    raise

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy", "message": "AI service is running"}), 200

@app.route('/api/ai-analyze', methods=['POST'])
def analyze_email():
    """Main endpoint for email analysis."""
    try:
        logger.info("=== Starting Email Analysis ===")
        logger.info(f"Request data: {json.dumps(request.json, indent=2)}")
        
        # Validate request
        if not request.json:
            logger.error("No JSON data received")
            return jsonify({
                "error": "No JSON data received",
                "questions": "Please provide email data in JSON format",
                "score": None
            }), 400
            
        data = request.json
        email_data = data.get('email', {})
        
        # Validate email data
        if not email_data.get('subject') or not email_data.get('content'):
            logger.error("Missing required email fields")
            return jsonify({
                "error": "Missing required email fields",
                "questions": "Please provide both subject and content",
                "score": None
            }), 400

        conversation = data.get('conversation', [])
        chat_id = data.get('chat_id')
        initial_scan_result = data.get('initialScanResult', {})
        
        # Handle initial analysis or continue conversation
        if not conversation:
            logger.info("=== Starting Initial Analysis ===")
            try:
                logger.debug(f"Email data: {json.dumps(email_data, indent=2)}")
                logger.debug(f"Chat ID: {chat_id}")
                logger.debug(f"Initial scan result: {json.dumps(initial_scan_result, indent=2)}")
                
                result = orchestrator.analyze_email(email_data, chat_id, initial_scan_result)
                
                # Ensure questions text preserves newlines
                if isinstance(result.get('questions'), str):
                    # Replace any literal \n with actual newlines
                    result['questions'] = result['questions'].replace('\\n', '\n')
                    # Ensure double newlines between sections
                    result['questions'] = result['questions'].replace('\n\n\n', '\n\n')
                
                logger.info(f"Analysis result: {json.dumps(result, indent=2)}")
                
                response = jsonify(result)
                response.headers['Content-Type'] = 'application/json; charset=utf-8'
                return response
                
            except Exception as e:
                logger.error(f"Error in initial analysis: {str(e)}")
                logger.error(f"Traceback: {traceback.format_exc()}")
                return jsonify({
                    "error": "Failed to perform initial analysis",
                    "error_details": str(e),
                    "questions": "I'm having trouble analyzing this email. Please try again.",
                    "score": None,
                    "chat_id": chat_id
                }), 500
        else:
            logger.info("=== Continuing Conversation ===")
            try:
                # Get the last user message
                last_user_message = conversation[-1].get('content', '') if conversation else ''
                
                # Convert conversation to summary format
                conversation_summary = []
                for i in range(0, len(conversation), 2):
                    if i + 1 < len(conversation):
                        if conversation[i].get('role') == 'assistant' and conversation[i+1].get('role') == 'user':
                            conversation_summary.append({
                                "question": conversation[i]["content"],
                                "answer": conversation[i+1]["content"]
                            })
                
                result = orchestrator.continue_conversation(
                    chat_id,
                    last_user_message,
                    conversation_summary
                )
                
                # Ensure questions text preserves newlines
                if isinstance(result.get('question'), str):
                    # Replace any literal \n with actual newlines
                    result['question'] = result['question'].replace('\\n', '\n')
                    # Ensure double newlines between sections
                    result['question'] = result['question'].replace('\n\n\n', '\n\n')
                
                logger.info(f"Conversation result: {json.dumps(result, indent=2)}")
                
                response = jsonify(result)
                response.headers['Content-Type'] = 'application/json; charset=utf-8'
                return response
                
            except Exception as e:
                logger.error(f"Error in conversation continuation: {str(e)}")
                logger.error(f"Traceback: {traceback.format_exc()}")
                return jsonify({
                    "error": "Failed to continue conversation",
                    "error_details": str(e),
                    "question": "I'm having trouble processing your response. Please try again.",
                    "score": None,
                    "chat_id": chat_id
                }), 500
                
    except Exception as e:
        logger.error(f"Unexpected error in analyze_email: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            "error": "Internal server error",
            "error_details": str(e),
            "questions": "An unexpected error occurred. Please try again.",
            "score": None
        }), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    host = os.getenv('HOST', '0.0.0.0')
    logger.info(f"Starting AI service on {host}:{port}")
    app.run(host=host, port=port, debug=True) 