"""
This module contains the configuration and setup of all AI agents used in the email analysis system.
Each agent has a specific role in analyzing emails and detecting phishing attempts.
"""

import logging
import json
from typing import List, Dict, Any, Callable
import uuid

logger = logging.getLogger(__name__)

class EmailAgents:
    """
    A class that manages all AI agents used in the email analysis system.
    Each agent has a specific role and is configured with appropriate system messages and parameters.
    """
    
    def __init__(self, make_request: Callable):
        """Initialize the email analysis agents with the provided request function."""
        self.make_request = make_request
        self.analysis_state = {}  # Store analysis state for each chat

    def analyze_email(self, email_data: Dict[str, str], initial_scan_result: Dict[str, Any] = None) -> Dict[str, Any]:
        """Analyze an email using the AI agent."""
        try:
            # First, analyze the email metadata and structure
            metadata_messages = [
                {
                    "role": "system",
                    "content": """You are a cybersecurity expert analyzing suspicious emails. Your task is to generate a structured set of questions about the email, focusing on different aspects.

Format your response EXACTLY like this example:

1. About the Subject Line:
🔎 "The subject says: '[Subject text]'"
❓ [Question about subject line]
❓ [Follow-up question about subject line]

2. About the Sender Domain:
📧 "The sender is shown as: [Sender name] [sender@domain.com]"
❓ [Question about sender domain]
❓ [Follow-up question about sender domain]

3. About the Body Content:
📨 "The message says: '[Relevant quote from content]'"
❓ [Question about content]
❓ [Follow-up question about content]

IMPORTANT RULES:
- Use the exact emojis shown (🔎, 📧, 📨, ❓)
- Always quote the actual text from the email
- Focus on suspicious elements in each category
- Ask specific, targeted questions based on the actual content
- Include context before each question
- DO NOT analyze or explain, just ask questions
- DO NOT ask if the message is a phishing attempt
- DO NOT use generic questions
- Your response MUST follow this exact format with all three sections
- Questions MUST be specific to the email's content and context
- Use the actual email content to form unique questions
- Consider the relationship between subject, sender, and content when forming questions"""
                },
                {
                    "role": "user",
                    "content": f"""Analyze this email and generate specific questions:

Subject: {email_data.get('subject', '')}
Sender: {email_data.get('sender', '')}
Content: {email_data.get('content', '')}

Focus on:
1. Unusual patterns in the subject line
2. Suspicious sender information
3. Specific content elements that seem out of place
4. Relationships between different parts of the email"""
                }
            ]
            
            try:
                payload = {
                    "messages": metadata_messages,
                    "model": "microsoft/phi-4-reasoning-plus:free",
                    "temperature": 0.1,
                    "top_p": 0.1,
                    "max_tokens": 500,
                    "stream": False
                }
                response = self.make_request(payload)
                
                # Process the response
                if not response or "choices" not in response or not response["choices"]:
                    raise ValueError("Invalid response format from AI")
                    
                all_questions = response["choices"][0]["message"]["content"].strip()
                
                # Validate the response format
                if not self._validate_questions_format(all_questions):
                    logger.warning("AI response did not follow required format, using fallback analysis")
                    return self._generate_fallback_analysis(email_data)
                
                # Extract the first question from each category
                questions_by_category = self._extract_questions_by_category(all_questions)
                
                # Store initial analysis state with all questions
                chat_id = str(uuid.uuid4())
                self.analysis_state[chat_id] = {
                    "questions_asked": 0,
                    "max_questions": 6,  # Total number of questions (2 per category)
                    "user_responses": [],
                    "email_subject": email_data.get('subject', ''),
                    "email_content": email_data.get('content', ''),
                    "email_sender": email_data.get('sender', ''),
                    "current_category": "subject",
                    "categories": ["subject", "sender", "content"],
                    "category_index": 0,
                    "all_questions": questions_by_category,  # Store all questions for future use
                    "current_question_index": 0  # Track which question we're on
                }
                
                # Return only the first question
                first_question = self._get_next_question(chat_id)
                
                return {
                    "questions": first_question,
                    "chat_id": chat_id,
                    "current_category": "subject"
                }
            except ValueError as e:
                if "rate limit exceeded" in str(e).lower():
                    logger.warning("Rate limit exceeded, using fallback analysis")
                    return self._generate_fallback_analysis(email_data)
                raise
            
        except Exception as e:
            logger.error(f"Error in email analysis: {str(e)}")
            return self._generate_fallback_analysis(email_data)

    def _validate_questions_format(self, questions: str) -> bool:
        """Validate that the questions follow our required format."""
        try:
            # Check for required sections
            required_sections = [
                "1. About the Subject Line:",
                "2. About the Sender Domain:",
                "3. About the Body Content:"
            ]
            
            # Check for required emojis
            required_emojis = ["🔎", "📧", "📨", "❓"]
            
            # Check if all sections are present
            if not all(section in questions for section in required_sections):
                return False
                
            # Check if all emojis are present
            if not all(emoji in questions for emoji in required_emojis):
                return False
                
            # Check if there are at least 6 questions (2 per section)
            question_count = questions.count("❓")
            if question_count < 6:
                return False
                
            return True
            
        except Exception as e:
            logger.error(f"Error validating questions format: {str(e)}")
            return False

    def prepare_request(self, messages: List[Dict[str, str]], temperature: float = 0.1) -> Dict[str, Any]:
        """Prepare the request payload for the AI model."""
        try:
            return {
                "messages": messages,
                "model": "microsoft/phi-4-reasoning-plus:free",
                "temperature": temperature,  # Use very low temperature for more deterministic output
                "max_tokens": 100,  # Limit response length
                "stream": False
            }
            
        except Exception as e:
            logger.error(f"Error preparing AI request: {str(e)}")
            raise

    def continue_conversation(self, chat_id: str, user_message: str, conversation_summary: List[Dict[str, str]]) -> Dict[str, Any]:
        """Continue a conversation with the AI agent."""
        try:
            # Get the current state for this chat
            state = self.analysis_state.get(chat_id)
            if not state:
                raise ValueError("Invalid chat ID")
            
            # Add the user's response to the state
            state["user_responses"].append(user_message)
            state["questions_asked"] += 1
            
            # If we've asked enough questions, calculate final risk score
            if state["questions_asked"] >= state["max_questions"]:
                return self._calculate_final_risk(chat_id, state)
            
            # Prepare conversation context for the AI
            messages = [
                {
                    "role": "system",
                    "content": f"""You are a cybersecurity expert analyzing a suspicious email. Your task is to ask ONE specific follow-up question based on the email content and previous responses.

Current Category: {state['current_category']}
Email Subject: {state['email_subject']}
Email Sender: {state['email_sender']}
Email Content: {state['email_content']}

Previous Q&A:
{self._format_conversation_history(conversation_summary)}

Rules:
1. Ask ONE specific question that builds on previous responses
2. Focus on suspicious elements in the current category
3. Use the exact emojis shown (🔎 for subject, 📧 for sender, 📨 for content)
4. Always provide context before the question
5. Make the question specific to this email and previous responses
6. DO NOT analyze or explain
7. DO NOT ask if the message is a phishing attempt
8. Format your response as:
   [Context with emoji]
   
   ❓ [Your specific question]
9. Consider the relationship between the current category and previous responses
10. Use specific details from the email to form your question
11. Avoid generic questions that could apply to any email
12. Build upon the user's previous responses to create a more focused analysis"""
                }
            ]
            
            try:
                # Try to get a contextual question from the AI
                response = self.make_request({
                    "messages": messages,
                    "model": "microsoft/phi-4-reasoning-plus:free",
                    "temperature": 0.1,
                    "max_tokens": 200,
                    "stream": False
                })
                
                if response and "choices" in response and response["choices"]:
                    question = response["choices"][0]["message"]["content"].strip()
                    
                    # Validate the question format
                    if self._validate_question_format(question):
                        # Update state and return the question
                        state["current_question_index"] += 1
                        if state["current_question_index"] >= 2:  # After 2 questions in a category
                            state["category_index"] = (state["category_index"] + 1) % len(state["categories"])
                            state["current_category"] = state["categories"][state["category_index"]]
                            state["current_question_index"] = 0
                        
                        self.analysis_state[chat_id] = state
                        return {
                            "questions": question,
                            "chat_id": chat_id,
                            "current_category": state["current_category"]
                        }
                
                # If AI response is invalid, use fallback
                logger.warning("AI response invalid, using fallback question")
                return self._generate_fallback_conversation_response(chat_id, state, user_message)
                
            except Exception as e:
                logger.warning(f"Error getting AI response: {str(e)}, using fallback")
                return self._generate_fallback_conversation_response(chat_id, state, user_message)
            
        except Exception as e:
            logger.error(f"Error in conversation continuation: {str(e)}")
            return self._generate_fallback_conversation_response(chat_id, state, user_message)

    def _format_conversation_history(self, conversation_summary: List[Dict[str, str]]) -> str:
        """Format the conversation history for the AI prompt."""
        formatted_history = []
        for qa in conversation_summary:
            formatted_history.append(f"Q: {qa['question']}")
            formatted_history.append(f"A: {qa['answer']}")
        return "\n".join(formatted_history)

    def _validate_question_format(self, question: str) -> bool:
        """Validate that the question follows our required format."""
        try:
            # Check for required emojis
            required_emojis = ["🔎", "📧", "📨"]
            has_emoji = any(emoji in question for emoji in required_emojis)
            
            # Check for question mark
            has_question = "❓" in question
            
            # Check for line break between context and question
            has_line_break = "\n\n" in question
            
            return has_emoji and has_question and has_line_break
            
        except Exception as e:
            logger.error(f"Error validating question format: {str(e)}")
            return False

    def _process_initial_analysis(self, response: Dict[str, Any], email_data: Dict[str, str]) -> Dict[str, Any]:
        """Process the initial analysis response from the AI."""
        try:
            if not response or "choices" not in response or not response["choices"]:
                raise ValueError("Invalid response format from AI")
                
            question = response["choices"][0]["message"]["content"].strip()
            
            # Ensure we only have a question
            if not question.endswith("?"):
                question = question + "?"
            
            # Store initial analysis state
            chat_id = str(uuid.uuid4())
            self.analysis_state[chat_id] = {
                "questions_asked": 0,
                "max_questions": 5,
                "user_responses": [],
                "email_subject": email_data.get('subject', ''),
                "email_content": email_data.get('content', '')
            }
            
            return {
                "question": question,
                "chat_id": chat_id
            }
            
        except Exception as e:
            logger.error(f"Error processing initial analysis: {str(e)}")
            raise
            
    def _process_conversation_response(self, response: Dict[str, Any], chat_id: str, state: Dict[str, Any]) -> Dict[str, Any]:
        """Process the conversation response from the AI."""
        try:
            if not response or "choices" not in response or not response["choices"]:
                raise ValueError("Invalid response format from AI")
                
            question = response["choices"][0]["message"]["content"].strip()
            
            # Update state
            self.analysis_state[chat_id] = state
            
            return {
                "question": question,
                "chat_id": chat_id
            }
            
        except Exception as e:
            logger.error(f"Error processing conversation response: {str(e)}")
            raise
            
    def _calculate_final_risk(self, chat_id: str, state: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate the final risk score based on all analysis and user responses."""
        try:
            messages = [
                {
                    "role": "system",
                    "content": """You are a cybersecurity expert calculating a final risk score for an email analysis.
                    Consider:
                    1. Initial email analysis
                    2. User responses to questions
                    3. All identified suspicious elements
                    
                    Provide a final analysis and a risk score between 0 and 1.
                    Format your response as:
                    ANALYSIS:
                    [Your detailed analysis]
                    
                    RISK SCORE: [score between 0 and 1]
                    
                    RECOMMENDATION:
                    [Your final recommendation]"""
                },
                {
                    "role": "user",
                    "content": f"""Please calculate the final risk score based on this analysis:

Original Email:
Subject: {state['email_subject']}
Content: {state['email_content']}

Analysis Points:
{json.dumps(state['analysis_points'], indent=2)}

User Responses:
{json.dumps(state['user_responses'], indent=2)}"""
                }
            ]
            
            response = self.make_request(messages)
            content = response["choices"][0]["message"]["content"]
            
            # Extract the risk score
            score = self._extract_risk_score(content)
            
            return {
                "analysis": content,
                "score": score,
                "chat_id": chat_id,
                "is_final": True
            }
            
        except Exception as e:
            logger.error(f"Error calculating final risk: {str(e)}")
            raise
            
    def _extract_risk_score(self, content: str) -> float:
        """Extract a risk score from the analysis content."""
        try:
            # Look for explicit risk score mentions
            if "risk score:" in content.lower():
                score_text = content.lower().split("risk score:")[1].split()[0]
                try:
                    score = float(score_text)
                    return min(max(score, 0), 1)  # Ensure score is between 0 and 1
                except ValueError:
                    pass
                    
            # If no explicit score, estimate based on content
            risk_indicators = {
                "high risk": 0.9,
                "severe": 0.9,
                "critical": 0.9,
                "very suspicious": 0.8,
                "likely phishing": 0.8,
                "suspicious": 0.7,
                "concerning": 0.6,
                "moderate risk": 0.5,
                "potential risk": 0.4,
                "low risk": 0.2,
                "safe": 0.1,
                "legitimate": 0.1
            }
            
            content_lower = content.lower()
            for indicator, score in risk_indicators.items():
                if indicator in content_lower:
                    return score
                    
            return 0.5  # Default to medium risk if no indicators found
            
        except Exception as e:
            logger.error(f"Error extracting risk score: {str(e)}")
            return 0.5  # Default to medium risk on error 

    def _extract_questions_by_category(self, questions_text: str) -> Dict[str, List[str]]:
        """Extract questions from the AI response and organize them by category."""
        try:
            categories = {
                "subject": [],
                "sender": [],
                "content": []
            }
            
            # Split the text into sections
            sections = questions_text.split("\n\n")
            
            for section in sections:
                if "About the Subject Line:" in section:
                    questions = [q.strip() for q in section.split("❓") if q.strip() and "🔎" not in q]
                    categories["subject"] = questions
                elif "About the Sender Domain:" in section:
                    questions = [q.strip() for q in section.split("❓") if q.strip() and "📧" not in q]
                    categories["sender"] = questions
                elif "About the Body Content:" in section:
                    questions = [q.strip() for q in section.split("❓") if q.strip() and "📨" not in q]
                    categories["content"] = questions
            
            return categories
            
        except Exception as e:
            logger.error(f"Error extracting questions by category: {str(e)}")
            return {
                "subject": ["Does this subject line seem suspicious to you?"],
                "sender": ["Is this a sender you recognize?"],
                "content": ["Does the content of this email seem legitimate?"]
            }

    def _get_next_question(self, chat_id: str) -> str:
        """Get the next question to ask based on the current state."""
        try:
            state = self.analysis_state[chat_id]
            all_questions = state["all_questions"]
            current_category = state["current_category"]
            current_question_index = state["current_question_index"]
            
            # Get the current category's questions
            category_questions = all_questions[current_category]
            
            # If we've asked all questions in this category, move to the next category
            if current_question_index >= len(category_questions):
                state["category_index"] = (state["category_index"] + 1) % len(state["categories"])
                state["current_category"] = state["categories"][state["category_index"]]
                state["current_question_index"] = 0
                current_category = state["current_category"]
                category_questions = all_questions[current_category]
            
            # Get the next question (it already includes the context)
            return category_questions[state["current_question_index"]]
            
        except Exception as e:
            logger.error(f"Error getting next question: {str(e)}")
            # If we can't get the next question, try to generate a new one using AI
            try:
                return self._generate_ai_question(chat_id)
            except ValueError as ve:
                # If AI generation fails, return an error message that can be handled by the frontend
                return "ERROR: Unable to generate a question at this time. Please try again."

    def _generate_ai_question(self, chat_id: str) -> str:
        """Generate a new question using AI."""
        try:
            state = self.analysis_state[chat_id]
            current_category = state["current_category"]
            
            messages = [
                {
                    "role": "system",
                    "content": f"""You are an email analysis expert helping users understand their emails better. Generate a specific question about the email content.

Current Category: {current_category}
Email Subject: {state['email_subject']}
Email Sender: {state['email_sender']}
Email Content: {state['email_content']}

Rules:
1. Generate ONE specific question about the email
2. Focus on the current category ({current_category})
3. Use the exact emoji for the category (🔎 for subject, 📧 for sender, 📨 for content)
4. Make the question specific to the actual email content
5. Help the user understand the email better
6. Format your response as:
   [Context with emoji]
   
   ❓ [Your specific question]"""
                }
            ]
            
            # First attempt with full context
            response = self.make_request({
                "messages": messages,
                "model": "microsoft/phi-4-reasoning-plus:free",
                "temperature": 0.7,
                "max_tokens": 200,
                "stream": False
            })
            
            if response and "choices" in response and response["choices"]:
                return response["choices"][0]["message"]["content"].strip()
            
            # Second attempt with simpler prompt
            messages = [
                {
                    "role": "system",
                    "content": f"""Generate a question about this email:

Category: {current_category}
Subject: {state['email_subject']}
Sender: {state['email_sender']}
Content: {state['email_content'][:100]}...

Format: [Context with emoji] ❓ [Question]"""
                }
            ]
            
            response = self.make_request({
                "messages": messages,
                "model": "microsoft/phi-4-reasoning-plus:free",
                "temperature": 0.7,
                "max_tokens": 200,
                "stream": False
            })
            
            if response and "choices" in response and response["choices"]:
                return response["choices"][0]["message"]["content"].strip()
            
            # If both attempts fail, raise an error to be handled by the caller
            raise ValueError("Failed to generate AI question after multiple attempts")
                
        except Exception as e:
            logger.error(f"Error generating AI question: {str(e)}")
            # Instead of returning a hardcoded question, raise the error
            raise ValueError("Unable to generate a question at this time. Please try again.")

    def _generate_fallback_analysis(self, email_data: Dict[str, str]) -> Dict[str, Any]:
        """Generate a fallback analysis when the API is unavailable."""
        try:
            # Extract key information from the email
            subject = email_data.get('subject', '').strip()
            content = email_data.get('content', '').strip()
            sender = email_data.get('sender', '').strip()
            
            # Create a more sophisticated prompt for the AI
            fallback_messages = [
                {
                    "role": "system",
                    "content": """You are an email analysis expert helping users understand their emails better. Generate unique, context-aware questions about the email's content.

Rules:
1. Generate questions that are SPECIFIC to this email's content
2. Focus on helping users understand the email better
3. Consider relationships between subject, sender, and content
4. Use the exact emojis shown (🔎 for subject, 📧 for sender, 📨 for content)
5. Format each question with context and emoji
6. DO NOT use generic or template questions
7. Format your response as:
   [Context with emoji]
   
   ❓ [Your specific question]"""
                },
                {
                    "role": "user",
                    "content": f"""Generate unique questions about this email:

Subject: {subject}
Sender: {sender}
Content: {content}

Focus on:
1. Understanding the subject line
2. Understanding the sender information
3. Understanding the content
4. Relationships between different parts of the email"""
                }
            ]
            
            try:
                # Try to get questions from the AI
                response = self.make_request({
                    "messages": fallback_messages,
                    "model": "microsoft/phi-4-reasoning-plus:free",
                    "temperature": 0.7,  # Increased temperature for more creative questions
                    "max_tokens": 500,
                    "stream": False
                })
                
                if response and "choices" in response and response["choices"]:
                    all_questions = response["choices"][0]["message"]["content"].strip()
                    
                    # Extract questions by category
                    questions_by_category = self._extract_questions_by_category(all_questions)
                else:
                    raise ValueError("Invalid response from AI")
                    
            except Exception as e:
                logger.error(f"Error getting AI response in fallback: {str(e)}")
                # If AI fails, try one more time with a simpler prompt
                try:
                    messages = [
                        {
                            "role": "system",
                            "content": f"""Generate questions about this email:

Subject: {subject}
Sender: {sender}
Content: {content[:100]}...

Format: [Context with emoji] ❓ [Question]"""
                        }
                    ]
                    
                    response = self.make_request({
                        "messages": messages,
                        "model": "microsoft/phi-4-reasoning-plus:free",
                        "temperature": 0.7,
                        "max_tokens": 500,
                        "stream": False
                    })
                    
                    if response and "choices" in response and response["choices"]:
                        all_questions = response["choices"][0]["message"]["content"].strip()
                        questions_by_category = self._extract_questions_by_category(all_questions)
                    else:
                        raise ValueError("Invalid response from AI")
                except:
                    # If all AI attempts fail, return an error
                    return {
                        "questions": "ERROR: Unable to analyze the email at this time. Please try again.",
                        "chat_id": str(uuid.uuid4()),
                        "current_category": "subject"
            }
            
            # Generate a chat ID
            chat_id = str(uuid.uuid4())
            
            # Store the analysis state
            self.analysis_state[chat_id] = {
                "questions_asked": 0,
                "max_questions": 6,
                "user_responses": [],
                "email_subject": subject,
                "email_content": content,
                "email_sender": sender,
                "current_category": "subject",
                "categories": ["subject", "sender", "content"],
                "category_index": 0,
                "all_questions": questions_by_category,
                "current_question_index": 0
            }
            
            # Get the first question
            first_question = self._get_next_question(chat_id)
            
            return {
                "questions": first_question,
                "chat_id": chat_id,
                "current_category": "subject"
            }
            
        except Exception as e:
            logger.error(f"Error generating fallback analysis: {str(e)}")
            # Return an error message instead of a hardcoded question
            return {
                "questions": "ERROR: Unable to analyze the email at this time. Please try again.",
                "chat_id": str(uuid.uuid4()),
                "current_category": "subject"
            }

    def _generate_fallback_conversation_response(self, chat_id: str, state: Dict[str, Any], user_message: str) -> Dict[str, Any]:
        """Generate a fallback response when the API is unavailable during conversation."""
        try:
            current_category = state["current_category"]
            previous_responses = state["user_responses"]
            
            # Create a prompt for generating follow-up questions
            followup_messages = [
                {
                    "role": "system",
                    "content": f"""You are a cybersecurity expert analyzing a suspicious email. Generate a specific follow-up question based on the user's previous response.

Current Category: {current_category}
Email Subject: {state['email_subject']}
Email Sender: {state['email_sender']}
Email Content: {state['email_content']}

Previous Response: {user_message}

Rules:
1. Generate ONE specific follow-up question
2. Focus on the current category ({current_category})
3. Use the exact emoji for the category (🔎 for subject, 📧 for sender, 📨 for content)
4. Make the question specific to the email content and previous response
5. DO NOT use generic or template questions
6. DO NOT ask if the message is a phishing attempt
7. Format your response as:
   [Context with emoji]
   
   ❓ [Your specific question]"""
                }
            ]
            
            try:
                # Try to get a follow-up question from the AI
                response = self.make_request({
                    "messages": followup_messages,
                    "model": "microsoft/phi-4-reasoning-plus:free",
                    "temperature": 0.7,
                    "max_tokens": 200,
                    "stream": False
                })
                
                if response and "choices" in response and response["choices"]:
                    question = response["choices"][0]["message"]["content"].strip()
                else:
                    raise ValueError("Invalid response from AI")
                    
            except Exception as e:
                logger.error(f"Error getting AI response in fallback conversation: {str(e)}")
                # If AI fails, use a very basic question
                if current_category == "subject":
                    question = f"""🔎 "The subject says: '{state['email_subject']}'"

❓ What specific elements in the subject line seem unusual?"""
            elif current_category == "sender":
                    question = f"""📧 "The sender is shown as: {state['email_sender']}"

❓ What aspects of the sender's information seem suspicious?"""
            else:  # content
                    question = f"""📨 "The message contains: {state['email_content'][:100]}..."

❓ What specific elements in the content seem concerning?"""
            
            # Update state
            state["current_question_index"] += 1
            if state["current_question_index"] >= 2:  # After 2 questions in a category
                state["category_index"] = (state["category_index"] + 1) % len(state["categories"])
                state["current_category"] = state["categories"][state["category_index"]]
                state["current_question_index"] = 0
            
            self.analysis_state[chat_id] = state
            
            return {
                "questions": question,
                "chat_id": chat_id,
                "current_category": state["current_category"]
            }
            
        except Exception as e:
            logger.error(f"Error generating fallback conversation response: {str(e)}")
            # Even in the worst case, provide a specific question based on the current category
            if current_category == "subject":
                question = f"""🔎 "The subject says: '{state['email_subject']}'"

❓ What specific elements in the subject line caught your attention?"""
            elif current_category == "sender":
                question = f"""📧 "The sender is shown as: {state['email_sender']}"

❓ What aspects of the sender's information caught your attention?"""
            else:  # content
                question = f"""📨 "The message contains: {state['email_content'][:100]}..."

❓ What specific elements in the content caught your attention?"""
            
            return {
                "questions": question,
                "chat_id": chat_id,
                "current_category": state.get("current_category", "subject")
            } 