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
- Ask specific, targeted questions
- Include context before each question
- DO NOT analyze or explain, just ask questions
- DO NOT ask if the message is a phishing attempt
- DO NOT use generic questions
- Your response MUST follow this exact format with all three sections"""
                },
                {
                    "role": "user",
                    "content": f"Subject: {email_data.get('subject', '')}\nSender: {email_data.get('sender', '')}\nContent: {email_data.get('content', '')}"
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
   
   ❓ [Your specific question]"""
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
            
            # Get the next question
            question = category_questions[state["current_question_index"]]
            
            # Add the context based on category with proper line breaks
            if current_category == "subject":
                context = f"🔎 \"The subject says: '{state['email_subject']}'\"\n\n"
            elif current_category == "sender":
                context = f"📧 \"The sender is shown as: {state['email_sender']}\"\n\n"
            else:  # content
                context = f"📨 \"The message contains various content elements\"\n\n"
            
            return context + "❓ " + question
            
        except Exception as e:
            logger.error(f"Error getting next question: {str(e)}")
            return "❓ Can you tell me more about what makes this email seem suspicious or legitimate to you?"

    def _generate_fallback_analysis(self, email_data: Dict[str, str]) -> Dict[str, Any]:
        """Generate a fallback analysis when the API is unavailable."""
        try:
            # Extract key information from the email
            subject = email_data.get('subject', '').strip()
            content = email_data.get('content', '').strip()
            sender = email_data.get('sender', '').strip()
            
            # Generate contextual questions based on email content
            questions_by_category = {
                "subject": [
                    self._generate_subject_question(subject),
                    "Have you received similar emails from this sender before?"
                ],
                "sender": [
                    self._generate_sender_question(sender),
                    "Does the sender's name and email address seem legitimate for this type of communication?"
                ],
                "content": [
                    self._generate_content_question(content, subject),
                    "Are there any urgent requests or threats in the email that require immediate action?"
                ]
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
            return {
                "questions": "❓ Can you tell me more about what makes this email seem suspicious or legitimate to you?",
                "chat_id": str(uuid.uuid4()),
                "current_category": "subject"
            }

    def _generate_subject_question(self, subject: str) -> str:
        """Generate a contextual question about the subject line."""
        subject_lower = subject.lower()
        
        # Check for common phishing subject patterns
        if any(word in subject_lower for word in ['urgent', 'immediate', 'action required', 'verify', 'verification']):
            return "Does this urgent verification request seem legitimate for your account?"
        elif any(word in subject_lower for word in ['suspicious', 'unusual', 'unrecognized', 'signin', 'login']):
            return "Have you recently attempted to access your account or received similar security alerts?"
        elif any(word in subject_lower for word in ['offer', 'promotion', 'discount', 'free', 'bonus']):
            return "Does this promotional offer seem too good to be true or unexpected?"
        elif any(word in subject_lower for word in ['payment', 'invoice', 'receipt', 'transaction']):
            return "Are you expecting any payments or transactions related to this email?"
        elif any(word in subject_lower for word in ['password', 'security', 'account', 'access']):
            return "Have you recently requested any account changes or security updates?"
        else:
            return "Does this subject line match any recent actions you've taken or communications you're expecting?"

    def _generate_sender_question(self, sender: str) -> str:
        """Generate a contextual question about the sender."""
        sender_lower = sender.lower()
        
        # Extract domain if present
        domain = ""
        if '@' in sender:
            domain = sender.split('@')[-1].strip('>')
        
        # Check for common patterns
        if 'noreply' in sender_lower or 'no-reply' in sender_lower:
            return "Do you typically receive important communications from no-reply addresses?"
        elif domain and any(d in domain for d in ['gmail.com', 'yahoo.com', 'hotmail.com']):
            return "Would you expect this type of communication from a personal email domain?"
        elif 'security' in sender_lower or 'verify' in sender_lower:
            return "Is this the usual way you receive security notifications from this service?"
        else:
            return "Is this a sender you recognize or have received emails from before?"

    def _generate_content_question(self, content: str, subject: str) -> str:
        """Generate a contextual question about the email content."""
        content_lower = content.lower()
        subject_lower = subject.lower()
        
        # Check for common phishing content patterns
        if any(word in content_lower for word in ['click here', 'verify now', 'update now', 'confirm now']):
            return "Does the email pressure you to take immediate action?"
        elif any(word in content_lower for word in ['password', 'username', 'account', 'login']):
            return "Does the email ask for sensitive information like passwords or account details?"
        elif any(word in content_lower for word in ['suspended', 'disabled', 'blocked', 'terminated']):
            return "Have you received any prior notifications about your account status?"
        elif any(word in content_lower for word in ['payment', 'invoice', 'transaction', 'purchase']):
            return "Are you expecting any payments or transactions mentioned in the email?"
        elif 'http' in content_lower or 'www.' in content_lower:
            return "Do the links in the email point to legitimate websites you trust?"
        else:
            return "Does the content of the email match what you would expect from the subject line?"

    def _generate_fallback_conversation_response(self, chat_id: str, state: Dict[str, Any], user_message: str) -> Dict[str, Any]:
        """Generate a fallback response when the API is unavailable during conversation."""
        try:
            current_category = state["current_category"]
            previous_responses = state["user_responses"]
            
            # Generate a contextual follow-up based on previous responses
            if current_category == "subject":
                if "no" in user_message.lower():
                    question = f"""🔎 "The subject says: '{state['email_subject']}'"

❓ What specific elements in the subject line make it seem suspicious to you?"""
                else:
                    question = f"""🔎 "The subject says: '{state['email_subject']}'"

❓ Can you explain why this subject line seems legitimate to you?"""
                    
            elif current_category == "sender":
                if "no" in user_message.lower() or "maybe" in user_message.lower():
                    question = f"""📧 "The sender is shown as: {state['email_sender']}"

❓ What aspects of the sender's information seem suspicious to you?"""
                else:
                    question = f"""📧 "The sender is shown as: {state['email_sender']}"

❓ How do you know this sender is legitimate?"""
                    
            else:  # content
                if "yes" in user_message.lower():
                    question = f"""📨 "The message contains various content elements"

❓ What specific urgent requests or threats did you notice in the email?"""
                else:
                    question = f"""📨 "The message contains various content elements"

❓ What aspects of the email content seem legitimate to you?"""
            
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
            return {
                "questions": "❓ Can you tell me more about what makes this email seem suspicious or legitimate to you?",
                "chat_id": chat_id,
                "current_category": state.get("current_category", "subject")
            } 