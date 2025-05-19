"""
This module contains the MetadataAgent class responsible for extracting and validating email metadata.
"""

import logging
import json
from typing import Dict, Any, Callable
import traceback

logger = logging.getLogger(__name__)

class MetadataAgent:
    """Agent responsible for extracting and validating email metadata."""
    
    def __init__(self, make_request: Callable):
        """Initialize the metadata agent with the request function."""
        self.make_request = make_request
        
    def extract_metadata(self, email_data: Dict[str, str]) -> Dict[str, Any]:
        """Extract and validate email metadata."""
        try:
            messages = [
                {
                    "role": "system",
                    "content": """You are an email metadata expert. Extract and validate key information from the email.
                    
Rules:
1. Extract subject, sender, and content
2. Validate email format and structure
3. Identify any missing or malformed data
4. Return a structured metadata object with the following format:
{
    "subject": {
        "text": "original subject",
        "is_valid": true/false,
        "issues": ["list of issues if any"]
    },
    "sender": {
        "email": "sender@domain.com",
        "name": "sender name",
        "domain": "domain.com",
        "is_valid": true/false,
        "issues": ["list of issues if any"]
    },
    "content": {
        "text": "email content",
        "length": number of characters,
        "has_links": true/false,
        "has_attachments": true/false
    }
}

IMPORTANT: You must return ONLY a valid JSON object. Do not include any text before or after the JSON object. Do not use markdown formatting."""
                },
                {
                    "role": "user",
                    "content": f"""Extract metadata from this email:
                    
Subject: {email_data.get('subject', '')}
Sender: {email_data.get('sender', '')}
Content: {email_data.get('content', '')}"""
                }
            ]
            
            logger.debug(f"Making request to AI model with messages: {json.dumps(messages, indent=2)}")
            response = self.make_request({
                "messages": messages,
                "model": "microsoft/phi-4-reasoning-plus:free",
                "temperature": 0.1,
                "max_tokens": 500,
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
                metadata = json.loads(content)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response: {str(e)}")
                logger.error(f"Raw content: {content}")
                # Try to create a basic metadata structure as fallback
                metadata = {
                    "subject": {
                        "text": email_data.get('subject', ''),
                        "is_valid": True,
                        "issues": []
                    },
                    "sender": {
                        "email": email_data.get('sender', ''),
                        "name": email_data.get('sender', ''),
                        "domain": email_data.get('sender', '').split('@')[-1] if '@' in email_data.get('sender', '') else '',
                        "is_valid": True,
                        "issues": []
                    },
                    "content": {
                        "text": email_data.get('content', ''),
                        "length": len(email_data.get('content', '')),
                        "has_links": 'http' in email_data.get('content', '').lower(),
                        "has_attachments": False
                    }
                }
                logger.info("Using fallback metadata structure")
            
            # Validate the metadata structure
            if not self._validate_metadata_structure(metadata):
                logger.error(f"Invalid metadata structure: {json.dumps(metadata, indent=2)}")
                raise ValueError("Invalid metadata structure")
                
            return metadata
                
        except Exception as e:
            logger.error(f"Error in metadata extraction: {str(e)}")
            logger.error(f"Error traceback: {traceback.format_exc()}")
            raise
            
    def _validate_metadata_structure(self, metadata: Dict[str, Any]) -> bool:
        """Validate that the metadata has the required structure."""
        try:
            required_fields = {
                "subject": ["text", "is_valid", "issues"],
                "sender": ["email", "name", "domain", "is_valid", "issues"],
                "content": ["text", "length", "has_links", "has_attachments"]
            }
            
            # Check if all required sections exist
            if not all(section in metadata for section in required_fields):
                return False
                
            # Check if all required fields exist in each section
            for section, fields in required_fields.items():
                if not all(field in metadata[section] for field in fields):
                    return False
                    
            return True
            
        except Exception as e:
            logger.error(f"Error validating metadata structure: {str(e)}")
            return False 