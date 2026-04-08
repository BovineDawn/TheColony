from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import uuid
from app.db.database import get_db
from app.models.mission import MissionModel, MessageModel, ColonyModel
from app.models.agent import AgentModel

router = APIRouter()

class MissionCreate(BaseModel):
    title: str
    description: str
    priority: str = "normal"
    msg_type: str = "chat"  # chat or formal_report

class MessageCreate(BaseModel):
    mission_id: Optional[str] = None
    from_agent_id: str
    to_agent_id: str
    content: str
    msg_type: str = "chat"
    is_internal: bool = False

def mission_to_dict(m: MissionModel, messages: list = None) -> dict:
    return {
        "id": m.id,
        "title": m.title,
        "description": m.description,
        "priority": m.priority,
        "status": m.status,
        "createdAt": m.created_at.isoformat() if m.created_at else "",
        "assignedTo": m.assigned_to or [],
        "result": m.result,
        "messages": messages or [],
    }

def message_to_dict(m: MessageModel) -> dict:
    return {
        "id": m.id,
        "missionId": m.mission_id,
        "fromAgentId": m.from_agent_id,
        "toAgentId": m.to_agent_id,
        "content": m.content,
        "type": m.msg_type,
        "isRead": m.is_read,
        "isInternal": m.is_internal,
        "timestamp": m.created_at.isoformat() if m.created_at else "",
    }

@router.get("/")
def list_missions(db: Session = Depends(get_db)):
    missions = db.query(MissionModel).order_by(MissionModel.created_at.desc()).all()
    result = []
    for m in missions:
        msgs = db.query(MessageModel).filter(
            MessageModel.mission_id == m.id,
            MessageModel.is_internal == False,
        ).all()
        result.append(mission_to_dict(m, [message_to_dict(msg) for msg in msgs]))
    return result

@router.get("/messages")
def list_messages(include_internal: bool = False, db: Session = Depends(get_db)):
    query = db.query(MessageModel)
    if not include_internal:
        query = query.filter(MessageModel.is_internal == False)
    msgs = query.order_by(MessageModel.created_at.desc()).limit(100).all()
    return [message_to_dict(m) for m in msgs]

@router.post("/")
def create_mission(data: MissionCreate, db: Session = Depends(get_db)):
    mission = MissionModel(
        id=str(uuid.uuid4()),
        title=data.title,
        description=data.description,
        priority=data.priority,
        status="pending",
    )
    db.add(mission)
    db.commit()
    db.refresh(mission)
    return mission_to_dict(mission)

@router.patch("/{mission_id}")
def update_mission(mission_id: str, updates: dict, db: Session = Depends(get_db)):
    mission = db.query(MissionModel).filter(MissionModel.id == mission_id).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    for k, v in updates.items():
        if hasattr(mission, k):
            setattr(mission, k, v)
    db.commit()
    db.refresh(mission)
    return mission_to_dict(mission)

@router.post("/messages")
def save_message(data: MessageCreate, db: Session = Depends(get_db)):
    msg = MessageModel(
        id=str(uuid.uuid4()),
        mission_id=data.mission_id,
        from_agent_id=data.from_agent_id,
        to_agent_id=data.to_agent_id,
        content=data.content,
        msg_type=data.msg_type,
        is_internal=data.is_internal,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return message_to_dict(msg)
