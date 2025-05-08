from flask import Flask, request, jsonify
from flask_cors import CORS
import autogen
import os
from dotenv import load_dotenv
import re
import traceback
import json

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configure the AI agents with OpenRouter using OpenAI format
config_list = [
    {
        'model': 'microsoft/phi-4-reasoning-plus:free',
        'api_key': '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',
        'base_url': 'https://openrouter.ai/api/v1',
        'api_type': 'openai',
        'price': [0.0, 0.0]  # Add price configuration to avoid the warning
    }
]

print("\n=== Autogen Configuration ===")
print("Config list:", json.dumps(config_list, indent=2))

# Create the agents
try:
    print("\n=== Creating Assistant Agent ===")
    assistant = autogen.AssistantAgent(
        name="assistant",
        llm_config={
            "config_list": config_list,
            "temperature": 0.7,
        },
        system_message="""You are a phishing email analysis assistant. Your role is to:
        1. First, thoroughly analyze the email content, including:
           - Sender information and domain
           - Email subject and content
           - Any links or attachments
           - Language and tone used
           - Any suspicious patterns or indicators
        2. Based on your analysis, identify specific concerns or suspicious elements
        3. Ask ONE specific question at a time about the most suspicious element you found
        4. Wait for the user's response
        5. Analyze their response and either:
           - Ask a follow-up question about the same element if needed
           - Move on to the next suspicious element
        6. Continue this process until you have gathered enough information
        7. Provide a final analysis with a phishing score
        
        IMPORTANT:
        - NEVER ask multiple questions at once
        - NEVER ask generic questions like "Is the sender familiar?" or "Were you expecting this email?"
        - ALWAYS ask specific questions based on what you found in the email
        - ALWAYS wait for the user's response before asking the next question
        - ALWAYS analyze the user's response before deciding what to ask next
        
        Example of a good specific question:
        "I noticed the sender's email domain is 'paypal-security.com' which is different from PayPal's official domain. Have you ever received emails from this domain before?"
        
        Example of a bad generic question:
        "Is the sender familiar to you?" or "Were you expecting this email?" """
    )
    print("Assistant agent created successfully")

    print("\n=== Creating User Proxy Agent ===")
    user_proxy = autogen.UserProxyAgent(
        name="user_proxy",
        human_input_mode="NEVER",
        max_consecutive_auto_reply=10,
        code_execution_config={"work_dir": "coding", "use_docker": False},
        llm_config={"config_list": config_list}
    )
    print("User proxy agent created successfully")

    print("\n=== Creating Phishing Analyst Agent ===")
    phishing_analyst = autogen.AssistantAgent(
        name="phishing_analyst",
        llm_config={
            "config_list": config_list,
            "temperature": 0.7,
        },
        system_message="""You are a specialized phishing email analyst. Your task is to:
        1. Analyze email content for phishing indicators
        2. Evaluate sender information and domain authenticity
        3. Check for suspicious links or attachments
        4. Assess the urgency and pressure tactics
        5. Provide a detailed risk assessment
        6. Calculate a phishing score (0-100%)
        7. Give specific recommendations
        
        Always include the phrase "new phishing score: X%" in your final response."""
    )
    print("Phishing analyst agent created successfully")

except Exception as e:
    print("\n=== Error Creating Agents ===")
    print(f"Error: {str(e)}")
    print("Traceback:", traceback.format_exc())
    raise

