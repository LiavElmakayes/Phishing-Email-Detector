"""
Diagnostic script to troubleshoot AI service startup and OpenRouter integration issues.
Run this before starting the main service to identify and fix common problems.
"""

import os
import sys
import logging
import json
from dotenv import load_dotenv
import traceback

# Set up logging
logging.basicConfig(level=logging.DEBUG,
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def check_environment():
    """Check that environment variables are properly loaded."""
    logger.info("Checking environment variables...")
    
    # Load environment variables
    load_dotenv()
    
    # Check OpenRouter API key
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    if not api_key:
        logger.error("❌ OPENROUTER_API_KEY is missing in environment variables")
        print("\n⚠️ OPENROUTER_API_KEY is not set! Please add it to your .env file")
        return False
    
    if not api_key.startswith("sk-or-v1-"):
        logger.error(f"❌ OPENROUTER_API_KEY has incorrect format: {api_key[:8]}...")
        print("\n⚠️ OPENROUTER_API_KEY has incorrect format. It should start with 'sk-or-v1-'")
        return False
    
    logger.info(f"✅ OPENROUTER_API_KEY found with correct format: {api_key[:10]}...")
    return True

def test_openrouter_connection():
    """Test connection to OpenRouter API."""
    logger.info("Testing OpenRouter connection...")
    try:
        from openai import OpenAI
        
        # Load environment variables
        load_dotenv()
        api_key = os.getenv("OPENROUTER_API_KEY", "")
        
        # Create a client instance with OpenRouter-specific configuration
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,  # Set the API key here
            default_headers={
                "HTTP-Referer": "http://localhost:5001",
                "X-Title": "Phishing Detector",
                "Authorization": f"Bearer {api_key}"  # Use the full API key in Bearer format
            }
        )
        
        # Log the request details for debugging
        logger.debug(f"Making request to OpenRouter with API key starting with: {api_key[:10]}...")
        logger.debug("Using headers: HTTP-Referer, X-Title, and Authorization (OpenRouter format)")
        
        # Test with a simple completion request
        response = client.chat.completions.create(
            model="microsoft/phi-4-reasoning-plus:free",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Say hello!"}
            ],
            max_tokens=10
        )
        
        # Check if we got a valid response
        if response and hasattr(response, 'choices') and len(response.choices) > 0:
            content = response.choices[0].message.content
            logger.info(f"✅ Successfully connected to OpenRouter. Response: {content}")
            return True
        else:
            logger.error(f"❌ Received unexpected response format: {response}")
            if hasattr(response, 'error'):
                logger.error(f"Error details: {response.error}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Failed to connect to OpenRouter: {str(e)}")
        logger.error(f"Error traceback: {traceback.format_exc()}")
        print(f"\n⚠️ OpenRouter connection failed: {str(e)}")
        return False

def check_autogen_package():
    """Check if autogen is installed and working correctly."""
    logger.info("Checking AutoGen installation...")
    try:
        import autogen
        from autogen import AssistantAgent, UserProxyAgent, GroupChat, GroupChatManager
        
        logger.info(f"✅ AutoGen is installed (version: {autogen.__version__})")
        
        # Check if there might be version incompatibilities
        if hasattr(autogen, '__version__'):
            version = autogen.__version__
            if version.startswith('0.1'):
                logger.warning("⚠️ You're using AutoGen v0.1.x which might have different APIs than expected")
                print("\n⚠️ AutoGen version compatibility warning: You're using v0.1.x")
                print("   Consider upgrading to the latest version with: pip install -U pyautogen\n")
                
        return True
    except ImportError as e:
        logger.error(f"❌ AutoGen is not installed: {str(e)}")
        print("\n⚠️ AutoGen is not installed! Install it with: pip install pyautogen")
        return False
    except Exception as e:
        logger.error(f"❌ Error checking AutoGen: {str(e)}")
        logger.error(f"Error traceback: {traceback.format_exc()}")
        return False

