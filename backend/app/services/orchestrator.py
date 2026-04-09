"""
Mission orchestrator — routes founder instructions through the hierarchy.

Flow:
  Founder → Sr. Executive → Department Manager(s) → Worker(s)
"""
import asyncio
import re
from datetime import datetime
from typing import Callable, Awaitable

from app.services.llm import call_agent, stream_agent
from app.services.memory import compress_memory
from app.services.quality import score_response, should_flag_for_strike, update_rolling_score
from app.db.database import SessionLocal
from app.models.agent import AgentModel

OnMessage = Callable[[dict], Awaitable[None]]

# ── Cancellation registry ────────────────────────────────────────────────────
_cancel_flags: dict[str, asyncio.Event] = {}


def cancel_all_missions() -> int:
    """Signal all running missions to stop. Returns number cancelled."""
    count = len(_cancel_flags)
    for ev in _cancel_flags.values():
        ev.set()
    return count


def _ts() -> str:
    return datetime.utcnow().isoformat()


def _parse_involved_departments(exec_text: str) -> set[str]:
    plan_match = re.search(r'ACTION PLAN:(.*?)(?:TIMELINE:|$)', exec_text, re.DOTALL | re.IGNORECASE)
    if not plan_match:
        return set()
    departments: set[str] = set()
    for line in plan_match.group(1).split('\n'):
        line = line.strip()
        if line.startswith('-') and ':' in line:
            label = line[1:].split(':', 1)[0].strip().lower()
            if label:
                departments.add(label)
    return departments


def _manager_is_involved(manager: dict, involved: set[str]) -> bool:
    if not involved:
        return True
    dept = manager.get('department', '').lower()
    role = manager.get('role', '').lower()
    return any(dept in token or token in dept or token in role for token in involved)


def _extract_dept_task(exec_text: str, dept: str) -> str:
    """Pull the relevant ACTION PLAN line for a department from the exec response."""
    for line in exec_text.split('\n'):
        stripped = line.strip()
        if stripped.startswith('-') and ':' in stripped:
            label = stripped[1:].split(':', 1)[0].strip().lower()
            if dept.lower() in label or label in dept.lower():
                return stripped[1:].split(':', 1)[1].strip()
    return ''


async def _stream_exec_message(
    agent: dict,
    messages: list[dict],
    on_message: OnMessage,
    to_id: str | None,
    msg_type: str,
    mission_title: str | None = None,
) -> str:
    import uuid as _uuid
    stream_id = _uuid.uuid4().hex[:12]

    await on_message({
        "type": "agent_stream_start",
        "stream_id": stream_id,
        "from_id": agent["id"],
        "from_name": agent["name"],
        "from_role": agent["role"],
        "to_id": to_id,
        "msg_type": msg_type,
        "timestamp": _ts(),
    })

    full_text = ""
    try:
        async for chunk in stream_agent(agent, messages):
            full_text += chunk
            await on_message({"type": "agent_stream_chunk", "stream_id": stream_id, "chunk": chunk})
    except Exception:
        resp = await call_agent(agent, messages)
        full_text = resp.choices[0].message.content or ""

    await on_message({
        "type": "agent_stream_end",
        "stream_id": stream_id,
        "from_id": agent["id"],
        "from_name": agent["name"],
        "from_role": agent["role"],
        "to_id": to_id,
        "content": full_text,
        "msg_type": msg_type,
        "mission_title": mission_title,
        "timestamp": _ts(),
    })

    return full_text


async def _update_agent_memory(agent_id: str, new_memory: str) -> None:
    db = SessionLocal()
    try:
        agent_row = db.query(AgentModel).filter(AgentModel.id == agent_id).first()
        if agent_row:
            agent_row.memory_context = new_memory
            db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


async def _update_agent_quality(agent_id: str, new_score: float) -> None:
    db = SessionLocal()
    try:
        agent_row = db.query(AgentModel).filter(AgentModel.id == agent_id).first()
        if agent_row:
            agent_row.quality_score = new_score
            db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


async def _run_worker(
    worker: dict,
    manager: dict,
    mission: dict,
    mgr_text: str,
    on_message: OnMessage,
    cancel: asyncio.Event,
) -> str:
    if cancel.is_set():
        return f"[{worker['name']}] Cancelled"

    worker_prompt = f"""Your manager {manager['name']} has delegated a sub-task to you from the mission:

MISSION: {mission['title']}
MANAGER'S PLAN: {mgr_text[:600]}
YOUR DEPARTMENT: {worker.get('department', '')}
YOUR ROLE: {worker.get('role', '')}

Complete the specific portion of this work that falls within your expertise. Be thorough and specific."""

    await on_message({"type": "status_update", "agent_id": worker["id"], "agent_name": worker["name"], "status": "working", "timestamp": _ts()})

    try:
        resp = await call_agent(worker, [{"role": "user", "content": worker_prompt}])
        worker_text = resp.choices[0].message.content or ""
        await on_message({"type": "status_update", "agent_id": worker["id"], "agent_name": worker["name"], "status": "idle", "timestamp": _ts()})
        return f"[{worker['name']} — {worker.get('role', 'Worker')}]\n{worker_text}"
    except Exception as e:
        await on_message({"type": "status_update", "agent_id": worker["id"], "agent_name": worker["name"], "status": "idle", "timestamp": _ts()})
        return f"[{worker['name']}] Error: {str(e)}"


