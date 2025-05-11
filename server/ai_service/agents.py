"""
This module contains the configuration and setup of all AI agents used in the email analysis system.
Each agent has a specific role in analyzing emails and detecting phishing attempts.
"""

from autogen import AssistantAgent, UserProxyAgent
import logging

logger = logging.getLogger(__name__)

class EmailAgents:
    """
    A class that manages all AI agents used in the email analysis system.
    Each agent has a specific role and is configured with appropriate system messages and parameters.
    """
    
    def __init__(self, config_list):
        """
        Initialize the EmailAgents with the provided configuration.
        
        Args:
            config_list (list): List of configuration dictionaries for the LLM
        """
        self.config_list = config_list
        self._create_agents()

    def _create_agents(self):
        """Create and configure all agents with their specific roles and system messages."""
        
        # Email Parser Agent - Extracts and structures email data
        self.email_parser = AssistantAgent(
            name="email_parser",
            llm_config={
                "config_list": self.config_list,
                "temperature": 0.3,  # Lower temperature for more consistent parsing
                "timeout": 60,
                "response_format": {"type": "json_object"}
            },
            system_message="""You are an email parsing specialist. Your role is to:
            1. Extract and validate email metadata
            2. Clean and format the data
            3. Identify any obvious formatting issues
            4. Pass the structured data to the analyzer
            
            Format your response as a JSON object with the following structure:
            {
                "sender": {
                    "email": "full email address",
                    "domain": "domain name",
                    "display_name": "sender name if available"
                },
                "subject": "cleaned subject line",
                "content": "cleaned email body",
                "links": ["list of URLs found"],
                "attachments": ["list of attachments"],
                "formatting_issues": ["list of any formatting problems"]
            }"""
        )

        # Analyzer Agent - Identifies suspicious elements in the email
        self.analyzer = AssistantAgent(
            name="analyzer",
            llm_config={
                "config_list": self.config_list,
                "temperature": 0.5,  # Medium temperature for balanced analysis
                "timeout": 60,
                "response_format": {"type": "json_object"}
            },
            system_message="""You are a phishing email analysis specialist. Your role is to:
            1. Analyze the parsed email data for suspicious elements
            2. Identify specific suspicious patterns
            3. Create a structured analysis report
            
            Format your response as a JSON object with the following structure:
            {
                "suspicious_elements": [
                    {
                        "type": "sender|subject|content|link",
                        "description": "detailed description",
                        "risk_level": "high|medium|low",
                        "explanation": "why this is suspicious"
                    }
                ],
                "overall_risk": "high|medium|low",
                "key_findings": ["list of main suspicious elements"]
            }"""
        )

        # Question Generator Agent - Creates context-aware questions
        self.questioner = AssistantAgent(
            name="questioner",
            llm_config={
                "config_list": self.config_list,
                "temperature": 0.7,  # Higher temperature for more varied questions
                "timeout": 60,
                "response_format": {"type": "json_object"}
            },
            system_message="""You are a phishing detection question specialist. Your role is to:
            1. Generate specific questions based on the analysis
            2. Track conversation history
            3. Ensure questions are:
               - Specific to the email content
               - Focused on one element at a time
               - Not repeated
               - Based on the analysis report
            
            Format your response as a JSON object with the following structure:
            {
                "question": "the specific question to ask",
                "context": "why this question is being asked",
                "element_type": "sender|subject|content|link",
                "previous_questions": ["list of already asked questions"]
            }"""
        )

        # Scorer Agent - Calculates risk scores and provides recommendations
        self.scorer = AssistantAgent(
            name="scorer",
            llm_config={
                "config_list": self.config_list,
                "temperature": 0.7,  # Higher temperature for more nuanced scoring
                "timeout": 60,
                "response_format": {"type": "json_object"}
            },
            system_message="""You are a phishing risk assessment specialist. Your role is to:
            1. Analyze user responses and the email content
            2. Calculate a risk score based on all available information
            3. Provide detailed analysis and recommendations
            
            Format your response as a JSON object with the following structure:
            {
                "score": "percentage (0-100)",
                "analysis": "detailed analysis of the email and user's response",
                "risk_factors": ["list of confirmed risk factors"],
                "recommendations": ["list of recommendations"]
            }"""
        )

        # User Proxy Agent - Manages user interactions
        self.user_proxy = UserProxyAgent(
            name="user_proxy",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=10,
            code_execution_config={"work_dir": "coding", "use_docker": False},
            llm_config={
                "config_list": self.config_list,
                "timeout": 60
            }
        ) 