"""
This module contains the AnalysisAgent class responsible for analyzing email content and identifying suspicious patterns.
"""

import logging
import json
from typing import Dict, Any, Callable
import traceback

logger = logging.getLogger(__name__)

class AnalysisAgent:
    """Agent responsible for analyzing email content and identifying suspicious patterns."""
    
    def __init__(self, make_request: Callable):
        """Initialize the analysis agent with the request function."""
        self.make_request = make_request
        
    def analyze_email(self, email_data: Dict[str, str], metadata: Dict[str, Any], initial_scan_result: Dict[str, Any] = None) -> Dict[str, Any]:
        """Analyze an email using metadata and optional initial scan results."""
        try:
            # First analyze the content
            analysis = self.analyze_content(metadata)
            
            # If we have initial scan results, incorporate them
            if initial_scan_result:
                analysis['initial_scan'] = initial_scan_result
                
            return analysis
            
        except Exception as e:
            logger.error(f"Error in email analysis: {str(e)}")
            raise

    def analyze_content(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze email content for suspicious patterns."""
        try:
            messages = [
                {
                    "role": "system",
                    "content": """You are an email security expert. Analyze the email content for suspicious patterns.
                    
Rules:
1. Identify unusual patterns in subject, sender, and content
2. Look for phishing indicators
3. Analyze relationships between different parts
4. Return a structured analysis object with the following format:
{
    "subject_analysis": {
        "suspicious_patterns": ["list of patterns"],
        "risk_level": "low/medium/high",
        "explanation": "detailed explanation"
    },
    "sender_analysis": {
        "domain_risk": "low/medium/high",
        "suspicious_elements": ["list of elements"],
        "explanation": "detailed explanation"
    },
    "content_analysis": {
        "suspicious_elements": ["list of elements"],
        "risk_level": "low/medium/high",
        "explanation": "detailed explanation"
    },
    "overall_analysis": {
        "risk_level": "low/medium/high",
        "key_findings": ["list of findings"],
        "recommendations": ["list of recommendations"]
    }
}

IMPORTANT: You must return ONLY a valid JSON object. Do not include any text before or after the JSON object. Do not use markdown formatting."""
                },
                {
                    "role": "user",
                    "content": f"""Analyze this email:
                    
Subject: {metadata['subject']['text']}
Sender: {metadata['sender']['email']} ({metadata['sender']['name']})
Content: {metadata['content']['text']}

Focus on:
1. Unusual patterns in the subject line
2. Suspicious sender information
3. Specific content elements that seem out of place
4. Relationships between different parts of the email"""
                }
            ]
            
            logger.debug(f"Making request to AI model with messages: {json.dumps(messages, indent=2)}")
            response = self.make_request({
                "messages": messages,
                "model": "microsoft/phi-4-reasoning-plus:free",
                "temperature": 0.1,
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
                analysis = json.loads(content)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response: {str(e)}")
                logger.error(f"Raw content: {content}")
                # Create a basic analysis structure as fallback
                analysis = {
                    "subject_analysis": {
                        "suspicious_patterns": [],
                        "risk_level": "low",
                        "explanation": "Unable to analyze subject"
                    },
                    "sender_analysis": {
                        "domain_risk": "low",
                        "suspicious_elements": [],
                        "explanation": "Unable to analyze sender"
                    },
                    "content_analysis": {
                        "suspicious_elements": [],
                        "risk_level": "low",
                        "explanation": "Unable to analyze content"
                    },
                    "overall_analysis": {
                        "risk_level": "low",
                        "key_findings": ["Analysis incomplete"],
                        "recommendations": ["Please try again"]
                    }
                }
                logger.info("Using fallback analysis structure")
            
            # Validate the analysis structure
            if not self._validate_analysis_structure(analysis):
                logger.error(f"Invalid analysis structure: {json.dumps(analysis, indent=2)}")
                raise ValueError("Invalid analysis structure")
                
            return analysis
                
        except Exception as e:
            logger.error(f"Error in content analysis: {str(e)}")
            logger.error(f"Error traceback: {traceback.format_exc()}")
            raise
            
    def _validate_analysis_structure(self, analysis: Dict[str, Any]) -> bool:
        """Validate that the analysis has the required structure."""
        try:
            required_sections = {
                "subject_analysis": ["suspicious_patterns", "risk_level", "explanation"],
                "sender_analysis": ["domain_risk", "suspicious_elements", "explanation"],
                "content_analysis": ["suspicious_elements", "risk_level", "explanation"],
                "overall_analysis": ["risk_level", "key_findings", "recommendations"]
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