async def _run_manager(
    manager: dict,
    executive: dict,
    mission: dict,
    exec_text: str,
    agents: list[dict],
    on_message: OnMessage,
    cancel: asyncio.Event,
) -> tuple[str, dict]:
    """Run one manager and their workers. Returns (result_text, conversation_data)."""
    if cancel.is_set():
        return f"[{manager['name']}] Cancelled", {}

    dept_task_prompt = f"""You have been assigned a sub-task from the Sr. Executive for the following mission:

MISSION: {mission['title']}
EXECUTIVE PLAN:
{exec_text}

Your department: {manager['department']}
Your role: {manager['role']}

Execute the relevant portion of this mission for your department.
Be specific, thorough, and professional. Return your findings/work product."""

    # Emit a rich delegation message so the frontend can show what each manager is assigned
    task_summary = _extract_dept_task(exec_text, manager.get('department', ''))
    await on_message({
        "type": "agent_message",
        "from_id": executive["id"], "from_name": executive["name"], "from_role": executive["role"],
        "to_id": manager["id"], "to_name": manager["name"],
        "content": task_summary or f"Execute all {manager.get('department', '').title()} department tasks for this mission.",
        "msg_type": "internal",
        "timestamp": _ts(),
    })

    await on_message({"type": "status_update", "agent_id": manager["id"], "agent_name": manager["name"], "status": "working", "timestamp": _ts()})

    mgr_text = ""
    try:
        if cancel.is_set():
            return f"[{manager['name']}] Cancelled", {}

        # Stream the manager's response so the founder can see their thinking in real-time
        mgr_text = await _stream_exec_message(
            agent=manager,
            messages=[{"role": "user", "content": dept_task_prompt}],
            on_message=on_message,
            to_id=executive["id"],
            msg_type="update",
        )

        if cancel.is_set():
            await on_message({"type": "status_update", "agent_id": manager["id"], "agent_name": manager["name"], "status": "idle", "timestamp": _ts()})
            return f"[{manager['name']}] Cancelled after response", {}

        # Worker delegation
        manager_id = manager["id"]
        workers = [
            a for a in agents
            if a.get("tier") == "worker"
            and (a.get("manager_id") == manager_id or a.get("managerId") == manager_id)
        ]

        if workers and not cancel.is_set():
            # Notify frontend about each worker assignment
            for w in workers:
                await on_message({
                    "type": "agent_message",
                    "from_id": manager["id"], "from_name": manager["name"], "from_role": manager["role"],
                    "to_id": w["id"], "to_name": w["name"],
                    "content": f"Sub-task assigned: {w['role']} — contributing to {manager.get('department', '').title()} dept work.",
                    "msg_type": "internal",
                    "timestamp": _ts(),
                })

            worker_tasks = [_run_worker(w, manager, mission, mgr_text, on_message, cancel) for w in workers]
            worker_results = await asyncio.gather(*worker_tasks)
            if not cancel.is_set():
                worker_summary = "\n\n".join(worker_results)
                synthesis_prompt = f"""You delegated sub-tasks to your team. Here are their results:

{worker_summary}

Now provide a final synthesis of all work completed, integrating the team's contributions into a cohesive department report."""
                synthesis_response = await call_agent(manager, [{"role": "user", "content": synthesis_prompt}])
                mgr_text = synthesis_response.choices[0].message.content or mgr_text
                # Notify that synthesis is done
                await on_message({
                    "type": "agent_message",
                    "from_id": manager["id"], "from_name": manager["name"], "from_role": manager["role"],
                    "to_id": executive["id"], "to_name": executive["name"],
                    "content": f"Synthesis complete — integrated {len(workers)} worker contribution{'s' if len(workers) != 1 else ''} into department report.",
                    "msg_type": "internal",
                    "timestamp": _ts(),
                })

        result = f"[{manager['name']} — {manager['role']}]\n{mgr_text}"

        await on_message({"type": "status_update", "agent_id": manager["id"], "agent_name": manager["name"], "status": "idle", "timestamp": _ts()})

        # Quality scoring
        try:
            score = await score_response(manager["name"], manager["role"], dept_task_prompt, mgr_text)
            existing_score = manager.get("quality_score") or 100.0
            await on_message({"type": "quality_score", "agent_name": manager["name"], "score": score, "timestamp": _ts()})
            if should_flag_for_strike(score, existing_score):
                await on_message({"type": "strike_flag", "agent_name": manager["name"], "reason": f"Quality score {score:.0f}/100 — below threshold", "timestamp": _ts()})
            new_quality = update_rolling_score(existing_score, score)
            await _update_agent_quality(manager["id"], new_quality)
        except Exception:
            pass

        return result, {"manager": manager, "dept_task_prompt": dept_task_prompt, "mgr_text": mgr_text}

    except Exception as e:
        await on_message({"type": "status_update", "agent_id": manager["id"], "agent_name": manager["name"], "status": "idle", "timestamp": _ts()})
        return f"[{manager['name']}] Error: {str(e)}", {}


