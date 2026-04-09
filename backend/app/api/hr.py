"""
HR endpoints: strikes, training, hiring recommendations, rewards, promotions.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime

import litellm
from app.db.database import get_db
from app.models.agent import AgentModel
from app.models.hr import StrikeModel, TrainingSessionModel, HiringRecModel, RewardModel

router = APIRouter()

# ── Strike ──────────────────────────────────────────────
class StrikeCreate(BaseModel):
    agent_id: str
    reason: str
    severity: str = "minor"  # minor | major
    issued_by: str = "founder"

class StrikeResolve(BaseModel):
    training_completed: bool = True
    notes: str = ""

@router.get("/strikes")
def list_strikes(db: Session = Depends(get_db)):
    rows = db.query(StrikeModel).order_by(StrikeModel.created_at.desc()).all()
    return [strike_dict(r) for r in rows]

@router.get("/strikes/agent/{agent_id}")
def agent_strikes(agent_id: str, db: Session = Depends(get_db)):
    rows = db.query(StrikeModel).filter(StrikeModel.agent_id == agent_id).all()
    return [strike_dict(r) for r in rows]

@router.post("/strikes")
def issue_strike(data: StrikeCreate, db: Session = Depends(get_db)):
    agent = db.query(AgentModel).filter(AgentModel.id == data.agent_id).first()
    if not agent:
        raise HTTPException(404, "Agent not found")

    strike = StrikeModel(
        id=str(uuid.uuid4()),
        agent_id=data.agent_id,
        reason=data.reason,
        severity=data.severity,
        issued_by=data.issued_by,
        strike_number=len([s for s in (agent.strikes or [])]) + 1,
    )
    db.add(strike)

    # Update agent strikes JSON
    existing = agent.strikes or []
    existing.append({
        "id": strike.id,
        "reason": data.reason,
        "severity": data.severity,
        "date": datetime.utcnow().isoformat(),
        "resolved": False,
        "trainingCompleted": False,
    })
    agent.strikes = existing

    # Auto-trigger training if Strike 1 or 2
    if strike.strike_number <= 2:
        session = TrainingSessionModel(
            id=str(uuid.uuid4()),
            agent_id=data.agent_id,
            strike_id=strike.id,
            reason=f"Strike #{strike.strike_number}: {data.reason}",
            status="scheduled",
            severity=data.severity,
        )
        db.add(session)
        agent.status = "training"

    db.commit()
    db.refresh(strike)
    return strike_dict(strike)

@router.patch("/strikes/{strike_id}/resolve")
def resolve_strike(strike_id: str, data: StrikeResolve, db: Session = Depends(get_db)):
    strike = db.query(StrikeModel).filter(StrikeModel.id == strike_id).first()
    if not strike:
        raise HTTPException(404, "Strike not found")

    strike.resolved = True
    strike.training_completed = data.training_completed
    strike.resolved_at = datetime.utcnow()

    # Update agent strikes JSON
    agent = db.query(AgentModel).filter(AgentModel.id == strike.agent_id).first()
    if agent:
        strikes = agent.strikes or []
        for s in strikes:
            if s.get("id") == strike_id:
                s["resolved"] = True
                s["trainingCompleted"] = data.training_completed
        agent.strikes = strikes
        if agent.status == "training":
            agent.status = "idle"

    # Close training session
    session = db.query(TrainingSessionModel).filter(TrainingSessionModel.strike_id == strike_id).first()
    if session:
        session.status = "completed"
        session.completed_at = datetime.utcnow()

    db.commit()
    return {"success": True}

# ── Training Sessions ───────────────────────────────────
@router.get("/training")
def list_training(db: Session = Depends(get_db)):
    rows = db.query(TrainingSessionModel).filter(
        TrainingSessionModel.status.in_(["scheduled", "active"])
    ).all()
    return [training_dict(r) for r in rows]

@router.patch("/training/{session_id}/start")
def start_training(session_id: str, db: Session = Depends(get_db)):
    session = db.query(TrainingSessionModel).filter(TrainingSessionModel.id == session_id).first()
    if not session:
        raise HTTPException(404, "Session not found")
    session.status = "active"
    agent = db.query(AgentModel).filter(AgentModel.id == session.agent_id).first()
    if agent:
        agent.status = "training"
    db.commit()
    return training_dict(session)

# ── Hiring Recommendations ─────────────────────────────
class HiringRecCreate(BaseModel):
    department: str
    role: str
    name: str
    model: str = "gpt-4o"
    personality_note: str = ""
    skills: list = []
    recommended_by: str
    recommendation_text: str

@router.get("/hiring")
def list_hiring(db: Session = Depends(get_db)):
    rows = db.query(HiringRecModel).filter(
        HiringRecModel.status == "pending"
    ).order_by(HiringRecModel.created_at.desc()).all()
    return [hiring_dict(r) for r in rows]

@router.post("/hiring")
def submit_hiring_rec(data: HiringRecCreate, db: Session = Depends(get_db)):
    # Check for duplicate role in department
    existing = db.query(AgentModel).filter(
        AgentModel.department == data.department,
        AgentModel.role == data.role,
        AgentModel.is_active == True,
    ).first()

    rec = HiringRecModel(
        id=str(uuid.uuid4()),
        department=data.department,
        role=data.role,
        candidate_name=data.name,
        model=data.model,
        personality_note=data.personality_note,
        skills=data.skills,
        recommended_by=data.recommended_by,
        recommendation_text=data.recommendation_text,
        has_duplicate_warning=existing is not None,
        status="pending",
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return hiring_dict(rec)

@router.patch("/hiring/{rec_id}/approve")
def approve_hire(rec_id: str, db: Session = Depends(get_db)):
    rec = db.query(HiringRecModel).filter(HiringRecModel.id == rec_id).first()
    if not rec:
        raise HTTPException(404, "Recommendation not found")

    # Get next employee ID
    max_emp = db.query(AgentModel).order_by(AgentModel.employee_id.desc()).first()
    next_id = (max_emp.employee_id + 1) if max_emp else 8

    # Find manager for this dept
    manager = db.query(AgentModel).filter(
        AgentModel.department == rec.department,
        AgentModel.tier == "manager",
        AgentModel.is_active == True,
    ).first()

    agent = AgentModel(
        id=str(uuid.uuid4()),
        employee_id=next_id,
        name=rec.candidate_name,
        role=rec.role,
        tier="worker",
        department=rec.department,
        model=rec.model,
        personality_note=rec.personality_note,
        skills=rec.skills,
        manager_id=manager.id if manager else None,
        tile_x=0,
        tile_y=0,
        is_founder=False,
    )
    db.add(agent)

    rec.status = "approved"
    rec.approved_at = datetime.utcnow()
    rec.resulting_agent_id = agent.id

    db.commit()
    db.refresh(agent)
    return {
        "success": True,
        "agent": {
            "id": agent.id,
            "employeeId": agent.employee_id,
            "name": agent.name,
            "role": agent.role,
            "department": agent.department,
        }
    }

@router.patch("/hiring/{rec_id}/reject")
def reject_hire(rec_id: str, db: Session = Depends(get_db)):
    rec = db.query(HiringRecModel).filter(HiringRecModel.id == rec_id).first()
    if not rec:
        raise HTTPException(404, "Recommendation not found")
    rec.status = "rejected"
    db.commit()
    return {"success": True}

# ── Rewards ────────────────────────────────────────────
class RewardCreate(BaseModel):
    agent_id: str
    type: str = "commendation"  # badge | promotion | commendation
    title: str
    reason: str
    granted_by: str = "founder"

@router.post("/rewards")
def grant_reward(data: RewardCreate, db: Session = Depends(get_db)):
    agent = db.query(AgentModel).filter(AgentModel.id == data.agent_id).first()
    if not agent:
        raise HTTPException(404, "Agent not found")

    reward = RewardModel(
        id=str(uuid.uuid4()),
        agent_id=data.agent_id,
        type=data.type,
        title=data.title,
        reason=data.reason,
        granted_by=data.granted_by,
    )
    db.add(reward)

    existing = agent.rewards or []
    existing.append({
        "id": reward.id,
        "type": data.type,
        "title": data.title,
        "reason": data.reason,
        "date": datetime.utcnow().isoformat(),
    })
    agent.rewards = existing

    # Promotion: update role
    if data.type == "promotion":
        agent.role = data.title

    db.commit()
    return {"success": True, "reward_id": reward.id}

# ── AI Candidate Generation ────────────────────────────
class GenerateCandidateRequest(BaseModel):
    role: str
    department: str
    model: str = "gpt-4o"
    description: Optional[str] = None  # job duties / skills context for custom depts

_VALID_LEVELS = {'junior', 'mid', 'senior', 'advanced', 'expert'}
_MODEL_MAP = {
    "claude-3-5-sonnet": "anthropic/claude-3-5-sonnet-20241022",
    "gpt-4o":            "openai/gpt-4o",
    "gemini-1.5-pro":    "gemini/gemini-2.5-flash",
}

@router.post("/generate-candidate")
async def generate_founding_candidate(data: GenerateCandidateRequest):
    description_block = f"\nROLE CONTEXT: {data.description}\n" if data.description else ""
    skills_note = (
        "- SKILLS must be directly derived from the Role Context above (4 skills tailored to those duties)"
        if data.description
        else "- SKILLS must be relevant to the role (4 skills)"
    )
    prompt = f"""Generate a unique AI agent character for The Colony — a futuristic workforce simulation.

