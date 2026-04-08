from sqlalchemy import Column, String, Integer, Boolean, JSON, DateTime, ForeignKey, Float
from sqlalchemy.sql import func
from app.db.database import Base

class AgentModel(Base):
    __tablename__ = "agents"

    id             = Column(String, primary_key=True)
    employee_id    = Column(Integer, unique=True, nullable=False)
    name           = Column(String, nullable=False)
    role           = Column(String, nullable=False)
    tier           = Column(String, nullable=False)          # founder/executive/manager/worker
    department     = Column(String, nullable=False)
    model          = Column(String, nullable=False)
    personality_note = Column(String, default="")
    skills         = Column(JSON, default=[])
    status         = Column(String, default="idle")          # idle/thinking/working/chatting/training/terminated
    hired_at       = Column(DateTime, server_default=func.now())
    strikes        = Column(JSON, default=[])
    rewards        = Column(JSON, default=[])
    manager_id     = Column(String, ForeignKey("agents.id"), nullable=True)
    direct_reports = Column(JSON, default=[])
    memory_context = Column(String, default="")
    is_founder     = Column(Boolean, default=False)
    tile_x         = Column(Integer, default=0)
    tile_y         = Column(Integer, default=0)
    is_active      = Column(Boolean, default=True)
    quality_score  = Column(Float, default=100.0)
    created_at     = Column(DateTime, server_default=func.now())