async def run_mission(
    mission: dict,
    agents: list[dict],
    on_message: OnMessage,
) -> str:
    mission_id = mission.get("id", "unknown")
    cancel = asyncio.Event()
    _cancel_flags[mission_id] = cancel

    try:
        return await _run_mission_inner(mission, agents, on_message, cancel)
    finally:
        _cancel_flags.pop(mission_id, None)


async def _run_mission_inner(
    mission: dict,
    agents: list[dict],
    on_message: OnMessage,
    cancel: asyncio.Event,
) -> str:
    founder_id = next((a["id"] for a in agents if a.get("is_founder")), None)
    executive = next((a for a in agents if a.get("tier") == "executive" and not a.get("is_founder")), None)

    if not executive:
        return "No Sr. Executive available to handle this mission."

    await on_message({"type": "status", "text": f"Mission received. Routing to {executive['name']}...", "timestamp": _ts()})

    # Step 1 — Executive plans
    exec_prompt = f"""A new mission has come in from the Founder.

MISSION: {mission['title']}
DESCRIPTION: {mission['description']}
PRIORITY: {mission.get('priority', 'normal')}

Your job:
1. Briefly acknowledge the mission
2. Identify which departments need to be involved and what each should do
3. Provide a structured action plan

Format your response as:
ACKNOWLEDGMENT: [one sentence]
DEPARTMENTS INVOLVED: [list]
ACTION PLAN:
- [Department]: [specific task]
- ...
TIMELINE: [estimated completion]"""

    exec_text = await _stream_exec_message(
        agent=executive,
        messages=[{"role": "user", "content": exec_prompt}],
        on_message=on_message,
        to_id=founder_id,
        msg_type="update",
    )

    if cancel.is_set():
        await _emit_cancelled(on_message, agents)
        return ""

    # Step 2 — Dispatch managers in parallel
    managers = [a for a in agents if a.get("tier") == "manager"]
    involved_depts = _parse_involved_departments(exec_text)
    active_managers = [m for m in managers if _manager_is_involved(m, involved_depts)]

    manager_tasks = [
        _run_manager(m, executive, mission, exec_text, agents, on_message, cancel)
        for m in active_managers
    ]
    manager_outputs = await asyncio.gather(*manager_tasks)

    if cancel.is_set():
        await _emit_cancelled(on_message, agents)
        return ""

    results = [text for text, _ in manager_outputs]
    manager_conversations = {
        data["manager"]["id"]: data
        for _, data in manager_outputs
        if data and "manager" in data
    }

    # Step 3 — Executive compiles final report
    compile_prompt = f"""You have received work product from all relevant departments for this mission:

MISSION: {mission['title']}

DEPARTMENT OUTPUTS:
{chr(10).join(results)}

Now compile a comprehensive final report for the Founder. Include:
- Executive Summary (2-3 sentences)
- Key Findings / Deliverables per department
- Recommendations
- Any blockers or items requiring Founder decision

Format it professionally as a formal report."""

    final_text = await _stream_exec_message(
        agent=executive,
        messages=[{"role": "user", "content": compile_prompt}],
        on_message=on_message,
        to_id=founder_id,
        msg_type="formal_report",
        mission_title=mission["title"],
    )

    await on_message({"type": "mission_complete", "mission_id": mission.get("id"), "timestamp": _ts()})

    # Post-mission memory compression
    for mgr_id, data in manager_conversations.items():
        try:
            manager = data["manager"]
            conversation = [
                {"role": "user", "content": data["dept_task_prompt"]},
                {"role": "assistant", "content": data["mgr_text"]},
            ]
            new_memory = await compress_memory(manager.get("memory_context", "") or "", conversation)
            await _update_agent_memory(mgr_id, new_memory)
        except Exception:
            pass

    return final_text


async def _emit_cancelled(on_message: OnMessage, agents: list[dict]) -> None:
    """Reset all agent statuses and emit cancellation event."""
    for agent in agents:
        if agent.get("status") in ("working", "thinking", "chatting"):
            await on_message({
                "type": "status_update",
                "agent_id": agent["id"],
                "agent_name": agent.get("name", ""),
                "status": "idle",
                "timestamp": _ts(),
            })
    await on_message({"type": "mission_cancelled", "timestamp": _ts()})
