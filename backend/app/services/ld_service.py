"""
L&D Autopilot Service — autonomous workforce training cycle.
Runs on startup and every 24h. Emits socket events for real-time UI.
After each cycle, writes a full markdown report to docs/ld-reports/.
"""
import asyncio
import copy
from datetime import datetime
from pathlib import Path
from typing import Callable, Awaitable
from app.services.llm import call_agent
from app.services.memory import inject_memory
from app.db.database import SessionLocal
from app.models.agent import AgentModel

# Project root = 3 levels up from this file (backend/app/services/ld_service.py)
_PROJECT_ROOT = Path(__file__).parents[3]
_REPORTS_DIR  = _PROJECT_ROOT / "docs" / "ld-reports"

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

_ONBOARDING_DIR = _REPORTS_DIR / "onboarding"
_LEVEL_UP = {'junior': 'mid', 'mid': 'senior', 'senior': 'advanced', 'advanced': 'expert', 'expert': 'expert'}


def _parse_field(text: str, field: str) -> str:
    """Extract a labelled field from the structured LLM response."""
    for line in text.split('\n'):
        if line.startswith(f'{field}:'):
            return line[len(field) + 1:].strip()
    return ''


def _write_ld_report(
    run_dt: datetime,
    ld_head_name: str,
    colony_name: str,
    review_records: list[dict],
    training_plans: list[dict],
    skill_updates: list[dict],
    summary: str,
    report_path: Path,
) -> Path:
    """
    Write a markdown L&D cycle report.

    Each review_record contains:
      agent_name, agent_role, agent_dept, employee_id,
      quality_score, strike_count,
      skills_before, skills_after,   # list of {name, level}
      assessment, training_needed, training_topic, recommendation,
      raw_review
    """
    _REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    level_order = {'junior': 1, 'mid': 2, 'senior': 3, 'advanced': 4, 'expert': 5}

    lines: list[str] = []

    # ── Header ──────────────────────────────────────────────────────────────
    lines += [
        f"# L&D Cycle Report — {run_dt.strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        f"| Field | Value |",
        f"|---|---|",
        f"| **Colony** | {colony_name} |",
        f"| **L&D Head** | {ld_head_name} |",
        f"| **Run Date** | {run_dt.strftime('%A, %B %d %Y at %H:%M UTC')} |",
        f"| **Colonists Reviewed** | {len(review_records)} |",
        f"| **Training Plans Issued** | {len(training_plans)} |",
        f"| **Skill Updates Applied** | {len(skill_updates)} |",
        "",
        "---",
        "",
        "## Executive Summary",
        "",
        summary,
        "",
        "---",
        "",
        "## Agent Reviews",
        "",
    ]

    # ── Per-agent sections ───────────────────────────────────────────────────
    for rec in review_records:
        emp_id = f"#{str(rec['employee_id']).zfill(4)}"
        quality = rec.get('quality_score', 100.0)
        strikes = rec.get('strike_count', 0)
        before  = rec.get('skills_before', [])
        after   = rec.get('skills_after', [])

        # Build before/after skill diff
        before_map = {s['name'].lower(): s['level'] for s in before}
        after_map  = {s['name'].lower(): s['level'] for s in after}

        upgraded   = []
        added      = []
        unchanged  = []

        for name_lower, level_after in after_map.items():
            display_name = next((s['name'] for s in after if s['name'].lower() == name_lower), name_lower.title())
            if name_lower in before_map:
                level_before = before_map[name_lower]
                if level_order.get(level_after, 0) > level_order.get(level_before, 0):
                    upgraded.append(f"- **{display_name}**: `{level_before}` → `{level_after}` ⬆")
                else:
                    unchanged.append(f"- {display_name} ({level_after})")
            else:
                added.append(f"- **{display_name}**: `{level_after}` ✨ *(new)*")

        lines += [
            f"### {rec['agent_name']} — {rec['agent_role']} {emp_id}",
            "",
            f"**Department:** {rec['agent_dept'].title()}  ",
            f"**Quality Score:** {quality:.0f}/100  ",
            f"**Strikes on Record:** {strikes}  ",
            "",
        ]

        # Assessment block
        lines += [
            f"> {rec.get('assessment', '—')}",
            "",
        ]

        # Training
        training_needed = rec.get('training_needed', False)
        training_topic  = rec.get('training_topic', 'None')
        lines += [
            f"**Training Required:** {'✅ YES' if training_needed else 'NO'}  ",
        ]
        if training_needed and training_topic and training_topic.upper() != 'NONE':
            lines += [f"**Training Topic:** {training_topic}  "]
        lines.append("")

        # Skills
        if upgraded or added or unchanged:
            lines.append("**Skill Record:**")
            lines.append("")
            for s in upgraded:
                lines.append(s)
            for s in added:
                lines.append(s)
            for s in unchanged:
                lines.append(s)
            lines.append("")

        # Recommendation
        rec_text = rec.get('recommendation', '')
        if rec_text:
            lines += [
                f"**Recommendation:** {rec_text}",
                "",
            ]

        lines.append("---")
        lines.append("")

    # ── Training plan table ──────────────────────────────────────────────────
    if training_plans:
        lines += [
            "## Training Plans Issued",
            "",
            "| Agent | Training Topic |",
            "|---|---|",
        ]
        for plan in training_plans:
            lines.append(f"| {plan['agent']} | {plan['topic']} |")
        lines += ["", "---", ""]

    # ── Skill update summary table ───────────────────────────────────────────
    if skill_updates:
        lines += [
            "## Full Skill Profiles After This Cycle",
            "",
        ]
        for upd in skill_updates:
            lines.append(f"**{upd['agent_name']}**")
            for s in sorted(upd['skills'], key=lambda x: level_order.get(x['level'], 0), reverse=True):
                lines.append(f"- {s['name']} ({s['level']})")
            lines.append("")
        lines += ["---", ""]

    # ── Footer ───────────────────────────────────────────────────────────────
    lines += [
        f"*Generated by {ld_head_name} · L&D Autopilot · {run_dt.strftime('%Y-%m-%d %H:%M UTC')}*",
    ]

    report_path.write_text('\n'.join(lines), encoding='utf-8')
    return report_path