POSITION: {data.role}
DEPARTMENT: {data.department.upper()}
POWERED BY: {data.model}{description_block}
Rules:
- NAME must be a short all-caps codename (4-6 letters, one word, not a real name)
- PERSONALITY must be ONE specific working trait — no generic phrases like "hardworking" or "dedicated"
- {skills_note}
- RECOMMENDATION must read like a real hiring manager pitch (2-3 sentences)

Respond in EXACTLY this format (no extra lines, no preamble):
NAME: [CODENAME]
PERSONALITY: [one sentence]
SKILLS: [skill_name:level,skill_name:level,skill_name:level,skill_name:level]
RECOMMENDATION: [2-3 sentences]

Valid skill levels: junior, mid, senior, advanced, expert"""

    try:
        model = _MODEL_MAP.get(data.model, "openai/gpt-4o")
        response = await litellm.acompletion(
            model=model,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.choices[0].message.content or ""

        def _field(key: str) -> str:
            for line in text.split('\n'):
                if line.startswith(f'{key}:'):
                    return line[len(key) + 1:].strip()
            return ''

        name = _field('NAME') or data.role.split()[0].upper()[:6]
        personality = _field('PERSONALITY') or f'Driven specialist in {data.role}.'
        recommendation = _field('RECOMMENDATION') or f'A strong candidate for the {data.role} position.'

        skills = []
        for pair in _field('SKILLS').split(','):
            pair = pair.strip()
            if ':' in pair:
                sname, slevel = pair.split(':', 1)
                slevel = slevel.strip().lower()
                if slevel in _VALID_LEVELS:
                    skills.append({"name": sname.strip(), "level": slevel})
        if not skills:
            skills = [{"name": "Domain Expertise", "level": "senior"}]

        return {
            "name": name,
            "personalityNote": personality,
            "skills": skills,
            "recommendation": recommendation,
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Generation unavailable: {str(e)}")


# ── Helpers ────────────────────────────────────────────
def strike_dict(s: StrikeModel) -> dict:
    created = s.created_at.isoformat() if s.created_at else ""
    return {
        "id": s.id,
        "agentId": s.agent_id,
        "reason": s.reason,
        "severity": s.severity,
        "strikeNumber": s.strike_number,
        "issuedBy": s.issued_by,
        "resolved": s.resolved,
        "trainingCompleted": s.training_completed,
        "date": created,
        "createdAt": created,
        "resolvedAt": s.resolved_at.isoformat() if s.resolved_at else None,
    }

def training_dict(t: TrainingSessionModel) -> dict:
    return {
        "id": t.id,
        "agentId": t.agent_id,
        "strikeId": t.strike_id,
        "reason": t.reason,
        "status": t.status,
        "severity": t.severity,
        "createdAt": t.created_at.isoformat() if t.created_at else "",
        "completedAt": t.completed_at.isoformat() if t.completed_at else None,
    }

def hiring_dict(h: HiringRecModel) -> dict:
    return {
        "id": h.id,
        "department": h.department,
        "role": h.role,
        "candidateName": h.candidate_name,
        "model": h.model,
        "personalityNote": h.personality_note,
        "skills": h.skills or [],
        "recommendedBy": h.recommended_by,
        "recommendationText": h.recommendation_text,
        "hasDuplicateWarning": h.has_duplicate_warning,
        "status": h.status,
        "createdAt": h.created_at.isoformat() if h.created_at else "",
    }
