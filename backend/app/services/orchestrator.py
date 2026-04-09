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
    plan_match = re.search(r'ACTION PLAN:(.*?)(?:TIMELINE:|ESTIMATED|$)', exec_text, re.DOTALL | re.IGNORECASE)
    if not plan_match:
        return set()
    departments: set[str] = set()
    for line in plan_match.group(1).split('\n'):
        line = line.strip()
        # Accept "- Dept:", "1. Dept:", "* Dept:", "**Dept**:", plain "Dept:"
        match = re.match(r'^[-*\d.]+\s*\*{0,2}(.+?)\*{0,2}\s*:', line)
        if match:
            label = match.group(1).strip().lower()
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
    plan_match = re.search(r'ACTION PLAN:(.*?)(?:TIMELINE:|ESTIMATED|$)', exec_text, re.DOTALL | re.IGNORECASE)
    section = plan_match.group(1) if plan_match else exec_text
    dept_lower = dept.lower()
    for line in section.split('\n'):
        stripped = line.strip()
        match = re.match(r'^[-*\d.]+\s*\*{0,2}(.+?)\*{0,2}\s*:(.*)', stripped)
        if match:
            label = match.group(1).strip().lower()
            task  = match.group(2).strip()
            if dept_lower in label or label in dept_lower:
                return task
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

    # Extract the specific task ARIA assigned to this department
    task_summary = _extract_dept_task(exec_text, manager.get('department', ''))
    specific_task = task_summary or f"Execute all {manager.get('department', '').title()} department responsibilities for this mission and produce a concrete deliverable."

    # Emit delegation message so the frontend can show what each manager is assigned
    await on_message({
        "type": "agent_message",
        "from_id": executive["id"], "from_name": executive["name"], "from_role": executive["role"],
        "to_id": manager["id"], "to_name": manager["name"],
        "content": specific_task,
        "msg_type": "internal",
        "timestamp": _ts(),
    })

    dept_task_prompt = f"""You are {manager['name']}, {manager['role']}.

MISSION: {mission['title']}
YOUR TASK: {specific_task}

Deliver the actual work product. If it's a document/letter/plan, write it in full. If it's analysis, be specific and concise (150–250 words max). No preamble, no "I will now...", no restating the task. Just the output."""

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

    # Build department roster + worker list for ARIA's awareness
    managers = [a for a in agents if a.get("tier") == "manager"]
    workers  = [a for a in agents if a.get("tier") == "worker"]

    dept_roster = "\n".join(
        f"  - {m.get('department', '').title()} Department — {m['name']} ({m.get('role', '')})"
        for m in managers
    )

    worker_roster = ""
    if workers:
        worker_lines = []
        for w in workers:
            mgr = next((m for m in managers if m["id"] == w.get("manager_id") or m["id"] == w.get("managerId")), None)
            mgr_name = mgr["name"] if mgr else "N/A"
            skills_str = ", ".join(s["name"] for s in (w.get("skills") or [])) or "general"
            worker_lines.append(
                f"  - {w['name']} ({w.get('role', 'Worker')}, {w.get('department', '').title()} dept) "
                f"→ reports to {mgr_name} | skills: {skills_str}"
            )
        worker_roster = "\n\nCURRENT WORKERS:\n" + "\n".join(worker_lines)

    # Step 1 — Executive plans
    exec_prompt = f"""A new mission has arrived from the Founder.

MISSION TITLE: {mission['title']}
MISSION DESCRIPTION: {mission['description']}
PRIORITY: {mission.get('priority', 'normal').upper()}

AVAILABLE DEPARTMENTS:
{dept_roster}{worker_roster}

Your responsibilities:
1. Acknowledge the mission in one sentence
2. Decide which departments are needed (only those with real work to do)
3. Assign each a specific, concrete deliverable

Use EXACTLY this format:

ACKNOWLEDGMENT: [one sentence]
DEPARTMENTS INVOLVED: [comma-separated names]
ACTION PLAN:
- [department name]: [specific deliverable]
- [department name]: [specific deliverable]
TIMELINE: [estimate]

Rules:
- Use exact department names: engineering, research, writing, legal, ld
- One line per department. No elaboration here — save it for the report.
- Only involve departments that have genuine work to do."""

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

    # Step 2 — Dispatch managers in parallel (managers list already built above)
    involved_depts = _parse_involved_departments(exec_text)
    # If parsing found nothing (ARIA deviated from format), involve all managers
    active_managers = [m for m in managers if _manager_is_involved(m, involved_depts)] if involved_depts else managers

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
    dept_sections = chr(10).join(results)
    compile_prompt = f"""Compile the final mission report for the Founder.

MISSION: {mission['title']}
BRIEF: {mission.get('description', '')}

DEPARTMENT OUTPUT:
{dept_sections}

Write the report. Be tight — no filler.

# {mission['title']}

## Summary
[2 sentences max: what was done and the result]

## Deliverables
[CRITICAL: Any document, letter, draft, code, or plan must be reproduced IN FULL — not summarized. Label each section by department.]

## Next Steps
[3–5 numbered actions for the Founder]

## Decisions Required
[Specific approvals needed — or "None"]"""

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
