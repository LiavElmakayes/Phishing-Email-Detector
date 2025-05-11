"""
This module manages the orchestration of AI agents in the email analysis system.
It handles the group chat setup, conversation flow, and state management.
"""

from autogen import GroupChat, GroupChatManager
import logging
from datetime import datetime
import hashlib
import json
import traceback

# Set up detailed logging
logging.basicConfig(level=logging.DEBUG,
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EmailAnalysisOrchestrator:
    """
    Manages the orchestration of AI agents in the email analysis system.
    Handles group chat setup, conversation flow, and state management.
    """
    
    def __init__(self, agents, config_list):
        """
        Initialize the orchestrator with agents and configuration.
        
        Args:
            agents (EmailAgents): Instance of EmailAgents containing all AI agents
            config_list (list): List of configuration dictionaries for the LLM
        """
        self.agents = agents
        self.config_list = config_list
        self.active_chats = {}
        self._setup_group_chat()

    def _setup_group_chat(self):
        """Set up the group chat with all agents and configure the manager."""
        logger.info("Setting up group chat")
        # Create a new group chat instance
        group_chat = GroupChat(
            agents=[
                self.agents.email_parser,
                self.agents.analyzer,
                self.agents.questioner,
                self.agents.scorer,
                self.agents.user_proxy
            ],
            messages=[],
            max_round=50  # Maximum number of conversation rounds
        )

        # Create a new manager instance
        manager = GroupChatManager(
            groupchat=group_chat,
            llm_config={"config_list": self.config_list}
        )

        # Store both the group chat and manager
        self.group_chat = group_chat
        self.manager = manager
        logger.info("Group chat setup complete")

    def create_chat_id(self, email_data):
        """
        Generate a unique chat ID based on email data and timestamp.
        
        Args:
            email_data (dict): The email data to analyze
            
        Returns:
            str: A unique chat ID
        """
        return hashlib.md5(
            f"{email_data.get('sender', '')}{email_data.get('subject', '')}{datetime.now().isoformat()}".encode()
        ).hexdigest()

    def get_or_create_chat(self, chat_id):
        """
        Get an existing chat or create a new one.
        
        Args:
            chat_id (str): The chat ID to look up or create
            
        Returns:
            dict: Dictionary containing group_chat and manager instances
        """
        if chat_id not in self.active_chats:
            # Create a new group chat for this session
            group_chat = GroupChat(
                agents=[
                    self.agents.email_parser,
                    self.agents.analyzer,
                    self.agents.questioner,
                    self.agents.scorer,
                    self.agents.user_proxy
                ],
                messages=[],
                max_round=50
            )
            
            manager = GroupChatManager(
                groupchat=group_chat,
                llm_config={"config_list": self.config_list}
            )
            
            self.active_chats[chat_id] = {
                "group_chat": group_chat,
                "manager": manager
            }
            
        return self.active_chats[chat_id]

    def _extract_last_message(self, response):
        """
        Extract the last message from a RunResponse object.
        
        Args:
            response: The RunResponse object from the agent
            
        Returns:
            dict: The last message from the response
        """
        try:
            logger.debug(f"Response type: {type(response)}")
            logger.debug(f"Response dir: {dir(response)}")
            
            # Log all available attributes
            for attr in dir(response):
                if not attr.startswith('__'):
                    try:
                        value = getattr(response, attr)
                        logger.debug(f"Response.{attr} = {value}")
                    except Exception as e:
                        logger.debug(f"Could not get {attr}: {e}")
            
            # Try to get the raw response content
            if hasattr(response, 'raw_output'):
                logger.debug(f"Raw output: {response.raw_output}")
                if response.raw_output:
                    return {"content": response.raw_output, "name": "email_parser"}
            
            # Try to get the response content
            if hasattr(response, 'content'):
                logger.debug(f"Content: {response.content}")
                if response.content:
                    return {"content": response.content, "name": "email_parser"}
            
            # Try to get the response summary
            if hasattr(response, 'summary'):
                logger.debug(f"Summary: {response.summary}")
                if response.summary:
                    return response.summary
            
            # Try to get the response messages
            if hasattr(response, 'messages'):
                logger.debug(f"Messages: {response.messages}")
                if response.messages:
                    return response.messages[-1]
            
            # Try to get the response chat history
            if hasattr(response, 'chat_history'):
                logger.debug(f"Chat history: {response.chat_history}")
                if response.chat_history:
                    return response.chat_history[-1]
            
            # Try to get the response as a string
            try:
                str_response = str(response)
                logger.debug(f"String response: {str_response}")
                if str_response and str_response != "None":
                    return {"content": str_response, "name": "email_parser"}
            except Exception as e:
                logger.debug(f"Could not convert response to string: {e}")
            
            # If we get here, log the response object for debugging
            logger.error(f"Could not extract message from response: {response}")
            logger.error(f"Response dict: {response.__dict__ if hasattr(response, '__dict__') else 'No __dict__'}")
            return None
            
        except Exception as e:
            logger.error(f"Error extracting message: {str(e)}")
            logger.error(f"Error traceback: {traceback.format_exc()}")
            return None

    def analyze_email(self, email_data, chat_id=None):
        """
        Perform initial analysis of an email.
        
        Args:
            email_data (dict): The email data to analyze
            chat_id (str, optional): Existing chat ID if continuing a conversation
            
        Returns:
            dict: Analysis results including question and chat ID
        """
        logger.info("Starting email analysis")
        logger.debug(f"Email data: {json.dumps(email_data, indent=2)}")
        
        if not chat_id:
            chat_id = self.create_chat_id(email_data)
            logger.info(f"Created new chat ID: {chat_id}")
        
        chat_session = self.get_or_create_chat(chat_id)
        
        try:
            # Start with a direct question to the parser
            logger.info("Sending email to parser agent")
            parser_message = f"""Please analyze this email and provide a structured response:
            Subject: {email_data.get('subject', '')}
            Sender: {email_data.get('sender', '')}
            Content: {email_data.get('content', '')}
            
            Format your response as a JSON object with the following structure:
            {{
                "sender": {{
                    "email": "full email address",
                    "domain": "domain name",
                    "display_name": "sender name if available"
                }},
                "subject": "cleaned subject line",
                "content": "cleaned email body",
                "links": ["list of URLs found"],
                "attachments": ["list of attachments"],
                "formatting_issues": ["list of any formatting problems"]
            }}"""
            
            # Run the parser agent
            logger.info("Running parser agent...")
            parser_response = chat_session["manager"].run(
                input_agent=self.agents.email_parser,
                message=parser_message
            )
            
            logger.info("Received parser response")
            logger.debug(f"Parser response type: {type(parser_response)}")
            logger.debug(f"Parser response: {parser_response}")
            
            # Extract the last message from the parser response
            last_message = self._extract_last_message(parser_response)
            logger.debug(f"Extracted last message: {last_message}")
            
            if not last_message:
                logger.error("Failed to get response from parser agent")
                return {
                    "analysis": "I apologize, but I'm having trouble analyzing this email. Could you please try again?",
                    "score": None,
                    "chat_id": chat_id
                }
            
            try:
                # If the content is a string, try to parse it as JSON
                if isinstance(last_message.get("content"), str):
                    parsed_data = json.loads(last_message["content"])
                else:
                    parsed_data = last_message.get("content", {})
                    
                logger.info("Successfully parsed email data")
                logger.debug(f"Parsed data: {json.dumps(parsed_data, indent=2)}")
                
                # Now get the analyzer's response
                logger.info("Sending parsed data to analyzer")
                analyzer_message = f"""Please analyze this parsed email data for suspicious elements:
                {json.dumps(parsed_data, indent=2)}
                
                Format your response as a JSON object with the following structure:
                {{
                    "suspicious_elements": [
                        {{
                            "type": "sender|subject|content|link",
                            "description": "detailed description",
                            "risk_level": "high|medium|low",
                            "explanation": "why this is suspicious"
                        }}
                    ],
                    "overall_risk": "high|medium|low",
                    "key_findings": ["list of main suspicious elements"]
                }}"""
                
                logger.info("Running analyzer agent...")
                analyzer_response = chat_session["manager"].run(
                    input_agent=self.agents.analyzer,
                    message=analyzer_message
                )
                
                logger.info("Received analyzer response")
                logger.debug(f"Analyzer response type: {type(analyzer_response)}")
                logger.debug(f"Analyzer response: {analyzer_response}")
                
                # Extract the last message from the analyzer response
                last_analysis = self._extract_last_message(analyzer_response)
                logger.debug(f"Extracted last analysis: {last_analysis}")
                
                if not last_analysis:
                    logger.error("Failed to get response from analyzer agent")
                    return {
                        "analysis": "I apologize, but I'm having trouble analyzing this email. Could you please try again?",
                        "score": None,
                        "chat_id": chat_id
                    }
                
                try:
                    # If the content is a string, try to parse it as JSON
                    if isinstance(last_analysis.get("content"), str):
                        analysis_data = json.loads(last_analysis["content"])
                    else:
                        analysis_data = last_analysis.get("content", {})
                        
                    logger.info("Successfully analyzed email")
                    logger.debug(f"Analysis data: {json.dumps(analysis_data, indent=2)}")
                    
                    # Finally, get the questioner's response
                    logger.info("Sending analysis to questioner")
                    questioner_message = f"""Based on this analysis, generate a specific question about the most suspicious element:
                    {json.dumps(analysis_data, indent=2)}
                    
                    Format your response as a JSON object with the following structure:
                    {{
                        "question": "the specific question to ask",
                        "context": "why this question is being asked",
                        "element_type": "sender|subject|content|link",
                        "previous_questions": []
                    }}"""
                    
                    logger.info("Running questioner agent...")
                    questioner_response = chat_session["manager"].run(
                        input_agent=self.agents.questioner,
                        message=questioner_message
                    )
                    
                    logger.info("Received questioner response")
                    logger.debug(f"Questioner response type: {type(questioner_response)}")
                    logger.debug(f"Questioner response: {questioner_response}")
                    
                    # Extract the last message from the questioner response
                    last_question = self._extract_last_message(questioner_response)
                    logger.debug(f"Extracted last question: {last_question}")
                    
                    if not last_question:
                        logger.error("Failed to get response from questioner agent")
                        return {
                            "analysis": "I apologize, but I'm having trouble analyzing this email. Could you please try again?",
                            "score": None,
                            "chat_id": chat_id
                        }
                    
                    try:
                        # If the content is a string, try to parse it as JSON
                        if isinstance(last_question.get("content"), str):
                            question_data = json.loads(last_question["content"])
                        else:
                            question_data = last_question.get("content", {})
                            
                        logger.info("Successfully generated question")
                        logger.debug(f"Question data: {json.dumps(question_data, indent=2)}")
                        return {
                            "analysis": question_data.get("question", "What are your thoughts about this email?"),
                            "score": None,
                            "chat_id": chat_id
                        }
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse questioner response: {e}")
                        logger.error(f"Raw response: {last_question.get('content')}")
                        return {
                            "analysis": "I apologize, but I'm having trouble analyzing this email. Could you please try again?",
                            "score": None,
                            "chat_id": chat_id
                        }
                    
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse analyzer response: {e}")
                    logger.error(f"Raw response: {last_analysis.get('content')}")
                    return {
                        "analysis": "I apologize, but I'm having trouble analyzing this email. Could you please try again?",
                        "score": None,
                        "chat_id": chat_id
                    }
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse email parser response: {e}")
                logger.error(f"Raw response: {last_message.get('content')}")
                return {
                    "analysis": "I apologize, but I'm having trouble analyzing this email. Could you please try again?",
                    "score": None,
                    "chat_id": chat_id
                }
            
        except Exception as e:
            logger.error(f"Error in analyze_email: {str(e)}")
            logger.error(f"Error traceback: {traceback.format_exc()}")
            return {
                "analysis": "I apologize, but I'm having trouble analyzing this email. Could you please try again?",
                "score": None,
                "chat_id": chat_id
            }

    def continue_conversation(self, chat_id, user_message, conversation_history):
        """
        Continue an existing conversation with a user response.
        
        Args:
            chat_id (str): The chat ID to continue
            user_message (str): The user's response
            conversation_history (list): Previous conversation messages
            
        Returns:
            dict: Updated analysis results including score and chat ID
        """
        chat_session = self.get_or_create_chat(chat_id)
        
        try:
            logger.info("Continuing conversation with user response")
            # Continue the conversation with the user's response
            transcript = chat_session["manager"].run(
                input_agent=self.agents.user_proxy,
                message=f"""User's response: {user_message}
                Conversation history: {json.dumps(conversation_history, indent=2)}"""
            )
            
            logger.info("Got response from conversation")
            logger.debug(f"Conversation response: {transcript}")
            
            # Convert transcript to list if it's not already
            if not isinstance(transcript, list):
                transcript = list(transcript)
            
            # Get the last message from the scorer
            last_message = transcript[-1] if transcript else None
            if last_message and last_message.get("name") == "scorer":
                try:
                    score_data = json.loads(last_message["content"])
                    logger.info("Successfully processed score")
                    return {
                        "analysis": score_data.get("analysis", "Based on our discussion, I recommend reviewing the email carefully."),
                        "score": int(score_data.get("score", 0)) if "score" in score_data else None,
                        "chat_id": chat_id
                    }
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse scorer response: {e}")
            
            # If we get here, something went wrong
            logger.error("Failed to get a valid response from the scorer")
            return {
                "analysis": "I apologize, but I'm having trouble processing your response. Could you please try again?",
                "score": None,
                "chat_id": chat_id
            }
            
        except Exception as e:
            logger.error(f"Error in continue_conversation: {str(e)}")
            return {
                "analysis": "I apologize, but I'm having trouble processing your response. Could you please try again?",
                "score": None,
                "chat_id": chat_id
            } 