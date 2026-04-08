import asyncio
import uuid
import os
from datetime import datetime
from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import agents, missions, hr, ld
from app.db.database import create_tables, SessionLocal
from app.models.agent import AgentModel
from app.models.mission import MissionModel, MessageModel
from app.services.orchestrator import run_mission
from app.services.ld_service import run_ld_cycle, get_ld_status, run_onboarding_training

# --- Socket.IO setup ---
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    # Fire L&D cycle on startup (5s delay to let DB settle)
    asyncio.create_task(_startup_ld())
    yield

async def _startup_ld():
    """Run L&D cycle on startup if not recently run, then schedule daily."""
    await asyncio.sleep(5)
    status = get_ld_status()
    if not status['is_running']:
        async def broadcast(event: dict):
            await sio.emit('colony_event', event)  # broadcast to ALL clients
        asyncio.create_task(run_ld_cycle(broadcast))
    # Schedule daily repeat
    asyncio.create_task(_daily_ld_scheduler())

async def _daily_ld_scheduler():
    """Re-run L&D every 24 hours while server is up."""
    while True:
        await asyncio.sleep(24 * 60 * 60)
        status = get_ld_status()
        if not status['is_running']:
            async def broadcast(event: dict):
                await sio.emit('colony_event', event)
            await run_ld_cycle(broadcast)

