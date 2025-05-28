"""
This module contains the orchestrator that manages the flow of email analysis between different AI agents.
It coordinates the analysis process and maintains conversation history.
"""

import logging
import json
from typing import Dict, Any, List, Optional, Callable
from agents.metadata_agent import MetadataAgent
from agents.analysis_agent import AnalysisAgent
from agents.question_agent import QuestionAgent
from agents.risk_agent import RiskAssessmentAgent
import uuid
import traceback

logger = logging.getLogger(__name__)

class EmailAnalysisOrchestrator:
    """Orchestrates the email analysis process between different AI agents."""
    
    def __init__(self, make_request: Callable):
        """Initialize the orchestrator with the AI agents."""
        self.metadata_agent = MetadataAgent(make_request)
        self.analysis_agent = AnalysisAgent(make_request)
        self.question_agent = QuestionAgent(make_request)
        self.risk_agent = RiskAssessmentAgent(make_request)
        self.conversation_history = {}  # Store conversation history by chat_id
        
    def analyze_email(self, email_data: Dict[str, str], chat_id: Optional[str] = None, initial_scan_result: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Analyze an email and start a new conversation."""
        try:
            logger.info("Starting email analysis in orchestrator")
            
            # Validate email data
            if not email_data or not isinstance(email_data, dict):
                logger.error("Invalid email data format")
                return {
                    "error": "Invalid email data",
                    "error_details": "No email data provided or invalid format",
                    "questions": "Please provide a valid email to analyze.",
                    "chat_id": chat_id or str(uuid.uuid4()),
                    "current_category": "subject"
                }
            
            # Validate required fields
            if not email_data.get('subject') or not email_data.get('content'):
                logger.error("Missing required email fields")
                return {
                    "error": "Missing required fields",
                    "error_details": "Email must contain subject and content",
                    "questions": "Please provide both subject and content of the email.",
                    "chat_id": chat_id or str(uuid.uuid4()),
                    "current_category": "subject"
                }
            
            # Extract metadata
            metadata = self.metadata_agent.extract_metadata(email_data)
            
            # Perform initial analysis
            analysis = self.analysis_agent.analyze_email(email_data, metadata, initial_scan_result)
            
            # Generate questions based on analysis
            questions = self.question_agent.generate_questions(analysis, chat_id)
            
            # Get the chat_id from the analysis result
            chat_id = chat_id or str(uuid.uuid4())
            
            # Store the initial analysis in conversation history
            self.conversation_history[chat_id] = {
                "email": email_data,
                "metadata": metadata,
                "analysis": analysis,
                "questions": questions,
                "messages": [],
                "current_category": "subject",
                "category_index": 0
            }
            
            # Return the analysis with preserved formatting
            return {
                "questions": questions.get("questions", ""),
                "chat_id": chat_id,
                "current_category": "subject"
            }
            
        except Exception as e:
            logger.error(f"Error in email analysis: {str(e)}")
            logger.error(f"Error traceback: {traceback.format_exc()}")
            # Return a clear error message
            return {
                "error": "Failed to analyze email",
                "error_details": str(e),
                "questions": "I'm having trouble analyzing this email. Please try again.",
                "chat_id": chat_id or str(uuid.uuid4()),
                "current_category": "subject"
            }
            
    def continue_conversation(self, chat_id: str, user_message: str, conversation_summary: List[Dict[str, str]] = None) -> Dict[str, Any]:
        """Continue an existing conversation."""
        try:
            if not chat_id:
                raise ValueError("Missing chat ID")
                
            # If chat_id not in history, start a new analysis
            if chat_id not in self.conversation_history:
                logger.warning(f"Chat ID {chat_id} not found in history. Starting new analysis.")
                return self.analyze_email({}, chat_id)
                
            # Get conversation history
            history = self.conversation_history[chat_id]
            
            # If no conversation summary provided, use the stored messages
            if not conversation_summary:
                conversation_summary = history.get('messages', [])
            
            # Add the current message to the conversation summary
            if conversation_summary:
                conversation_summary.append({
                    "question": history.get('last_question', ''),
                    "answer": user_message,
                    "category": history.get('current_category', '')
                })
            
            # Generate next question based on user's response
            response = self.question_agent.generate_next_question(
                history['email'],
                history['analysis'],
                user_message,
                conversation_summary
            )
            
            # Store the last question for next iteration
            history['last_question'] = response.get('questions', '')
            
            # Update conversation history
            history['messages'].append({
                "question": response.get('questions', ''),
                "answer": user_message,
                "category": response.get('current_category', '')
            })
            
            # Update current category
            history['current_category'] = response.get('current_category', history['current_category'])
            
            # If this is the final analysis, calculate risk score
            if response.get('is_final', False):
                risk_assessment = self.risk_agent.assess_risk(
                    history['email'],
                    history['analysis'],
                    conversation_summary
                )
                response.update(risk_assessment)
                history['score'] = risk_assessment.get('score')
                history['final_analysis'] = risk_assessment.get('analysis')
                history['recommendation'] = risk_assessment.get('recommendation')
            
            # Update the conversation history
            self.conversation_history[chat_id] = history
            
            # Return the response directly without any acknowledgment message
            return response
            
        except Exception as e:
            logger.error(f"Error in conversation continuation: {str(e)}")
            logger.error(f"Error traceback: {traceback.format_exc()}")
            # Return a clear error message
            return {
                "error": "Failed to continue conversation",
                "error_details": str(e),
                "questions": "I apologize, but I'm having trouble processing your response. Please try again.",
                "chat_id": chat_id,
                "is_final": True
            }
            
    def get_conversation_history(self, chat_id: str) -> Dict[str, Any]:
        """Get the conversation history for a specific chat."""
        try:
            if not chat_id or chat_id not in self.conversation_history:
                raise ValueError("Invalid or missing chat ID")
                
            return self.conversation_history[chat_id]
            
        except Exception as e:
            logger.error(f"Error getting conversation history: {str(e)}")
            raise 