"""
This module contains the RiskAssessmentAgent class responsible for calculating final risk scores based on user responses.
"""

import logging
import json
from typing import Dict, Any, Callable, List

logger = logging.getLogger(__name__)

class RiskAssessmentAgent:
    """Agent responsible for calculating final risk scores based on user responses."""
    
    def __init__(self, make_request: Callable):
        """Initialize the risk assessment agent with the request function."""
        self.make_request = make_request
        
    def calculate_risk(self, analysis: Dict[str, Any], user_responses: List[str], response_analysis: Dict[str, Any] = None) -> Dict[str, Any]:
        """Calculate final risk score based on analysis and user responses."""
        try:
            messages = [
                {
                    "role": "system",
                    "content": """You are a cybersecurity expert calculating a final risk score.
                    
Rules:
1. Consider initial analysis
2. Evaluate user responses
3. Consider response analysis if available
4. Calculate risk score (0-1)
5. Provide detailed analysis
6. Give clear recommendations
7. Return a structured response with the following format:
{
    "score": 0.0 to 1.0,
    "analysis": {
        "subject_risk": "low/medium/high",
        "sender_risk": "low/medium/high",
        "content_risk": "low/medium/high",
        "overall_risk": "low/medium/high",
        "key_findings": ["list of findings"],
        "user_response_analysis": "analysis of user responses",
        "response_risk_factors": ["list of risk factors from responses"]
    },
    "recommendation": {
        "action": "recommended action",
        "explanation": "detailed explanation",
        "additional_steps": ["list of steps"]
    }
}"""
                },
                {
                    "role": "user",
                    "content": f"""Calculate risk score based on:
                    
Initial Analysis: {json.dumps(analysis, indent=2)}
User Responses: {json.dumps(user_responses, indent=2)}
Response Analysis: {json.dumps(response_analysis, indent=2) if response_analysis else "Not available"}"""
                }
            ]
            
            response = self.make_request({
                "messages": messages,
                "model": "microsoft/phi-4-reasoning-plus:free",
                "temperature": 0.1,
                "max_tokens": 1000,
                "stream": False
            })
            
            if response and "choices" in response and response["choices"]:
                result = json.loads(response["choices"][0]["message"]["content"])
                
                # Validate result structure
                if not self._validate_result_structure(result):
                    raise ValueError("Invalid result structure")
                    
                return {
                    "analysis": result["analysis"],
                    "score": result["score"],
                    "recommendation": result["recommendation"],
                    "is_final": True
                }
            else:
                raise ValueError("Invalid response from risk assessment agent")
                
        except Exception as e:
            logger.error(f"Error in risk assessment: {str(e)}")
            raise
            
    def _validate_result_structure(self, result: Dict[str, Any]) -> bool:
        """Validate that the result has the required structure."""
        try:
            # Check required top-level fields
            if not all(field in result for field in ["score", "analysis", "recommendation"]):
                return False
                
            # Check score is valid
            if not isinstance(result["score"], (int, float)) or not 0 <= result["score"] <= 1:
                return False
                
            # Check analysis structure
            analysis = result["analysis"]
            required_analysis_fields = [
                "subject_risk", "sender_risk", "content_risk", "overall_risk",
                "key_findings", "user_response_analysis", "response_risk_factors"
            ]
            if not all(field in analysis for field in required_analysis_fields):
                return False
                
            # Check recommendation structure
            recommendation = result["recommendation"]
            required_recommendation_fields = ["action", "explanation", "additional_steps"]
            if not all(field in recommendation for field in required_recommendation_fields):
                return False
                
            return True
            
        except Exception as e:
            logger.error(f"Error validating result structure: {str(e)}")
            return False

    def assess_risk(self, email_data: Dict[str, str], analysis: Dict[str, Any], conversation_summary: List[Dict[str, str]]) -> Dict[str, Any]:
        """Assess the risk based on email data, analysis, and conversation history."""
        try:
            # Extract user responses from conversation summary
            user_responses = [qa['answer'] for qa in conversation_summary]
            
            # Calculate risk score
            return self.calculate_risk(analysis, user_responses)
            
        except Exception as e:
            logger.error(f"Error in risk assessment: {str(e)}")
            raise 