@app.route('/analyze', methods=['POST'])
def analyze_email():
    try:
        print("\n=== Python Service: Received request ===")
        print("Raw request data:", request.json)
        
        if not request.json:
            raise ValueError("No JSON data received")
            
        data = request.json
        email_data = data.get('email', {})
        
        print("\n=== Email Data ===")
        print("Raw email data:", email_data)
        
        # Validate email data
        if not email_data:
            raise ValueError("No email data provided")
            
        # Ensure all required fields are present
        required_fields = ['subject', 'sender', 'content']
        for field in required_fields:
            if field not in email_data:
                print(f"Missing field {field}, setting to empty string")
                email_data[field] = ''
                
        print("Validated email data:", email_data)
                
        initial_scan = data.get('initialScanResult', {})
        print("\n=== Initial Scan Result ===")
        print("Raw initial scan:", initial_scan)
        
        if not isinstance(initial_scan, dict):
            print("Initial scan is not a dict, converting to empty dict")
            initial_scan = {}
            
        # Ensure initial_scan has required fields
        initial_scan = {
            'result': initial_scan.get('result', 0),
            'legitimacy': initial_scan.get('legitimacy', 'Unknown')
        }
        print("Validated initial scan:", initial_scan)
        
        conversation = data.get('conversation', []) or []
        print("\n=== Conversation ===")
        print("Raw conversation:", conversation)
        print("Validated conversation:", conversation)

        # Prepare the context for the AI
        context = f"""
        Email Analysis Context:
        Subject: {email_data.get('subject', '')}
        Sender: {email_data.get('sender', '')}
        Content: {email_data.get('content', '')}
        
        Initial Scan Result: {initial_scan}
        """

        print("\n=== AI Context ===")
        print("Prepared context:", context)

        # Format conversation history for the AI
        formatted_conversation = ""
        if conversation:  # Only format if we have conversation history
            for msg in conversation:
                if isinstance(msg, dict) and 'role' in msg and 'content' in msg:
                    formatted_conversation += f"{msg['role'].capitalize()}: {msg['content']}\n"
                else:
                    print(f"Invalid message format: {msg}")

        print("\n=== Formatted Conversation ===")
        print("Formatted conversation:", formatted_conversation)

        # If this is the first message (empty conversation)
        if not conversation:
            print("\n=== Starting Initial Analysis ===")
            try:
                print("Initiating chat with assistant...")
                # First analyze the email thoroughly
                user_proxy.initiate_chat(
                    assistant,
                    message=f"""
                    Please analyze this email thoroughly and identify the most suspicious element.
                    Consider the initial scan result.
                    
                    {context}
                    
                    Your task is to:
                    1. Analyze the email content, including:
                       - Sender information and domain
                       - Email subject and content
                       - Any links or attachments
                       - Language and tone used
                       - Any suspicious patterns or indicators
                    2. Identify the most suspicious element
                    3. Formulate ONE specific question about that element
                    
                    IMPORTANT:
                    - DO NOT ask multiple questions
                    - DO NOT ask generic questions like "Is the sender familiar?" or "Were you expecting this email?"
                    - Ask a specific question based on what you found in the email
                    """
                )
                print("Chat initiated successfully")
            except Exception as e:
                print(f"Error in initiate_chat: {str(e)}")
                print("Error traceback:", traceback.format_exc())
                raise

        print("\n=== Getting Last Message ===")
        try:
            last_message = assistant.last_message()
            if not last_message or not isinstance(last_message, dict) or "content" not in last_message:
                raise ValueError("Invalid last message format")
            last_message_content = last_message["content"]
            print("Last message:", last_message_content)
        except Exception as e:
            print(f"Error getting last message: {str(e)}")
            print("Error traceback:", traceback.format_exc())
            raise
        
        # Extract the phishing score
        score_match = re.search(r"new phishing score: (\d+)%", last_message_content, re.IGNORECASE)
        score = int(score_match.group(1)) if score_match else None
        print("\n=== Phishing Score ===")
        print("Extracted score:", score)

        response = {
            "analysis": last_message_content,
            "score": score
        }
        print("\n=== Sending Response ===")
        print("Response:", response)
        return jsonify(response)

    except Exception as e:
        print("\n=== Error in analyze_email ===")
        print(f"Error: {str(e)}")
        print("Traceback:", traceback.format_exc())
        return jsonify({
            "error": "Failed to analyze email with AI",
            "details": str(e),
            "traceback": traceback.format_exc()
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001) 