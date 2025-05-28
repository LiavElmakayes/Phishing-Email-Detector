"""
This module contains the ResponseAgent class responsible for processing and analyzing user responses.
"""

import logging
import json
from typing import Dict, Any, Callable, List
import traceback

logger = logging.getLogger(__name__)

class ResponseAgent:
    """Agent responsible for processing and analyzing user responses."""
    
    def __init__(self, make_request: Callable):
        """Initialize the response agent with the request function."""
        self.make_request = make_request
        
    def process_response(self, user_response: str, current_question: Dict[str, str], 
                        analysis: Dict[str, Any], conversation_history: List[Dict[str, str]]) -> Dict[str, Any]:
        """Process a user response and determine next steps."""
        try:
            messages = [
                {
                    "role": "system",
                    "content": """You are an email security expert analyzing user responses to verify email authenticity.

Your job is to:
1. Analyze the user's response in context
2. Determine if the response indicates potential risks
3. Decide if more questions are needed
4. Prepare data for final risk assessment

Rules for response analysis:
1. Consider the current question and its context
2. Look for red flags in the response
3. Identify if the response is clear and complete
4. Determine if follow-up questions are needed

Return a structured analysis with this format:
{
    "response_analysis": {
        "is_complete": true/false,
        "indicates_risk": true/false,
        "confidence": 0.0 to 1.0,
        "key_findings": ["list of findings"],
        "explanation": "detailed explanation"
    },
    "follow_up": {
        "needed": true/false,
        "reason": "explanation if follow-up needed",
        "suggested_questions": ["list of follow-up questions if needed"]
    },
    "risk_indicators": {
        "level": "low/medium/high",
        "factors": ["list of risk factors"],
        "explanation": "detailed explanation"
    }
}"""
                },
                {
                    "role": "user",
                    "content": f"""Analyze this user response in context:

Current Question:
Context: {current_question.get('context', '')}
Question: {current_question.get('question', '')}

User Response: {user_response}

Email Analysis:
Subject: {analysis.get('subject_analysis', {}).get('subject', {}).get('text', '')}
Sender: {analysis.get('sender_analysis', {}).get('sender', {}).get('email', '')}
Content: {analysis.get('content_analysis', {}).get('content', {}).get('text', '')}

Conversation History:
{json.dumps(conversation_history, indent=2)}

Analyze the response and determine if it indicates any security risks or needs follow-up questions."""
                }
            ]
            
            logger.debug(f"Making request to AI model with messages: {json.dumps(messages, indent=2)}")
            response = self.make_request({
                "messages": messages,
                "model": "microsoft/phi-4-reasoning-plus:free",
                "temperature": 0.3,
                "max_tokens": 1000,
                "stream": False
            })
            
            if not response or "choices" not in response or not response["choices"]:
                raise ValueError("Invalid response from AI model")
                
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
                raise ValueError("Invalid response format")
            
            logger.debug(f"Cleaned content: {content}")
            
            try:
                analysis = json.loads(content)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response: {str(e)}")
                logger.error(f"Raw content: {content}")
                raise ValueError("Invalid JSON response")
            
            # Validate analysis structure
            if not self._validate_analysis_structure(analysis):
                logger.error(f"Invalid analysis structure: {json.dumps(analysis, indent=2)}")
                raise ValueError("Invalid analysis structure")
            
            return analysis
                
        except Exception as e:
            logger.error(f"Error processing response: {str(e)}")
            logger.error(f"Error traceback: {traceback.format_exc()}")
            return self._generate_fallback_analysis()
            
    def _validate_analysis_structure(self, analysis: Dict[str, Any]) -> bool:
        """Validate that the analysis has the required structure."""
        try:
            required_sections = {
                "response_analysis": ["is_complete", "indicates_risk", "confidence", "key_findings", "explanation"],
                "follow_up": ["needed", "reason", "suggested_questions"],
                "risk_indicators": ["level", "factors", "explanation"]
            }
            
            # Check if all required sections exist
            if not all(section in analysis for section in required_sections):
                return False
                
            # Check if all required fields exist in each section
            for section, fields in required_sections.items():
                if not all(field in analysis[section] for field in fields):
                    return False
                    
            return True
            
        except Exception as e:
            logger.error(f"Error validating analysis structure: {str(e)}")
            return False
            
    def _generate_fallback_analysis(self) -> Dict[str, Any]:
        """Generate a fallback analysis when processing fails."""
        return {
            "response_analysis": {
                "is_complete": False,
                "indicates_risk": False,
                "confidence": 0.0,
                "key_findings": ["Unable to process response"],
                "explanation": "Error occurred while processing the response"
            },
            "follow_up": {
                "needed": True,
                "reason": "Error in processing, need to verify response",
                "suggested_questions": ["Could you please clarify your response?"]
            },
            "risk_indicators": {
                "level": "low",
                "factors": ["Processing error"],
                "explanation": "Unable to determine risk level due to processing error"
            }
        } 