def _write_onboarding_report(
    agent: dict,
    ld_head_name: str,
    skills_before: list,
    skills_after: list,
    assessment: str,
    training_path: str,
    run_dt: datetime,
) -> Path:
    """Write an onboarding training report for a single new hire."""
    _ONBOARDING_DIR.mkdir(parents=True, exist_ok=True)
    level_order = {'junior': 1, 'mid': 2, 'senior': 3, 'advanced': 4, 'expert': 5}

    emp_id = f"#{str(agent.get('employee_id', 0)).zfill(4)}"
    safe_name = agent['name'].replace(' ', '_')
    report_path = _ONBOARDING_DIR / f"{run_dt.strftime('%Y-%m-%d')}_{safe_name}.md"

    before_map = {s['name'].lower(): s['level'] for s in skills_before}
    after_map  = {s['name'].lower(): s['level'] for s in skills_after}

    lines = [
        f"# Onboarding Training Report — {agent['name']} {emp_id}",
        "",
        f"| Field | Value |",
        f"|---|---|",
        f"| **Agent** | {agent['name']} — {agent['role']} |",
        f"| **Department** | {agent['department'].title()} |",
        f"| **L&D Head** | {ld_head_name} |",
        f"| **Onboarding Date** | {run_dt.strftime('%A, %B %d %Y')} |",
        f"| **Model** | {agent.get('model', '—')} |",
        "",
        "> **Colony Expert Standard:** Every colonist is expected to reach EXPERT level",
        "> in all core skills. Training continues each cycle until this standard is met.",
        "",
        "---",
        "",
        "## Baseline Skills at Hire",
        "",
    ]
    if skills_before:
        for s in sorted(skills_before, key=lambda x: level_order.get(x['level'], 0), reverse=True):
            lines.append(f"- {s['name']} (`{s['level']}`)")
    else:
        lines.append("- *No skills on file at hire*")
    lines.append("")

    lines += ["## Post-Onboarding Skills", ""]
    upgraded, added, same = [], [], []
    for name_lower, level_after in after_map.items():
        display = next((s['name'] for s in skills_after if s['name'].lower() == name_lower), name_lower.title())
        if name_lower in before_map:
            level_before = before_map[name_lower]
            if level_order.get(level_after, 0) > level_order.get(level_before, 0):
                upgraded.append(f"- **{display}**: `{level_before}` → `{level_after}` ⬆")
            else:
                same.append(f"- {display} (`{level_after}`) — already at standard")
        else:
            added.append(f"- **{display}**: `{level_after}` ✨ *(added during onboarding)*")
    for line in upgraded + added + same:
        lines.append(line)
    lines.append("")

    # Remaining gaps to expert
    gaps = [
        s for s in skills_after
        if s['level'] != 'expert'
    ]
    if gaps:
        lines += ["## Path to Full Expert Standard", ""]
        for g in sorted(gaps, key=lambda x: level_order.get(x['level'], 0)):
            steps_left = 5 - level_order.get(g['level'], 1)
            lines.append(f"- **{g['name']}**: `{g['level']}` → `expert` ({steps_left} cycle{'s' if steps_left != 1 else ''} remaining)")
        lines.append("")

    lines += [
        "## Assessment",
        "",
        f"> {assessment}",
        "",
    ]

    if training_path:
        lines += [
            "## Training Path",
            "",
            training_path,
            "",
        ]

    lines += [
        "---",
        f"*Generated by {ld_head_name} · L&D Onboarding · {run_dt.strftime('%Y-%m-%d %H:%M UTC')}*",
    ]

    report_path.write_text('\n'.join(lines), encoding='utf-8')
    return report_path


