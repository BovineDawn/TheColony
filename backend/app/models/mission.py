from sqlalchemy import Column, String, Integer, Boolean, JSON, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.db.database import Base

class ColonyModel(Base):
    __tablename__ = "colony"

    id               = Column(String, primary_key=True)
    name             = Column(String, nullable=False)
    founded_at       = Column(DateTime, server_default=func.now())
    phase            = Column(String, default="onboarding")
    next_employee_id = Column(Integer, default=2)

class MissionModel(Base):
    __tablename__ = "missions"

    id          = Column(String, primary_key=True)
    title       = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    priority    = Column(String, default="normal")
    status      = Column(String, default="pending")
    created_at  = Column(DateTime, server_default=func.now())
    assigned_to = Column(JSON, default=[])
    result      = Column(Text, nullable=True)

class MessageModel(Base):
    __tablename__ = "messages"

    id            = Column(String, primary_key=True)
    mission_id    = Column(String, ForeignKey("missions.id"), nullable=True)
    from_agent_id = Column(String, nullable=False)
    to_agent_id   = Column(String, nullable=False)
    content       = Column(Text, nullable=False)
    msg_type      = Column(String, default="chat")   # chat/formal_report/escalation/update
    is_read       = Column(Boolean, default=False)
    is_internal   = Column(Boolean, default=False)  # internal = agent-to-agent, not shown by default
    created_at    = Column(DateTime, server_default=func.now())
