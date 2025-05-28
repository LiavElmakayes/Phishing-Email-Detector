"""
This module contains the QuestionAgent class responsible for generating contextual questions based on analysis.
"""

import logging
import json
from typing import Dict, Any, Callable, List
import uuid
import traceback
from .response_agent import ResponseAgent

logger = logging.getLogger(__name__)

class QuestionAgent:
    """Agent responsible for generating contextual questions based on analysis."""
    
    def __init__(self, make_request: Callable):
        """Initialize the question agent with the request function."""
        self.make_request = make_request
        self.analysis_state = {}
        self.response_agent = ResponseAgent(make_request)
        
    def generate_questions(self, analysis: Dict[str, Any], chat_id: str = None) -> Dict[str, Any]:
        """Generate contextual questions based on analysis."""
        try:
            messages = [
                {
                    "role": "system",
                    "content": """You are a JSON generator. Your ONLY task is to output a valid JSON object.

CRITICAL INSTRUCTIONS:
1. DO NOT explain your process
2. DO NOT think out loud
3. DO NOT include any text before or after the JSON
4. DO NOT use ellipsis (...) in the JSON
5. DO NOT include example values
6. DO NOT include comments
7. DO NOT include markdown formatting
8. DO NOT include any reasoning or analysis
9. DO NOT include any explanations
10. DO NOT include any notes
11. DO NOT include any text outside the JSON object
12. DO NOT include any text inside the JSON object that is not part of the JSON structure
13. DO NOT include any text that explains the JSON structure
14. DO NOT include any text that describes what you are doing
15. DO NOT include any text that describes how you are generating the JSON
16. DO NOT include any text that describes the input
17. DO NOT include any text that describes the output
18. DO NOT include any text that describes the process
19. DO NOT include any text that describes the rules
20. DO NOT include any text that describes the format
21. DO NOT include any text that describes the requirements
22. DO NOT include any text that describes the instructions
23. DO NOT include any text that describes the examples
24. DO NOT include any text that describes the structure
25. DO NOT include any text that describes the fields
26. DO NOT include any text that describes the values
27. DO NOT include any text that describes the format
28. DO NOT include any text that describes the rules
29. DO NOT include any text that describes the process
30. DO NOT include any text that describes the task

REQUIRED OUTPUT FORMAT:
{
    "subject": [
        {
            "context": "specific context about the subject",
            "question": "🔎 specific question about subject"
        }
    ],
    "sender": [
        {
            "context": "specific context about the sender",
            "question": "📧 specific question about sender"
        }
    ],
    "content": [
        {
            "context": "specific context about the content",
            "question": "📨 specific question about content"
        }
    ]
}"""
                },
                {
                    "role": "user",
                    "content": f"""Generate a valid JSON object with questions based on this email analysis. Return ONLY the JSON object, nothing else.

Subject Analysis:
- Subject: {analysis.get('subject_analysis', {}).get('subject', {}).get('text', '')}
- Risk Level: {analysis.get('subject_analysis', {}).get('risk_level', '')}
- Suspicious Patterns: {analysis.get('subject_analysis', {}).get('suspicious_patterns', [])}
- Explanation: {analysis.get('subject_analysis', {}).get('explanation', '')}

Sender Analysis:
- Email: {analysis.get('sender_analysis', {}).get('sender', {}).get('email', '')}
- Name: {analysis.get('sender_analysis', {}).get('sender', {}).get('name', '')}
- Domain Risk: {analysis.get('sender_analysis', {}).get('domain_risk', '')}
- Suspicious Elements: {analysis.get('sender_analysis', {}).get('suspicious_elements', [])}
- Explanation: {analysis.get('sender_analysis', {}).get('explanation', '')}

Content Analysis:
- Content: {analysis.get('content_analysis', {}).get('content', {}).get('text', '')}
- Risk Level: {analysis.get('content_analysis', {}).get('risk_level', '')}
- Suspicious Elements: {analysis.get('content_analysis', {}).get('suspicious_elements', [])}
- Explanation: {analysis.get('content_analysis', {}).get('explanation', '')}

Overall Analysis:
- Risk Level: {analysis.get('overall_analysis', {}).get('risk_level', '')}
- Key Findings: {analysis.get('overall_analysis', {}).get('key_findings', [])}"""
                }
            ]
            
            logger.debug(f"Making request to AI model with messages: {json.dumps(messages, indent=2)}")
            response = self.make_request(
                messages=messages,
                max_tokens=1000,
                temperature=0.1  # Lower temperature for more deterministic output
            )
            
            if not response or "choices" not in response or not response["choices"]:
                logger.error("Invalid response from AI model: No choices found")
                raise ValueError("Invalid response from AI model")
                
            content = response["choices"][0]["message"]["content"]
            logger.debug(f"Raw content from AI model: {content}")
            
            # Log the content length and first/last characters
            logger.debug(f"Content length: {len(content)}")
            logger.debug(f"First 50 characters: {content[:50]}")
            logger.debug(f"Last 50 characters: {content[-50:]}")
            
            # Clean the content to ensure it's valid JSON
            content = content.strip()
            logger.debug(f"Content after strip: {content}")
            
            # Remove any markdown formatting
            if content.startswith("```json"):
                content = content[7:]
                logger.debug("Removed ```json prefix")
            elif content.startswith("```"):
                content = content[3:]
                logger.debug("Removed ``` prefix")
            if content.endswith("```"):
                content = content[:-3]
                logger.debug("Removed ``` suffix")
            content = content.strip()
            logger.debug(f"Content after markdown removal: {content}")
            
            # Additional validation to ensure no extra text
            if not content.startswith('{') or not content.endswith('}'):
                logger.error(f"Response contains text outside JSON object: {content}")
                logger.error(f"First character: '{content[0]}'")
                logger.error(f"Last character: '{content[-1]}'")
                raise ValueError("Response contains text outside JSON object")
            
            # Remove any text before the first { and after the last }
            content = content[content.find('{'):content.rfind('}')+1]
            logger.debug(f"Content after JSON extraction: {content}")
            
            # Validate that the content is a single JSON object
            try:
                # First attempt to parse the JSON
                questions = json.loads(content)
                logger.debug(f"Successfully parsed JSON: {json.dumps(questions, indent=2)}")
                
                # Additional validation of the JSON structure
                if not isinstance(questions, dict):
                    logger.error(f"Response is not a JSON object: {type(questions)}")
                    raise ValueError("Response is not a JSON object")
                
                required_keys = ["subject", "sender", "content"]
                missing_keys = [key for key in required_keys if key not in questions]
                if missing_keys:
                    logger.error(f"Missing required keys: {missing_keys}")
                    logger.error(f"Available keys: {list(questions.keys())}")
                    raise ValueError(f"Missing required keys: {missing_keys}")
                
                for key in required_keys:
                    if not isinstance(questions[key], list):
                        logger.error(f"Key '{key}' is not a list: {type(questions[key])}")
                        raise ValueError(f"Key '{key}' must be a list")
                    if not questions[key]:
                        logger.error(f"Key '{key}' is empty")
                        raise ValueError(f"Key '{key}' must not be empty")
                    for i, item in enumerate(questions[key]):
                        if not isinstance(item, dict):
                            logger.error(f"Item {i} in '{key}' is not an object: {type(item)}")
                            raise ValueError(f"Items in '{key}' must be objects")
                        if "context" not in item or "question" not in item:
                            logger.error(f"Item {i} in '{key}' missing required fields: {list(item.keys())}")
                            raise ValueError(f"Items in '{key}' must have 'context' and 'question' fields")
                        if not isinstance(item["context"], str) or not isinstance(item["question"], str):
                            logger.error(f"Item {i} in '{key}' has invalid field types: context={type(item['context'])}, question={type(item['question'])}")
                            raise ValueError(f"'context' and 'question' fields must be strings")
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response: {str(e)}")
                logger.error(f"Raw content: {content}")
                logger.error(f"JSON error position: {e.pos}")
                logger.error(f"JSON error line: {e.lineno}")
                logger.error(f"JSON error column: {e.colno}")
                
                # Try to fix common JSON issues
                try:
                    # Replace single quotes with double quotes
                    content = content.replace("'", '"')
                    logger.debug("Replaced single quotes with double quotes")
                    
                    # Add missing commas between array elements
                    content = content.replace('}"', '},"')
                    content = content.replace(']"', '],"')
                    logger.debug("Added missing commas between array elements")
                    
                    # Fix unclosed strings
                    content = content.replace('"question": "', '"question": "')
                    content = content.replace('"context": "', '"context": "')
                    logger.debug("Fixed unclosed strings")
                    
                    # Remove any trailing commas
                    content = content.replace(',}', '}')
                    content = content.replace(',]', ']')
                    logger.debug("Removed trailing commas")
                    
                    # Remove any ellipsis
                    content = content.replace('...', '')
                    logger.debug("Removed ellipsis")
                    
                    # Remove any example values
                    content = content.replace('"some question"', '""')
                    content = content.replace('"some analysis"', '""')
                    logger.debug("Removed example values")
                    
                    logger.debug(f"Attempting to parse fixed JSON: {content}")
                    # Try parsing again
                    questions = json.loads(content)
                    logger.debug(f"Successfully parsed fixed JSON: {json.dumps(questions, indent=2)}")
                except Exception as e:
                    logger.error(f"Failed to fix JSON issues: {str(e)}")
                    logger.error(f"Fixed content: {content}")
                    raise ValueError("Invalid JSON response")
            
            # Validate questions structure
            if not self._validate_questions_structure(questions):
                logger.error(f"Invalid questions structure: {json.dumps(questions, indent=2)}")
                raise ValueError("Invalid questions structure")
            
            # Generate chat_id if not provided
            chat_id = chat_id or str(uuid.uuid4())
            
            # Store state first
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
            first_question = questions["subject"][0]
            formatted_question = self._format_question(first_question)
            
            # Update state with formatted question
            self.analysis_state[chat_id]['formatted_question'] = formatted_question
            
            return {
                "questions": formatted_question,
                "chat_id": chat_id,
                "current_category": "subject"
            }
                
        except Exception as e:
            logger.error(f"Error in question generation: {str(e)}")
            logger.error(f"Error traceback: {traceback.format_exc()}")
            # Return a basic response to prevent server error
            return {
                "questions": "🔎 Let's start by checking this email. Did you expect to receive this email?",
                "chat_id": chat_id or str(uuid.uuid4()),
                "current_category": "subject"
            }
            
    def _validate_questions_structure(self, questions: Dict[str, List[Dict[str, str]]]) -> bool:
        """Validate that the questions have the required structure."""
        try:
            required_categories = ["subject", "sender", "content"]
            
            # Check if all required categories exist
            missing_categories = [cat for cat in required_categories if cat not in questions]
            if missing_categories:
                logger.error(f"Missing required categories: {missing_categories}")
                # Add missing categories with empty lists
                for category in missing_categories:
                    questions[category] = []
                return True
                
            # Check if each category has at least one question
            empty_categories = [cat for cat in required_categories if not questions[cat] or not isinstance(questions[cat], list)]
            if empty_categories:
                logger.error(f"Empty or invalid categories: {empty_categories}")
                # Initialize empty categories with a default question
                for category in empty_categories:
                    questions[category] = [{
                        "context": f"Analyzing the {category} of the email",
                        "question": f"Please review the {category} of this email carefully."
                    }]
                return True
                    
            # Check if each question has context and question fields
            for category in required_categories:
                for question in questions[category]:
                    if not all(field in question for field in ["context", "question"]):
                        logger.error(f"Invalid question format in category {category}: {question}")
                        # Fix invalid questions by adding missing fields
                        if "context" not in question:
                            question["context"] = f"Analyzing the {category} of the email"
                        if "question" not in question:
                            question["question"] = f"Please review the {category} of this email carefully."
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating questions structure: {str(e)}")
            return False
            
    def _get_next_question(self, chat_id: str) -> Dict[str, str]:
        """Get the next question based on current state."""
        try:
            # Check if we have state for this chat_id
            if chat_id not in self.analysis_state:
                logger.error(f"No state found for chat_id: {chat_id}")
                raise ValueError(f"No state found for chat_id: {chat_id}")
            
            state = self.analysis_state[chat_id]
            all_questions = state.get("all_questions", {})
            current_category = state.get("current_category", "subject")
            current_question_index = state.get("current_question_index", 0)
            
            # Get questions for current category
            category_questions = all_questions.get(current_category, [])
            
            # If we've exhausted questions in current category, move to next category
            if current_question_index >= len(category_questions):
                # Move to next category
                state["category_index"] = (state["category_index"] + 1) % len(state["categories"])
                state["current_category"] = state["categories"][state["category_index"]]
                state["current_question_index"] = 0
                current_category = state["current_category"]
                category_questions = all_questions.get(current_category, [])
            
            # If we still have no questions, raise an error
            if not category_questions:
                logger.error(f"No questions available for category {current_category}")
                raise ValueError(f"No questions available for category {current_category}")
            
            # Get the next question
            question_data = category_questions[state["current_question_index"]]
            
            # Validate question data
            if not isinstance(question_data, dict) or 'context' not in question_data or 'question' not in question_data:
                logger.error(f"Invalid question data format: {question_data}")
                raise ValueError("Invalid question data format")
            
            return question_data
            
        except Exception as e:
            logger.error(f"Error getting next question: {str(e)}")
            raise
            
    def _format_question(self, question_data: Dict[str, str]) -> str:
        """Format the question with proper emoji and context."""
        try:
            # Get the category from the current state
            state = self.analysis_state.get(list(self.analysis_state.keys())[-1])
            category = state['current_category'] if state else 'content'
            
            emoji = {
                "subject": "🔎",
                "sender": "📧",
                "content": "📨"
            }.get(category, "📨")
            
            # Ensure we have both context and question
            context = question_data.get('context', '')
            question = question_data.get('question', '')
            
            if not context or not question:
                logger.error(f"Missing context or question in question data: {question_data}")
                raise ValueError("Invalid question data format")
            
            return f"{emoji} {context}\n❓ {question}"
            
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
                    "chat_id": chat_id,
                    "questions": "I'll now analyze your responses to assess the email's safety."
                }
            
            # Get the current question that was just answered
            current_category = state['current_category']
            current_question_index = state['current_question_index']
            current_question = state['all_questions'][current_category][current_question_index]
            
            # Process the response using ResponseAgent
            response_analysis = self.response_agent.process_response(
                user_response=user_message,
                current_question=current_question,
                analysis=analysis,
                conversation_history=conversation_summary
            )
            
            # If the response indicates risk, add follow-up questions
            if response_analysis["response_analysis"]["indicates_risk"]:
                # Add follow-up questions to the current category
                state['all_questions'][current_category].extend([
                    {"context": "Follow-up question based on your response", "question": q}
                    for q in response_analysis["follow_up"]["suggested_questions"]
                ])
            
            # Move to next question in current category
            state['current_question_index'] += 1
            
            # Get questions for current category
            category_questions = state['all_questions'].get(current_category, [])
            
            # If we've exhausted questions in current category, move to next category
            if state['current_question_index'] >= len(category_questions):
                # Move to next category
                state['category_index'] = (state['category_index'] + 1) % len(state['categories'])
                state['current_category'] = state['categories'][state['category_index']]
                state['current_question_index'] = 0
                
                # Get questions for new category
                current_category = state['current_category']
                category_questions = state['all_questions'].get(current_category, [])
                
                # If we've gone through all categories, return final analysis
                if state['category_index'] == 0:
                    return {
                        "is_final": True,
                        "chat_id": chat_id,
                        "questions": "I'll now analyze your responses to assess the email's safety."
                    }
            
            # Get the next question
            next_question = category_questions[state['current_question_index']]
            
            # Format the question with context about the previous response
            if response_analysis["response_analysis"]["indicates_risk"]:
                context = f"Based on your previous response, I'd like to ask: {next_question['context']}"
            else:
                context = next_question['context']
            
            formatted_question = self._format_question({
                "context": context,
                "question": next_question['question']
            })
            
            # Update state
            state['formatted_question'] = formatted_question
            self.analysis_state[chat_id] = state
            
            # Log the state for debugging
            logger.debug(f"Current state for chat {chat_id}: {json.dumps(state, indent=2)}")
            
            # Return the next question directly without acknowledgment
            return {
                "questions": formatted_question,
                "chat_id": chat_id,
                "current_category": current_category,
                "response_analysis": response_analysis
            }
            
        except Exception as e:
            logger.error(f"Error generating next question: {str(e)}")
            logger.error(f"Error traceback: {traceback.format_exc()}")
            # Return a clear error message
            return {
                "questions": "I apologize, but I'm having trouble generating the next question. Let's start over with a fresh analysis.",
                "chat_id": chat_id,
                "current_category": "subject",
                "is_final": True,
                "error": True
            } 