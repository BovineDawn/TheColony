from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import uuid, json
from datetime import datetime
from app.db.database import get_db
from app.models.agent import AgentModel

router = APIRouter()

class AgentCreate(BaseModel):
    name: str
    role: str
    tier: str
    department: str
    model: str
    personality_note: str = ""
    skills: list = []
    manager_id: Optional[str] = None
    tile_x: int = 0
    tile_y: int = 0
    is_founder: bool = False

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    model: Optional[str] = None
    memory_context: Optional[str] = None
    strikes: Optional[list] = None
    rewards: Optional[list] = None
    quality_score: Optional[float] = None
    personality_note: Optional[str] = None
    skills: Optional[list] = None
    manager_id: Optional[str] = None

def agent_to_dict(a: AgentModel) -> dict:
    return {
        "id": a.id,
        "employeeId": a.employee_id,
        "name": a.name,
        "role": a.role,
        "tier": a.tier,
        "department": a.department,
        "model": a.model,
        "personalityNote": a.personality_note,
        "skills": a.skills or [],
        "status": a.status,
        "hiredAt": a.hired_at.isoformat() if a.hired_at else "",
        "strikes": a.strikes or [],
        "rewards": a.rewards or [],
        "managerId": a.manager_id,
        "directReports": a.direct_reports or [],
        "memoryContext": a.memory_context or "",
        "isFounder": a.is_founder,
        "tilePosition": {"x": a.tile_x, "y": a.tile_y},
        "qualityScore": a.quality_score,
        "isActive": a.is_active,
    }

@router.get("/")
def list_agents(db: Session = Depends(get_db)):
    agents = db.query(AgentModel).filter(AgentModel.is_active == True).all()
    return [agent_to_dict(a) for a in agents]

@router.post("/")
def create_agent(data: AgentCreate, db: Session = Depends(get_db)):
    # Get next employee ID
    max_id = db.query(AgentModel).count()
    employee_id = max_id + 1

    agent = AgentModel(
        id=str(uuid.uuid4()),
        employee_id=employee_id,
        name=data.name,
        role=data.role,
        tier=data.tier,
        department=data.department,
        model=data.model,
        personality_note=data.personality_note,
        skills=data.skills,
        manager_id=data.manager_id,
        tile_x=data.tile_x,
        tile_y=data.tile_y,
        is_founder=data.is_founder,
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent_to_dict(agent)

@router.patch("/{agent_id}")
def update_agent(agent_id: str, data: AgentUpdate, db: Session = Depends(get_db)):
    agent = db.query(AgentModel).filter(AgentModel.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(agent, field, value)
    db.commit()
    db.refresh(agent)
    return agent_to_dict(agent)

@router.delete("/{agent_id}")
def terminate_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(AgentModel).filter(AgentModel.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent.is_active = False
    agent.status = "terminated"
    db.commit()
    return {"success": True, "employee_id": agent.employee_id}