async def run_onboarding_training(agent: dict, on_message: OnMessage) -> str:
    """
    Run targeted onboarding training for a single newly hired agent.

    Colony Expert Standard: every skill is advanced at least one tier.
    Missing critical skills for the role are added at senior level.
    A dedicated onboarding report is saved to docs/ld-reports/onboarding/.
    """
    db = SessionLocal()
    try:
        agent_dicts = [_agent_to_dict(a) for a in db.query(AgentModel).filter(AgentModel.is_active == True).all()]
    finally:
        db.close()

    ld_head = next((a for a in agent_dicts if a['department'] == 'ld' and a['tier'] == 'manager'), None)
    if not ld_head:
        return "No L&D head available for onboarding"

    run_dt  = datetime.utcnow()
    ts      = lambda: datetime.utcnow().isoformat()
    skills  = agent.get('skills') or []
    skills_before = copy.deepcopy(skills)
    skills_str = ', '.join([f"{s['name']} ({s['level']})" for s in skills]) if skills else 'None'

    await on_message({
        "type": "ld_onboarding_start",
        "text": f"Onboarding training initiated for {agent['name']} ({agent['role']})",
        "agent_id": agent.get('id', ''),
        "agent_name": agent['name'],
        "timestamp": ts(),
    })
    await on_message({
        "type": "ld_status_update",
        "agent_id": ld_head['id'],
        "agent_name": ld_head['name'],
        "status": "working",
        "timestamp": ts(),
    })

    prompt = f"""As {ld_head['name']}, Head of Learning & Development for The Colony, conduct onboarding training for a new hire.

COLONY EXPERT STANDARD POLICY:
Every colonist must reach EXPERT level in all core skills. No exceptions.
As L&D head, your job for each new hire is to immediately begin closing the gap to expert.

NEW HIRE: {agent['name']} — {agent['role']} ({agent.get('department','').upper()} dept) #{str(agent.get('employee_id',0)).zfill(4)}
MODEL: {agent.get('model','—')}
PERSONALITY: {agent.get('personality_note') or agent.get('personalityNote', '—')}
STARTING SKILLS: {skills_str}

Your onboarding tasks:
1. Advance EVERY existing skill by exactly one tier toward expert
   (junior→mid, mid→senior, senior→advanced, advanced→expert, expert stays expert)
2. Identify 1-2 critical skills their role demands that are MISSING — add them at SENIOR level
3. Write a clear training path: what's needed to reach full expert in each skill
4. Assess this agent's potential and readiness

Respond in EXACTLY this format:
ASSESSMENT: [two sentences max — honest evaluation of this hire]
SKILL_UPGRADES: [name:level,name:level — include ALL skills, upgraded + new ones] (levels: junior,mid,senior,advanced,expert)
TRAINING_PATH: [2-3 sentences on their path to full expert across all skills]"""

    try:
        response = await call_agent(ld_head, [{"role": "user", "content": prompt}])
        result   = response.choices[0].message.content or ""
    except Exception as e:
        result = f"ASSESSMENT: Onboarding could not complete ({e}).\nSKILL_UPGRADES: NONE\nTRAINING_PATH: Retry on next cycle."

    assessment    = _parse_field(result, 'ASSESSMENT')
    training_path = _parse_field(result, 'TRAINING_PATH')

    # Parse upgraded + new skills
    new_skills: list[dict] = []
    for line in result.split('\n'):
        if line.startswith('SKILL_UPGRADES:'):
            part = line.replace('SKILL_UPGRADES:', '').strip()
            if part.upper() != 'NONE':
                for pair in part.split(','):
                    pair = pair.strip()
                    if ':' in pair:
                        name, level = pair.split(':', 1)
                        level_clean = level.strip().lower()
                        if level_clean in ('junior', 'mid', 'senior', 'advanced', 'expert'):
                            new_skills.append({"name": name.strip(), "level": level_clean})

    # Fallback: if LLM didn't return upgrades, level everything up ourselves
    if not new_skills and skills_before:
        new_skills = [{"name": s['name'], "level": _LEVEL_UP[s['level']]} for s in skills_before]

    # Build final skill list
    skills_after = copy.deepcopy(skills_before)
    for ns in new_skills:
        found = next((s for s in skills_after if s['name'].lower() == ns['name'].lower()), None)
        if found:
            found['level'] = ns['level']
        else:
            skills_after.append(ns)

    # Persist to DB
    db = SessionLocal()
    try:
        agent_db = db.query(AgentModel).filter(AgentModel.id == agent.get('id', '')).first()
        if agent_db:
            agent_db.skills = skills_after
            db.commit()
    finally:
        db.close()

    await on_message({
        "type": "ld_skill_update",
        "text": f"Onboarding skills set for {agent['name']}: {', '.join([s['name'] for s in new_skills])}",
        "agent_id": agent.get('id', ''),
        "agent_name": agent['name'],
        "new_skills": skills_after,
        "timestamp": ts(),
    })

    # Write onboarding report
    report_path = _write_onboarding_report(
        agent=agent,
        ld_head_name=ld_head['name'],
        skills_before=skills_before,
        skills_after=skills_after,
        assessment=assessment,
        training_path=training_path,
        run_dt=run_dt,
    )

    summary = f"{agent['name']} onboarding complete. {len(new_skills)} skills set. Report → docs/ld-reports/onboarding/{report_path.name}"

    await on_message({
        "type": "ld_onboarding_complete",
        "text": summary,
        "agent_id": agent.get('id', ''),
        "agent_name": agent['name'],
        "new_skills": skills_after,
        "report_path": str(report_path),
        "timestamp": ts(),
    })
    await on_message({
        "type": "ld_status_update",
        "agent_id": ld_head['id'],
        "agent_name": ld_head['name'],
        "status": "idle",
        "timestamp": ts(),
    })

    return summary


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

        # Try to get colony name from DB (founder's colony context)
        colony_name = "The Colony"

        colonists = [a for a in agent_dicts if a['department'] != 'ld' and not a['is_founder']]
        ts = lambda: datetime.utcnow().isoformat()

        await on_message({"type": "ld_cycle_start", "text": f"L&D cycle initiated. Reviewing {len(colonists)} colonists.", "agent_id": ld_head['id'], "agent_name": ld_head['name'], "timestamp": ts()})
        await on_message({"type": "ld_status_update", "agent_id": ld_head['id'], "agent_name": ld_head['name'], "status": "working", "timestamp": ts()})
        ld_db = db.query(AgentModel).filter(AgentModel.id == ld_head['id']).first()
        if ld_db: ld_db.status = "working"; db.commit()

        training_plans: list[dict] = []
        skill_updates:  list[dict] = []
        review_records: list[dict] = []   # full record for the markdown report

        for agent in colonists:
            await asyncio.sleep(0.8)
            await on_message({"type": "ld_reviewing", "text": f"Reviewing {agent['name']} ({agent['role']})...", "agent_name": agent['name'], "agent_id": agent['id'], "timestamp": ts()})

            strikes    = agent.get('strikes') or []
            quality    = agent.get('quality_score') or 100.0
            skills     = agent.get('skills') or []
            skills_before = copy.deepcopy(skills)   # snapshot before any changes
            skills_str = ', '.join([f"{s['name']} ({s['level']})" for s in skills]) if skills else 'None on file'

            review_prompt = f"""As {ld_head['name']}, Head of L&D for The Colony, conduct a performance review and skills update for this colonist.

COLONY EXPERT STANDARD POLICY:
Every colonist must reach EXPERT level in all core skills. Your job is to advance them each cycle.

COLONIST: {agent['name']} — {agent['role']} ({agent['department'].upper()} dept) #{str(agent['employee_id']).zfill(4)}
QUALITY SCORE: {quality:.0f}/100
STRIKES: {len(strikes)} on record
CURRENT SKILLS: {skills_str}

Your task this cycle:
1. Advance EVERY skill that is not yet at expert by one tier (senior→advanced, advanced→expert, etc.)
2. If all skills are expert, identify 1 new adjacent skill to add at senior level
3. Decide if formal remedial training is needed (YES if quality < 75 or strikes > 0)
4. Provide one clear recommendation for their continued growth

Respond in EXACTLY this format (no extra text):
ASSESSMENT: [one sentence on current state and progress toward expert standard]
TRAINING_NEEDED: YES or NO
TRAINING_TOPIC: [remedial topic if YES, or NONE]
SKILL_UPGRADES: [name:level,name:level — list ALL skills with their new level] (levels: junior,mid,senior,advanced,expert)
RECOMMENDATION: [one sentence on what to focus on next cycle]"""

            try:
                messages = inject_memory(ld_head, [{"role": "user", "content": review_prompt}])
                response = await call_agent(ld_head, messages)
                review_text = response.choices[0].message.content or ""
            except Exception as e:
                review_text = f"ASSESSMENT: Review failed ({e})\nTRAINING_NEEDED: NO\nSKILL_UPGRADES: NONE\nRECOMMENDATION: Retry next cycle"

            training_needed = "TRAINING_NEEDED: YES" in review_text

            # Parse and apply skill upgrades
            new_skills: list[dict] = []
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

            skills_after = list(skills_before)   # start from the before-snapshot
            if new_skills:
                for ns in new_skills:
                    found = next((s for s in skills_after if s['name'].lower() == ns['name'].lower()), None)
                    if found:
                        found['level'] = ns['level']
                    else:
                        skills_after.append(ns)
                agent_db = db.query(AgentModel).filter(AgentModel.id == agent['id']).first()
                if agent_db:
                    agent_db.skills = skills_after
                    db.commit()
                skill_updates.append({"agent_id": agent['id'], "agent_name": agent['name'], "skills": skills_after})
                await on_message({"type": "ld_skill_update", "text": f"Skills updated for {agent['name']}: {', '.join([s['name'] for s in new_skills])}", "agent_id": agent['id'], "agent_name": agent['name'], "new_skills": skills_after, "timestamp": ts()})

            training_topic = _parse_field(review_text, 'TRAINING_TOPIC') or 'None'
            if training_needed:
                training_plans.append({"agent": agent['name'], "topic": training_topic})

            # Accumulate full record for the report
            review_records.append({
                "agent_name":     agent['name'],
                "agent_role":     agent['role'],
                "agent_dept":     agent['department'],
                "employee_id":    agent['employee_id'],
                "quality_score":  quality,
                "strike_count":   len(strikes),
                "skills_before":  skills_before,
                "skills_after":   skills_after,
                "assessment":     _parse_field(review_text, 'ASSESSMENT'),
                "training_needed": training_needed,
                "training_topic": training_topic,
                "recommendation": _parse_field(review_text, 'RECOMMENDATION'),
                "raw_review":     review_text,
            })

            await on_message({"type": "ld_agent_reviewed", "text": review_text, "agent_id": agent['id'], "agent_name": agent['name'], "training_needed": training_needed, "timestamp": ts()})

        # Final summary
        await asyncio.sleep(0.5)
        summary_prompt = f"""As {ld_head['name']}, Head of L&D, write a concise cycle report for the Founder (under 80 words).
Reviewed {len(colonists)} colonists. Training issued to {len(training_plans)} ({', '.join([p['agent'] for p in training_plans]) or 'none'}). Skill updates applied to {len(skill_updates)} agents.
Be direct and professional."""
        try:
            sum_resp = await call_agent(ld_head, [{"role": "user", "content": summary_prompt}])
            summary = sum_resp.choices[0].message.content or "Cycle complete."
        except Exception:
            summary = f"L&D cycle complete. Reviewed {len(colonists)} colonists. {len(training_plans)} training plans. {len(skill_updates)} skill updates."

        _last_run = datetime.utcnow()

        # ── Write the markdown report ────────────────────────────────────────
        report_filename = f"{_last_run.strftime('%Y-%m-%d_%H-%M-%S')}.md"
        report_path     = _REPORTS_DIR / report_filename
        try:
            _write_ld_report(
                run_dt        = _last_run,
                ld_head_name  = ld_head['name'],
                colony_name   = colony_name,
                review_records= review_records,
                training_plans= training_plans,
                skill_updates = skill_updates,
                summary       = summary,
                report_path   = report_path,
            )
            report_note = f" Report saved → docs/ld-reports/{report_filename}"
        except Exception as exc:
            report_note = f" (Report write failed: {exc})"

        await on_message({
            "type": "ld_cycle_complete",
            "text": summary,
            "agent_id": ld_head['id'],
            "agent_name": ld_head['name'],
            "colonists_reviewed": len(colonists),
            "training_plans": len(training_plans),
            "skill_updates": len(skill_updates),
            "report_path": str(report_path),
            "timestamp": _last_run.isoformat(),
        })
        await on_message({"type": "ld_status_update", "agent_id": ld_head['id'], "agent_name": ld_head['name'], "status": "idle", "timestamp": _last_run.isoformat()})
        if ld_db: ld_db.status = "idle"; db.commit()
        return summary + report_note
    finally:
        _is_running = False
        db.close()
