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
from agents import EmailAgents
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

# Add request logging middleware
@app.before_request
def log_request_info():
    """Log incoming request information."""
    logger.info('=== Incoming Request ===')
    logger.info('Headers: %s', request.headers)
    logger.info('Body: %s', request.get_data())

@app.after_request
def log_response_info(response):
    """Log outgoing response information."""
    logger.info('=== Outgoing Response ===')
    logger.info('Status: %s', response.status)
    logger.info('Headers: %s', response.headers)
    return response

# Configure the AI agents
config_list = [
    {
        'model': os.getenv('MODEL_NAME', 'google/gemini-2.0-flash-exp:free'),
        'api_key': os.getenv('OPENROUTER_API_KEY', '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'),
        'base_url': os.getenv('BASE_URL', 'https://openrouter.ai/api/v1'),
        'api_type': 'openai',
        'price': [0.0, 0.0]
    }
]

# Initialize agents and orchestrator
agents = EmailAgents(config_list)
orchestrator = EmailAnalysisOrchestrator(agents, config_list)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy", "message": "AI service is running"}), 200

@app.route('/analyze', methods=['POST'])
def analyze_email():
    """
    Main endpoint for email analysis.
    Handles both initial analysis and conversation continuation.
    """
    try:
        logger.debug("=== Python Service: Received request ===")
        
        # Validate request
        if not request.json:
            raise ValueError("No JSON data received")
            
        data = request.json
        email_data = data.get('email', {})
        conversation = data.get('conversation', [])
        chat_id = data.get('chat_id')
        
        # Handle initial analysis or continue conversation
        if not conversation:
            logger.info("=== Starting Initial Analysis ===")
            return jsonify(orchestrator.analyze_email(email_data, chat_id))
        else:
            logger.info("=== Continuing Conversation ===")
            # Extract last user message
            last_user_message = next(
                (msg['content'] for msg in reversed(conversation) if msg.get('role') == 'user'),
                None
            )
            
            # Create conversation summary
            conversation_summary = []
            for i in range(0, len(conversation), 2):
                if i + 1 < len(conversation):
                    conversation_summary.append({
                        "question": conversation[i]["content"],
                        "answer": conversation[i + 1]["content"]
                    })
            
            return jsonify(orchestrator.continue_conversation(
                chat_id,
                last_user_message,
                conversation_summary
            ))

    except Exception as e:
        logger.error("=== Error in analyze_email ===")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error message: {str(e)}")
        logger.error(f"Error traceback: {traceback.format_exc()}")
        return jsonify({
            "error": "Failed to analyze email with AI",
            "details": str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    host = os.getenv('HOST', '0.0.0.0')
    logger.info(f"Starting AI service on {host}:{port}")
    app.run(host=host, port=port, debug=True) 