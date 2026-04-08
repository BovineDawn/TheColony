"""
Mission orchestrator — routes founder instructions through the hierarchy.

Flow:
  Founder → Sr. Executive → Department Manager(s) → Worker(s)

The orchestrator:
1. Takes a mission from the founder
2. Sends it to the Sr. Executive with context
3. Sr. Executive decides which department(s) handle it and what each should do
4. Each manager gets their sub-task and delegates to workers (Phase 3)
5. Results bubble back up as updates
"""
import asyncio
from datetime import datetime
from typing import Callable, Awaitable

from app.services.llm import call_agent
from app.services.memory import compress_memory, inject_memory
from app.services.quality import score_response, should_flag_for_strike, update_rolling_score
from app.db.database import SessionLocal
from app.models.agent import AgentModel

OnMessage = Callable[[dict], Awaitable[None]]


async def _update_agent_memory(agent_id: str, new_memory: str) -> None:
    """Persist updated memory_context to DB."""
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
    """Persist updated quality_score to DB."""
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
) -> str:
    """Run a single worker agent on a sub-task derived from the manager's plan."""
    worker_prompt = f"""Your manager {manager['name']} has delegated a sub-task to you from the mission:

MISSION: {mission['title']}
MANAGER'S PLAN: {mgr_text[:600]}
YOUR DEPARTMENT: {worker.get('department', '')}
YOUR ROLE: {worker.get('role', '')}

Complete the specific portion of this work that falls within your expertise. Be thorough and specific."""

    await on_message({
        "type": "status_update",
        "agent_id": worker["id"],
        "agent_name": worker["name"],
        "status": "working",
        "timestamp": datetime.utcnow().isoformat(),
    })

    try:
        messages = inject_memory(worker, [{"role": "user", "content": worker_prompt}])
        resp = await call_agent(worker, messages)
        worker_text = resp.choices[0].message.content or ""

        await on_message({
            "type": "status_update",
            "agent_id": worker["id"],
            "agent_name": worker["name"],
            "status": "idle",
            "timestamp": datetime.utcnow().isoformat(),
        })

        return f"[{worker['name']} — {worker.get('role', 'Worker')}]\n{worker_text}"
    except Exception as e:
        await on_message({
            "type": "status_update",
            "agent_id": worker["id"],
            "agent_name": worker["name"],
            "status": "idle",
            "timestamp": datetime.utcnow().isoformat(),
        })
        return f"[{worker['name']}] Error: {str(e)}"


