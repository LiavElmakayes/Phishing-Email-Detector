"""
This module contains the QuestionAgent class responsible for generating contextual questions based on analysis.
"""

import logging
import json
from typing import Dict, Any, Callable, List
import uuid
import traceback

logger = logging.getLogger(__name__)

class QuestionAgent:
    """Agent responsible for generating contextual questions based on analysis."""
    
    def __init__(self, make_request: Callable):
        """Initialize the question agent with the request function."""
        self.make_request = make_request
        self.analysis_state = {}
        
    def generate_questions(self, analysis: Dict[str, Any], chat_id: str = None) -> Dict[str, Any]:
        """Generate contextual questions based on analysis."""
        try:
            messages = [
                {
                    "role": "system",
                    "content": """You are an email analysis expert. Generate contextual questions about the email.

IMPORTANT: You must return ONLY a valid JSON object with no additional text or formatting.

Rules:
1. Generate questions specific to the analysis
2. Focus on understanding the email better
3. Use proper emojis (🔎 for subject, 📧 for sender, 📨 for content)
4. Format questions with context
5. Return a structured questions object with the following format:
{
    "subject": [
        {
            "context": "context about the subject",
            "question": "specific question about the subject"
        }
    ],
    "sender": [
        {
            "context": "context about the sender",
            "question": "specific question about the sender"
        }
    ],
    "content": [
        {
            "context": "context about the content",
            "question": "specific question about the content"
        }
    ]
}

DO NOT:
- Add any text before or after the JSON object
- Use markdown formatting
- Include any explanations or additional text
- Wrap the JSON in code blocks

The response must be a single, valid JSON object that can be parsed directly."""
                },
                {
                    "role": "user",
                    "content": f"""Generate questions based on this analysis:
                    
{json.dumps(analysis, indent=2)}"""
                }
            ]
            
            logger.debug(f"Making request to AI model with messages: {json.dumps(messages, indent=2)}")
            response = self.make_request({
                "messages": messages,
                "model": "thudm/glm-z1-32b:free",
                "temperature": 0.7,
                "max_tokens": 1000,
                "stream": False
            })
            
            logger.debug(f"Received response from AI model: {json.dumps(response, indent=2)}")
            
            if not response:
                logger.error("Empty response from AI model")
                raise ValueError("Empty response from AI model")
                
            if "choices" not in response:
                logger.error(f"Invalid response format: {json.dumps(response, indent=2)}")
                raise ValueError("Invalid response format from AI model")
                
            if not response["choices"]:
                logger.error("No choices in response")
                raise ValueError("No choices in response from AI model")
                
            content = response["choices"][0]["message"]["content"]
            logger.debug(f"Raw content from AI model: {content}")
            
            # Clean the content to ensure it's valid JSON
            content = content.strip()
            
            # Remove any markdown formatting
            if content.startswith("```json"):
                content = content[7:]
            elif content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            
            # Remove any non-JSON text before or after the JSON object
            try:
                # Find the first '{' and last '}'
                start = content.find('{')
                end = content.rfind('}') + 1
                if start >= 0 and end > start:
                    content = content[start:end]
            except Exception as e:
                logger.error(f"Error cleaning content: {str(e)}")
            
            logger.debug(f"Cleaned content: {content}")
            
            try:
                questions = json.loads(content)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response: {str(e)}")
                logger.error(f"Raw content: {content}")
                # Create dynamic fallback questions based on the analysis
                default_contexts = {
                    "subject": "Let's examine the subject line",
                    "sender": "Let's look at the sender information",
                    "content": "Let's analyze the email content"
                }
                
                questions = {
                    "subject": [
                        {
                            "context": f"Looking at the subject: {analysis.get('subject_analysis', {}).get('explanation', default_contexts['subject'])}",
                            "question": "What aspects of the subject line seem unusual or concerning to you?"
                        }
                    ],
                    "sender": [
                        {
                            "context": f"Regarding the sender: {analysis.get('sender_analysis', {}).get('explanation', default_contexts['sender'])}",
                            "question": "What do you notice about the sender's email address and domain?"
                        }
                    ],
                    "content": [
                        {
                            "context": f"About the content: {analysis.get('content_analysis', {}).get('explanation', default_contexts['content'])}",
                            "question": "What specific elements in the email content raise concerns for you?"
                        }
                    ]
                }
                logger.info("Using dynamic fallback questions based on analysis")
            
            # Validate questions structure
            if not self._validate_questions_structure(questions):
                logger.error(f"Invalid questions structure: {json.dumps(questions, indent=2)}")
                raise ValueError("Invalid questions structure")
            
            # Generate chat_id if not provided
            chat_id = chat_id or str(uuid.uuid4())
            
            # Store state
            self.analysis_state[chat_id] = {
                "questions_asked": 0,
                "max_questions": 6,
                "user_responses": [],
                "current_category": "subject",
                "categories": ["subject", "sender", "content"],
                "category_index": 0,
                "all_questions": questions,
                "current_question_index": 0,
                "analysis": analysis
            }
            
            # Get the first question
            first_question = self._get_next_question(chat_id)
            formatted_question = self._format_question(first_question)
            
            return {
                "questions": formatted_question,
                "chat_id": chat_id,
                "current_category": "subject"
            }
                
        except Exception as e:
            logger.error(f"Error in question generation: {str(e)}")
            logger.error(f"Error traceback: {traceback.format_exc()}")
            raise
            
    def _validate_questions_structure(self, questions: Dict[str, List[Dict[str, str]]]) -> bool:
        """Validate that the questions have the required structure."""
        try:
            required_categories = ["subject", "sender", "content"]
            
            # Check if all required categories exist
            if not all(category in questions for category in required_categories):
                return False
                
            # Check if each category has at least one question
            for category in required_categories:
                if not questions[category] or not isinstance(questions[category], list):
                    return False
                    
                # Check if each question has context and question fields
                for question in questions[category]:
                    if not all(field in question for field in ["context", "question"]):
                        return False
                        
            return True
            
        except Exception as e:
            logger.error(f"Error validating questions structure: {str(e)}")
            return False
            
    def _get_next_question(self, chat_id: str) -> Dict[str, str]:
        """Get the next question based on current state."""
        try:
            state = self.analysis_state[chat_id]
            all_questions = state["all_questions"]
            current_category = state["current_category"]
            current_question_index = state["current_question_index"]
            
            category_questions = all_questions[current_category]
            
            if current_question_index >= len(category_questions):
                state["category_index"] = (state["category_index"] + 1) % len(state["categories"])
                state["current_category"] = state["categories"][state["category_index"]]
                state["current_question_index"] = 0
                current_category = state["current_category"]
                category_questions = all_questions[current_category]
            
            return category_questions[state["current_question_index"]]
            
        except Exception as e:
            logger.error(f"Error getting next question: {str(e)}")
            raise
            
    def _format_question(self, question_data: Dict[str, str]) -> str:
        """Format the question with proper emoji and context."""
        try:
            category = question_data.get("category", "content")
            emoji = {
                "subject": "🔎",
                "sender": "📧",
                "content": "📨"
            }.get(category, "📨")
            
            return f"{emoji} {question_data['context']}\n❓ {question_data['question']}"
            
        except Exception as e:
            logger.error(f"Error formatting question: {str(e)}")
            raise

    def generate_next_question(self, email_data: Dict[str, str], analysis: Dict[str, Any], user_message: str, conversation_summary: List[Dict[str, str]]) -> Dict[str, Any]:
        """Generate the next question based on user's response and conversation history."""
        try:
            # Get the chat_id from the conversation summary
            chat_id = conversation_summary[0].get('chat_id') if conversation_summary else str(uuid.uuid4())
            
            # If we don't have state for this chat, generate initial questions
            if chat_id not in self.analysis_state:
                return self.generate_questions(analysis, chat_id)
            
            # Get current state
            state = self.analysis_state[chat_id]
            
            # Add user's response to history
            state['user_responses'].append(user_message)
            state['questions_asked'] += 1
            
            # If we've asked enough questions, return final analysis
            if state['questions_asked'] >= state['max_questions']:
                return {
                    "is_final": True,
                    "chat_id": chat_id
                }
            
            # Get next question
            next_question = self._get_next_question(chat_id)
            state['current_question_index'] += 1
            
            # Update state
            self.analysis_state[chat_id] = state
            
            return {
                "questions": self._format_question(next_question),
                "chat_id": chat_id,
                "current_category": state['current_category']
            }
            
        except Exception as e:
            logger.error(f"Error generating next question: {str(e)}")
            raise 