app = FastAPI(title="The Colony API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents.router,   prefix="/api/agents",   tags=["agents"])
app.include_router(missions.router, prefix="/api/missions", tags=["missions"])
app.include_router(hr.router,       prefix="/api/hr",       tags=["hr"])
app.include_router(ld.router,       prefix="/api/ld",       tags=["ld"])

@app.get("/health")
def health():
    return {"status": "Colony is online", "version": "2.0.0"}

# --- Socket.IO events ---
@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")
    await sio.emit("connected", {"status": "Colony online"}, to=sid)

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")

@sio.event
async def send_mission(sid, data):
    """
    Receive a mission from the frontend and run it through the colony.
    data: { title, description, priority, msg_type, agents: [...] }
    """
    db = SessionLocal()
    try:
        # Persist the mission
        mission_id = str(uuid.uuid4())
        mission = MissionModel(
            id=mission_id,
            title=data.get("title", "Untitled Mission"),
            description=data.get("description", ""),
            priority=data.get("priority", "normal"),
            status="in_progress",
        )
        db.add(mission)

        # Save founder's initial message
        founder_agent = db.query(AgentModel).filter(AgentModel.is_founder == True).first()
        executive_agent = db.query(AgentModel).filter(
            AgentModel.tier == "executive",
            AgentModel.is_founder == False,
            AgentModel.is_active == True
        ).first()

        founder_id = founder_agent.id if founder_agent else "founder"
        exec_id = executive_agent.id if executive_agent else "exec"

        init_msg = MessageModel(
            id=str(uuid.uuid4()),
            mission_id=mission_id,
            from_agent_id=founder_id,
            to_agent_id=exec_id,
            content=data.get("description", ""),
            msg_type=data.get("msg_type", "chat"),
            is_internal=False,
        )
        db.add(init_msg)
        db.commit()

        # Get all active agents as dicts for the orchestrator
        db_agents = db.query(AgentModel).filter(AgentModel.is_active == True).all()
        agent_dicts = []
        for a in db_agents:
            agent_dicts.append({
                "id": a.id,
                "employee_id": a.employee_id,
                "name": a.name,
                "role": a.role,
                "tier": a.tier,
                "department": a.department,
                "model": a.model,
                "personality_note": a.personality_note,
                "skills": a.skills or [],
                "memory_context": a.memory_context or "",
                "is_founder": a.is_founder,
                "manager_id": a.manager_id,
            })

        mission_dict = {
            "id": mission_id,
            "title": data.get("title", "Untitled Mission"),
            "description": data.get("description", ""),
            "priority": data.get("priority", "normal"),
        }

        async def on_message(event: dict):
            """Relay every event to the frontend via Socket.IO."""
            await sio.emit("colony_event", event, to=sid)

            # Persist agent messages to DB
            if event.get("type") == "agent_message" and not event.get("msg_type") == "internal":
                msg = MessageModel(
                    id=str(uuid.uuid4()),
                    mission_id=mission_id,
                    from_agent_id=event.get("from_id", ""),
                    to_agent_id=event.get("to_id", ""),
                    content=event.get("content", ""),
                    msg_type=event.get("msg_type", "chat"),
                    is_internal=False,
                )
                db.add(msg)
                db.commit()

            # Update agent status
            if event.get("type") == "status_update":
                agent = db.query(AgentModel).filter(AgentModel.id == event.get("agent_id")).first()
                if agent:
                    agent.status = event.get("status", "idle")
                    db.commit()

        await run_mission(mission_dict, agent_dicts, on_message)

        # Mark mission complete
        mission.status = "completed"
        db.commit()

    except Exception as e:
        await sio.emit("colony_event", {
            "type": "error",
            "text": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }, to=sid)
    finally:
        db.close()

@sio.event
async def run_ld(sid, data):
    """Manual trigger for L&D cycle from the frontend."""
    status = get_ld_status()
    if status['is_running']:
        await sio.emit('colony_event', {
            'type': 'ld_error',
            'text': 'L&D cycle already in progress',
            'timestamp': datetime.utcnow().isoformat(),
        }, to=sid)
        return
    async def broadcast(event: dict):
        await sio.emit('colony_event', event)  # broadcast to ALL
    asyncio.create_task(run_ld_cycle(broadcast))
    await sio.emit('colony_event', {
        'type': 'status',
        'text': 'L&D cycle queued',
        'timestamp': datetime.utcnow().isoformat(),
    }, to=sid)

@sio.event
async def new_hire_onboarding(sid, data):
    """
    Triggered when a new hire is approved in the frontend.
    Upserts the agent to the DB, then runs L&D onboarding training.
    data: { agent: { id, employeeId, name, role, tier, department, model,
                     personalityNote, skills, tilePosition, managerId, ... } }
    """
    agent_data = data.get('agent')
    if not agent_data:
        return

    # Normalise frontend camelCase → snake_case for DB
    db = SessionLocal()
    try:
        existing = db.query(AgentModel).filter(AgentModel.id == agent_data.get('id', '')).first()
        if not existing:
            tile = agent_data.get('tilePosition') or {}
            new_a = AgentModel(
                id              = agent_data['id'],
                employee_id     = agent_data.get('employeeId', 0),
                name            = agent_data['name'],
                role            = agent_data['role'],
                tier            = agent_data.get('tier', 'worker'),
                department      = agent_data['department'],
                model           = agent_data.get('model', 'claude-3-5-sonnet'),
                personality_note= agent_data.get('personalityNote', ''),
                skills          = agent_data.get('skills', []),
                manager_id      = agent_data.get('managerId'),
                tile_x          = tile.get('x', 0),
                tile_y          = tile.get('y', 0),
                is_founder      = agent_data.get('isFounder', False),
            )
            db.add(new_a)
            db.commit()
    except Exception:
        pass
    finally:
        db.close()

    # Build the dict that run_onboarding_training expects
    agent_dict = {
        'id':              agent_data.get('id', ''),
        'employee_id':     agent_data.get('employeeId', 0),
        'name':            agent_data['name'],
        'role':            agent_data['role'],
        'tier':            agent_data.get('tier', 'worker'),
        'department':      agent_data['department'],
        'model':           agent_data.get('model', 'claude-3-5-sonnet'),
        'personality_note':agent_data.get('personalityNote', ''),
        'skills':          agent_data.get('skills', []),
        'is_founder':      agent_data.get('isFounder', False),
        'manager_id':      agent_data.get('managerId'),
        'strikes':         [],
        'quality_score':   100.0,
        'memory_context':  '',
    }

    async def broadcast(event: dict):
        await sio.emit('colony_event', event)  # broadcast to all clients

    asyncio.create_task(run_onboarding_training(agent_dict, broadcast))


# Wrap in ASGI
socket_app = socketio.ASGIApp(sio, app)