async def run_mission(
    mission: dict,
    agents: list[dict],
    on_message: OnMessage,
) -> str:
    """
    Run a mission through the colony hierarchy.
    Emits structured message events via on_message for the UI.
    Returns the final result string.
    """
    founder_id = next((a["id"] for a in agents if a.get("is_founder")), None)
    executive = next((a for a in agents if a.get("tier") == "executive" and not a.get("is_founder")), None)

    if not executive:
        return "No Sr. Executive available to handle this mission."

    await on_message({
        "type": "status",
        "text": f"Mission received. Routing to {executive['name']}...",
        "timestamp": datetime.utcnow().isoformat(),
    })

    # Step 1 — Sr. Executive receives and plans
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

    exec_messages = inject_memory(executive, [{"role": "user", "content": exec_prompt}])
    exec_response = await call_agent(executive, exec_messages)
    exec_text = exec_response.choices[0].message.content or ""

    await on_message({
        "type": "agent_message",
        "from_id": executive["id"],
        "from_name": executive["name"],
        "from_role": executive["role"],
        "to_id": founder_id,
        "content": exec_text,
        "msg_type": "update",
        "timestamp": datetime.utcnow().isoformat(),
    })

    # Step 2 — Parse which departments are involved and dispatch
    managers = [a for a in agents if a.get("tier") == "manager"]
    results = []

    # Track per-manager data for post-mission memory compression
    manager_conversations = {}

    for manager in managers:
        dept_task_prompt = f"""You have been assigned a sub-task from the Sr. Executive for the following mission:

MISSION: {mission['title']}
EXECUTIVE PLAN:
{exec_text}

Your department: {manager['department']}
Your role: {manager['role']}

Execute the relevant portion of this mission for your department. 
Be specific, thorough, and professional. Return your findings/work product."""

        await on_message({
            "type": "agent_message",
            "from_id": executive["id"],
            "from_name": executive["name"],
            "from_role": executive["role"],
            "to_id": manager["id"],
            "content": f"[Internal delegation to {manager['name']}]",
            "msg_type": "internal",
            "timestamp": datetime.utcnow().isoformat(),
        })

        await on_message({
            "type": "status_update",
            "agent_id": manager["id"],
            "agent_name": manager["name"],
            "status": "working",
            "timestamp": datetime.utcnow().isoformat(),
        })

        mgr_text = ""
        try:
            mgr_messages = inject_memory(manager, [{"role": "user", "content": dept_task_prompt}])
            mgr_response = await call_agent(manager, mgr_messages)
            mgr_text = mgr_response.choices[0].message.content or ""

            # --- Task 3: Worker delegation ---
            manager_id = manager["id"]
            workers = [
                a for a in agents
                if a.get("tier") == "worker"
                and (a.get("manager_id") == manager_id or a.get("managerId") == manager_id)
            ]

            if workers:
                # Delegate to workers in parallel
                worker_tasks = [
                    _run_worker(w, manager, mission, mgr_text, on_message)
                    for w in workers
                ]
                worker_results = await asyncio.gather(*worker_tasks)

                # Manager synthesizes worker output
                worker_summary = "\n\n".join(worker_results)
                synthesis_prompt = f"""You delegated sub-tasks to your team. Here are their results:

{worker_summary}

Now provide a final synthesis of all work completed, integrating the team's contributions into a cohesive department report."""

                synthesis_messages = inject_memory(manager, [{"role": "user", "content": synthesis_prompt}])
                synthesis_response = await call_agent(manager, synthesis_messages)
                mgr_text = synthesis_response.choices[0].message.content or mgr_text

            results.append(f"[{manager['name']} — {manager['role']}]\n{mgr_text}")

            await on_message({
                "type": "status_update",
                "agent_id": manager["id"],
                "agent_name": manager["name"],
                "status": "idle",
                "timestamp": datetime.utcnow().isoformat(),
            })

            # --- Task 2: Quality scoring ---
            try:
                score = await score_response(manager["name"], manager["role"], dept_task_prompt, mgr_text)
                existing_score = manager.get("quality_score") or 100.0

                await on_message({
                    "type": "quality_score",
                    "agent_name": manager["name"],
                    "score": score,
                    "timestamp": datetime.utcnow().isoformat(),
                })

                if should_flag_for_strike(score, existing_score):
                    await on_message({
                        "type": "strike_flag",
                        "agent_name": manager["name"],
                        "reason": f"Quality score {score:.0f}/100 — below threshold",
                        "timestamp": datetime.utcnow().isoformat(),
                    })

                new_quality = update_rolling_score(existing_score, score)
                await _update_agent_quality(manager["id"], new_quality)
            except Exception:
                pass  # quality scoring failure should not abort the mission

        except Exception as e:
            results.append(f"[{manager['name']}] Error: {str(e)}")

        # Store conversation for memory compression
        manager_conversations[manager["id"]] = {
            "manager": manager,
            "dept_task_prompt": dept_task_prompt,
            "mgr_text": mgr_text,
        }

        await asyncio.sleep(0.5)

    # Step 3 — Sr. Executive compiles final report
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

    compile_messages = inject_memory(executive, [{"role": "user", "content": compile_prompt}])
    final_response = await call_agent(executive, compile_messages)
    final_text = final_response.choices[0].message.content or ""

    await on_message({
        "type": "agent_message",
        "from_id": executive["id"],
        "from_name": executive["name"],
        "from_role": executive["role"],
        "to_id": founder_id,
        "content": final_text,
        "msg_type": "formal_report",
        "timestamp": datetime.utcnow().isoformat(),
        "mission_title": mission["title"],
    })

    await on_message({
        "type": "mission_complete",
        "mission_id": mission.get("id"),
        "timestamp": datetime.utcnow().isoformat(),
    })

    # --- Task 1: Post-mission memory compression for each manager ---
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
            pass  # memory update failure should not affect mission result

    return final_text
