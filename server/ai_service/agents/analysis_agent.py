"""
This module contains the AnalysisAgent class responsible for analyzing email content and identifying suspicious patterns.
"""

import logging
import json
from typing import Dict, Any, Callable, List
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
            analysis = self.analyze_content(email_data['content'], metadata)
            
            # If we have initial scan results, incorporate them
            if initial_scan_result:
                analysis['initial_scan'] = initial_scan_result
                
            return analysis
            
        except Exception as e:
            logger.error(f"Error in email analysis: {str(e)}")
            raise

    def analyze_content(self, content: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze the email content for suspicious patterns."""
        try:
            messages = [
                {
                    "role": "system",
                    "content": """You are an email security expert analyzing email content for suspicious patterns.

Your job is to analyze the email content and identify:
1. Suspicious patterns and red flags
2. Urgency or pressure tactics
3. Unusual requests or demands
4. Mismatched content and context
5. Suspicious links or attachments

Return a JSON object with this structure:
{
    "content": {
        "text": "original content",
        "risk_level": "low/medium/high",
        "suspicious_elements": ["list of suspicious elements found"],
        "explanation": "detailed explanation of findings"
    }
}

IMPORTANT: You must return ONLY a valid JSON object. Do not include any text before or after the JSON object. Do not use markdown formatting."""
                },
                {
                    "role": "user",
                    "content": f"Analyze this email content for suspicious patterns:\n\n{content}"
                }
            ]
            
            logger.debug(f"Making request to AI model with messages: {json.dumps(messages, indent=2)}")
            response = self.make_request(messages)  # Pass messages directly, not wrapped in an object
            
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
                return self._generate_fallback_analysis(metadata)
            
            logger.debug(f"Cleaned content: {content}")
            
            try:
                analysis = json.loads(content)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response: {str(e)}")
                return self._generate_fallback_analysis(metadata)
            
            # Validate the analysis structure
            if not self._validate_analysis_structure(analysis):
                logger.error(f"Invalid analysis structure: {json.dumps(analysis, indent=2)}")
                return self._generate_fallback_analysis(metadata)
                
            return analysis
                
        except Exception as e:
            logger.error(f"Error in content analysis: {str(e)}")
            logger.error(f"Error traceback: {traceback.format_exc()}")
            return self._generate_fallback_analysis(metadata)

    def _generate_fallback_analysis(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a fallback analysis with basic structure."""
        subject = metadata.get('subject', {}).get('text', '')
        sender_email = metadata.get('sender', {}).get('email', '')
        sender_name = metadata.get('sender', {}).get('name', '')
        content = metadata.get('content', {}).get('text', '')
        
        # Analyze the content for key elements
        content_lower = content.lower()
        has_links = 'http' in content_lower or 'www.' in content_lower
        has_password = 'password' in content_lower
        has_reset = 'reset' in content_lower
        has_urgent = any(word in content_lower for word in ['urgent', 'immediately', 'asap', 'now'])
        has_personal = any(word in content_lower for word in ['account', 'login', 'verify', 'confirm'])
        
        return {
            "subject_analysis": {
                "suspicious_patterns": [],
                "risk_level": "low",
                "explanation": "Initial analysis in progress",
                "subject": {
                    "text": subject
                }
            },
            "sender_analysis": {
                "domain_risk": "low",
                "suspicious_elements": [],
                "explanation": "Initial analysis in progress",
                "sender": {
                    "email": sender_email,
                    "name": sender_name
                }
            },
            "content_analysis": {
                "suspicious_elements": [],
                "risk_level": "low",
                "explanation": "Initial analysis in progress",
                "content": {
                    "text": content
                }
            },
            "overall_analysis": {
                "risk_level": "low",
                "key_findings": ["Analysis in progress"],
                "recommendations": ["Please wait for complete analysis"]
            }
        }

    def _validate_analysis_structure(self, analysis: Dict[str, Any]) -> bool:
        """Validate that the analysis has the required structure."""
        try:
            required_sections = {
                "subject_analysis": ["suspicious_patterns", "risk_level", "explanation", "subject"],
                "sender_analysis": ["domain_risk", "suspicious_elements", "explanation", "sender"],
                "content_analysis": ["suspicious_elements", "risk_level", "explanation", "content"],
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