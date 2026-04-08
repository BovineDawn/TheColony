from sqlalchemy import Column, String, Integer, Boolean, JSON, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.db.database import Base

class StrikeModel(Base):
    __tablename__ = "strikes"

    id                 = Column(String, primary_key=True)
    agent_id           = Column(String, ForeignKey("agents.id"), nullable=False)
    reason             = Column(Text, nullable=False)
    severity           = Column(String, default="minor")
    strike_number      = Column(Integer, default=1)
    issued_by          = Column(String, default="founder")
    resolved           = Column(Boolean, default=False)
    training_completed = Column(Boolean, default=False)
    created_at         = Column(DateTime, server_default=func.now())
    resolved_at        = Column(DateTime, nullable=True)

class TrainingSessionModel(Base):
    __tablename__ = "training_sessions"

    id           = Column(String, primary_key=True)
    agent_id     = Column(String, ForeignKey("agents.id"), nullable=False)
    strike_id    = Column(String, ForeignKey("strikes.id"), nullable=True)
    reason       = Column(Text, nullable=False)
    status       = Column(String, default="scheduled")  # scheduled|active|completed
    severity     = Column(String, default="minor")
    created_at   = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)

class HiringRecModel(Base):
    __tablename__ = "hiring_recommendations"

    id                   = Column(String, primary_key=True)
    department           = Column(String, nullable=False)
    role                 = Column(String, nullable=False)
    candidate_name       = Column(String, nullable=False)
    model                = Column(String, default="claude-3-5-sonnet")
    personality_note     = Column(String, default="")
    skills               = Column(JSON, default=[])
    recommended_by       = Column(String, nullable=False)
    recommendation_text  = Column(Text, nullable=False)
    has_duplicate_warning = Column(Boolean, default=False)
    status               = Column(String, default="pending")  # pending|approved|rejected
    created_at           = Column(DateTime, server_default=func.now())
    approved_at          = Column(DateTime, nullable=True)
    resulting_agent_id   = Column(String, nullable=True)

class RewardModel(Base):
    __tablename__ = "rewards"

    id         = Column(String, primary_key=True)
    agent_id   = Column(String, ForeignKey("agents.id"), nullable=False)
    type       = Column(String, default="commendation")
    title      = Column(String, nullable=False)
    reason     = Column(Text, nullable=False)
    granted_by = Column(String, default="founder")
    created_at = Column(DateTime, server_default=func.now())
