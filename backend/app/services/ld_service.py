"""
L&D Autopilot Service — autonomous workforce training cycle.
Runs on startup and every 24h. Emits socket events for real-time UI.
"""
import asyncio
from datetime import datetime
from typing import Callable, Awaitable
from app.services.llm import call_agent
from app.services.memory import inject_memory
from app.db.database import SessionLocal
from app.models.agent import AgentModel

OnMessage = Callable[[dict], Awaitable[None]]

_last_run: datetime | None = None
_is_running: bool = False

def get_ld_status() -> dict:
    return {
        "last_run": _last_run.isoformat() if _last_run else None,
        "is_running": _is_running,
    }

def _agent_to_dict(a: AgentModel) -> dict:
    return {
        "id": a.id, "employee_id": a.employee_id,
        "name": a.name, "role": a.role, "tier": a.tier,
        "department": a.department, "model": a.model,
        "personality_note": a.personality_note,
        "skills": a.skills or [], "memory_context": a.memory_context or "",
        "is_founder": a.is_founder, "manager_id": a.manager_id,
        "strikes": a.strikes or [], "quality_score": a.quality_score or 100.0,
    }

async def run_ld_cycle(on_message: OnMessage) -> str:
    global _last_run, _is_running
    if _is_running:
        return "L&D cycle already running"
    _is_running = True
    db = SessionLocal()
    try:
        all_agents = db.query(AgentModel).filter(AgentModel.is_active == True).all()
        agent_dicts = [_agent_to_dict(a) for a in all_agents]
        ld_head = next((a for a in agent_dicts if a['department'] == 'ld' and a['tier'] == 'manager'), None)
        if not ld_head:
            _is_running = False
            return "No L&D head found — skipping cycle"
        colonists = [a for a in agent_dicts if a['department'] != 'ld' and not a['is_founder']]
        ts = lambda: datetime.utcnow().isoformat()

        await on_message({"type": "ld_cycle_start", "text": f"L&D cycle initiated. Reviewing {len(colonists)} colonists.", "agent_id": ld_head['id'], "agent_name": ld_head['name'], "timestamp": ts()})
        await on_message({"type": "ld_status_update", "agent_id": ld_head['id'], "agent_name": ld_head['name'], "status": "working", "timestamp": ts()})
        ld_db = db.query(AgentModel).filter(AgentModel.id == ld_head['id']).first()
        if ld_db: ld_db.status = "working"; db.commit()

        training_plans, skill_updates = [], []

        for agent in colonists:
            await asyncio.sleep(0.8)
            await on_message({"type": "ld_reviewing", "text": f"Reviewing {agent['name']} ({agent['role']})...", "agent_name": agent['name'], "agent_id": agent['id'], "timestamp": ts()})

            strikes = agent.get('strikes') or []
            quality = agent.get('quality_score') or 100.0
            skills = agent.get('skills') or []
            skills_str = ', '.join([f"{s['name']} ({s['level']})" for s in skills]) if skills else 'None on file'

            review_prompt = f"""As {ld_head['name']}, Head of L&D for The Colony, review this colonist's performance and recommend development.

COLONIST: {agent['name']} — {agent['role']} ({agent['department'].upper()} dept) #{str(agent['employee_id']).zfill(4)}
QUALITY SCORE: {quality:.0f}/100
STRIKES: {len(strikes)} on record
CURRENT SKILLS: {skills_str}

Your task:
1. Assess current skill level vs role requirements
2. Identify the top skill gap
3. Decide if formal training is required (YES if quality < 75 or strikes > 0 or critical skills missing)
4. Recommend 1-2 specific skill upgrades appropriate for {agent['department']} work

Respond in EXACTLY this format (no extra text):
ASSESSMENT: [one sentence]
TRAINING_NEEDED: YES or NO
TRAINING_TOPIC: [topic or NONE]
SKILL_UPGRADES: [name:level,name:level or NONE] (level must be one of: junior,mid,senior,advanced,expert)
RECOMMENDATION: [one action sentence]"""

            try:
                messages = inject_memory(ld_head, [{"role": "user", "content": review_prompt}])
                response = await call_agent(ld_head, messages)
                review_text = response.choices[0].message.content or ""
            except Exception as e:
                review_text = f"ASSESSMENT: Review failed ({e})\nTRAINING_NEEDED: NO\nSKILL_UPGRADES: NONE\nRECOMMENDATION: Retry next cycle"

            training_needed = "TRAINING_NEEDED: YES" in review_text

            # Parse and apply skill upgrades
            new_skills = []
            for line in review_text.split('\n'):
                if line.startswith('SKILL_UPGRADES:'):
                    part = line.replace('SKILL_UPGRADES:', '').strip()
                    if part.upper() != 'NONE':
                        for pair in part.split(','):
                            pair = pair.strip()
                            if ':' in pair:
                                name, level = pair.split(':', 1)
                                level_clean = level.strip().lower()
                                if level_clean in ('junior','mid','senior','advanced','expert'):
                                    new_skills.append({"name": name.strip(), "level": level_clean})

            if new_skills:
                existing = list(skills)
                for ns in new_skills:
                    found = next((s for s in existing if s['name'].lower() == ns['name'].lower()), None)
                    if found: found['level'] = ns['level']
                    else: existing.append(ns)
                agent_db = db.query(AgentModel).filter(AgentModel.id == agent['id']).first()
                if agent_db: agent_db.skills = existing; db.commit()
                skill_updates.append({"agent_id": agent['id'], "agent_name": agent['name'], "skills": existing})
                await on_message({"type": "ld_skill_update", "text": f"Skills updated for {agent['name']}: {', '.join([s['name'] for s in new_skills])}", "agent_id": agent['id'], "agent_name": agent['name'], "new_skills": existing, "timestamp": ts()})

            if training_needed:
                topic = next((l.replace('TRAINING_TOPIC:','').strip() for l in review_text.split('\n') if l.startswith('TRAINING_TOPIC:')), 'General Skills')
                training_plans.append({"agent": agent['name'], "topic": topic})

            await on_message({"type": "ld_agent_reviewed", "text": review_text, "agent_id": agent['id'], "agent_name": agent['name'], "training_needed": training_needed, "timestamp": ts()})

        # Final summary
        await asyncio.sleep(0.5)
        summary_prompt = f"""As {ld_head['name']}, Head of L&D, write a concise cycle report for the Founder (under 80 words).
Reviewed {len(colonists)} colonists. Training issued to {len(training_plans)} ({', '.join([p['agent'] for p in training_plans]) or 'none'}). Skill updates applied to {len(skill_updates)} agents.
Be direct and professional."""
        try:
            sum_resp = await call_agent(ld_head, [{"role": "user", "content": summary_prompt}])
            summary = sum_resp.choices[0].message.content or "Cycle complete."
        except:
            summary = f"L&D cycle complete. Reviewed {len(colonists)} colonists. {len(training_plans)} training plans. {len(skill_updates)} skill updates."

        _last_run = datetime.utcnow()
        await on_message({"type": "ld_cycle_complete", "text": summary, "agent_id": ld_head['id'], "agent_name": ld_head['name'], "colonists_reviewed": len(colonists), "training_plans": len(training_plans), "skill_updates": len(skill_updates), "timestamp": _last_run.isoformat()})
        await on_message({"type": "ld_status_update", "agent_id": ld_head['id'], "agent_name": ld_head['name'], "status": "idle", "timestamp": _last_run.isoformat()})
        if ld_db: ld_db.status = "idle"; db.commit()
        return summary
    finally:
        _is_running = False
        db.close()