def test_simple_agent():
    """Test creating a simple agent to verify AutoGen + OpenRouter integration."""
    logger.info("Testing simple agent creation...")
    try:
        from autogen import AssistantAgent, UserProxyAgent
        import os
        from dotenv import load_dotenv
        
        # Load environment variables
        load_dotenv()
        api_key = os.getenv("OPENROUTER_API_KEY", "")
        
        # Configure the AI model
        config_list = [
            {
                "model": "mistralai/mistral-7b-instruct:free",
                "api_key": api_key,  # Set the API key here
                "base_url": "https://openrouter.ai/api/v1",
                "api_type": "openai",
                "default_headers": {
                    "HTTP-Referer": "http://localhost:5001",
                    "X-Title": "Phishing Detector",
                    "Authorization": f"Bearer {api_key}"  # Use the full API key in Bearer format
                }
            }
        ]
        
        # Configure the LLM settings
        llm_config = {
            "config_list": config_list,
            "temperature": 0.3,
            "timeout": 120,
            "cache_seed": None,
            "max_tokens": 1000
        }
        
        # Create a simple test agent
        assistant = AssistantAgent(
            name="test_assistant",
            system_message="You are a helpful assistant.",
            llm_config=llm_config
        )
        
        user_proxy = UserProxyAgent(
            name="user_proxy",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=0,
            code_execution_config=False
        )
        
        # Test the agent with a simple message
        logger.info("Testing agent with a simple message...")
        try:
            # A shorter timeout for testing
            test_llm_config = llm_config.copy()
            test_llm_config["timeout"] = 30
            
            # Initialize the agent with the test config
            test_assistant = AssistantAgent(
                name="test_assistant",
                system_message="You are a helpful assistant.",
                llm_config=test_llm_config
            )
            
            # Use a non-streaming approach for simpler debugging
            user_proxy.initiate_chat(
                test_assistant,
                message="Say hello in one sentence."
            )
            logger.info("✅ Successfully tested agent communication")
            return True
        except Exception as e:
            logger.error(f"❌ Agent communication test failed: {str(e)}")
            logger.error(f"Error traceback: {traceback.format_exc()}")
            print(f"\n⚠️ Agent communication test failed: {str(e)}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Failed to create test agent: {str(e)}")
        logger.error(f"Error traceback: {traceback.format_exc()}")
        print(f"\n⚠️ Agent creation failed: {str(e)}")
        return False

def check_port_availability():
    """Check if the port is available."""
    logger.info("Checking port availability...")
    try:
        import socket
        
        # Get port from environment or use default
        port = int(os.getenv('PORT', 5001))
        
        # Try to bind to the port
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1)
        result = s.connect_ex(('127.0.0.1', port))
        s.close()
        
        if result == 0:
            logger.error(f"❌ Port {port} is already in use")
            print(f"\n⚠️ Port {port} is already in use. Either stop the service using it or change your PORT in .env")
            return False
        else:
            logger.info(f"✅ Port {port} is available")
            return True
    except Exception as e:
        logger.error(f"❌ Error checking port: {str(e)}")
        return False

def suggest_fixes():
    """Suggest potential fixes based on issues found."""
    print("\n✅ RECOMMENDATIONS:")
    
    # Check for common OpenRouter integration issues
    print("\n1. OpenRouter Integration:")
    print("   - Make sure your .env file has OPENROUTER_API_KEY=sk-or-v1-.....")
    print("   - Check that you have enough credits on OpenRouter")
    print("   - Verify you're using a model available in your tier ('mistralai/mistral-7b-instruct:free' should be free)")

    # Check for AutoGen config
    print("\n2. AutoGen Configuration:")
    print("   - Ensure pyautogen is installed: pip install -U pyautogen")
    print("   - Check for version compatibility (latest is recommended)")
    print("   - Try simplifying group chat logic initially for testing")
    
    # Suggest simplified agent approach
    print("\n3. Consider modifying _extract_last_message in orchestrator.py:")
    print("   - The method tries to handle many response types, which might be causing issues")
    print("   - Simplify it to focus on the specific response format from OpenRouter")
    
    # Debugging tips
    print("\n4. Debugging Tips:")
    print("   - Add more print statements before/after each API call")
    print("   - Try running with a simpler agent configuration first")
    print("   - Check your logs for timeout issues or error messages")

def main():
    """Main diagnostic function."""
    print("\n🔍 Starting AI Service Diagnostics 🔍\n")
    
    all_passed = True
    
    # Check environment
    if not check_environment():
        all_passed = False
    
    # Check AutoGen package
    if not check_autogen_package():
        all_passed = False
    
    # Check port availability
    if not check_port_availability():
        all_passed = False
    
    # Test OpenRouter connection
    if not test_openrouter_connection():
        all_passed = False
        
    # Test simple agent (only if previous checks passed)
    if all_passed:
        if not test_simple_agent():
            all_passed = False
    
    # Provide summary
    if all_passed:
        print("\n✅ All diagnostic checks passed! The service should start correctly.")
        print("   Run 'python ai_service.py' to start the service.")
    else:
        print("\n❌ Some diagnostic checks failed. Please address the issues above.")
        suggest_fixes()
    
    return all_passed

if __name__ == "__main__":
    main() 