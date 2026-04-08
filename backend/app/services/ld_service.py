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
