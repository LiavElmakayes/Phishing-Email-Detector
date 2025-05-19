"""
This module contains all the specialized agents for email analysis.
Each agent has a specific role in the analysis process.
"""

from .metadata_agent import MetadataAgent
from .analysis_agent import AnalysisAgent
from .question_agent import QuestionAgent
from .risk_agent import RiskAssessmentAgent

__all__ = [
    'MetadataAgent',
    'AnalysisAgent',
    'QuestionAgent',
    'RiskAssessmentAgent'
] 