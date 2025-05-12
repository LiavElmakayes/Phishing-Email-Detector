"""
This module contains the orchestrator that manages the flow of email analysis between different AI agents.
It coordinates the analysis process and maintains conversation history.
"""

import logging
import json
from typing import Dict, Any, List, Optional
from agents import EmailAgents

logger = logging.getLogger(__name__)

class EmailAnalysisOrchestrator:
    """Orchestrates the email analysis process between different AI agents."""
    
    def __init__(self, agents: EmailAgents):
        """Initialize the orchestrator with the AI agents."""
        self.agents = agents
        self.conversation_history = {}  # Store conversation history by chat_id
        
    def analyze_email(self, email_data: Dict[str, str], chat_id: Optional[str] = None, initial_scan_result: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Analyze an email and start a new conversation."""
        try:
            logger.info("Starting email analysis in orchestrator")
            
            # Validate email data
            if not email_data or not isinstance(email_data, dict):
                raise ValueError("Invalid email data format")
                
            # Perform initial analysis
            analysis_result = self.agents.analyze_email(email_data, initial_scan_result)
            
            # Get the chat_id from the analysis result
            chat_id = analysis_result.get('chat_id')
            if not chat_id:
                raise ValueError("No chat ID returned from analysis")
            
            # Get the structured questions
            questions = analysis_result.get('questions', '')
            
            # Store the initial analysis in conversation history
            self.conversation_history[chat_id] = {
                "email": email_data,
                "questions": questions,
                "messages": [],
                "current_category": "subject",
                "category_index": 0
            }
            
            # Return the analysis with preserved formatting
            return {
                "questions": questions,
                "chat_id": chat_id,
                "current_category": "subject"
            }
            
        except Exception as e:
            logger.error(f"Error in email analysis: {str(e)}")
            raise
            
    def continue_conversation(self, chat_id: str, user_message: str, conversation_summary: List[Dict[str, str]] = None) -> Dict[str, Any]:
        """Continue an existing conversation."""
        try:
            if not chat_id or chat_id not in self.conversation_history:
                raise ValueError("Invalid or missing chat ID")
                
            # Get conversation history
            history = self.conversation_history[chat_id]
            
            # If no conversation summary provided, use the stored messages
            if not conversation_summary:
                conversation_summary = history.get('messages', [])
            
            # Continue the conversation
            response = self.agents.continue_conversation(chat_id, user_message, conversation_summary)
            
            # Update conversation history
            history['messages'].append({
                "question": response.get('question', ''),
                "answer": user_message,
                "category": response.get('current_category', '')
            })
            
            # Update current category
            history['current_category'] = response.get('current_category', history['current_category'])
            
            # If this is the final analysis, update the score
            if response.get('is_final'):
                history['score'] = response.get('score')
                history['final_analysis'] = response.get('analysis')
            
            return response
            
        except Exception as e:
            logger.error(f"Error in conversation continuation: {str(e)}")
            raise
            
    def get_conversation_history(self, chat_id: str) -> Dict[str, Any]:
        """Get the conversation history for a specific chat."""
        try:
            if not chat_id or chat_id not in self.conversation_history:
                raise ValueError("Invalid or missing chat ID")
                
            return self.conversation_history[chat_id]
            
        except Exception as e:
            logger.error(f"Error getting conversation history: {str(e)}")
            raise 