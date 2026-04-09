from fastapi import APIRouter, HTTPException
from pathlib import Path
from app.services.ld_service import get_ld_status
import re

router = APIRouter()

_PROJECT_ROOT = Path(__file__).parents[3]
_REPORTS_DIR  = _PROJECT_ROOT / "docs" / "ld-reports"


def _parse_report_meta(path: Path) -> dict:
    """Extract header metadata from a cycle report markdown file."""
    meta = {"filename": path.name, "colonists_reviewed": 0, "skill_updates": 0, "ld_head": ""}
    try:
        for line in path.read_text(encoding="utf-8").splitlines()[:20]:
            if "Colonists Reviewed" in line:
                m = re.search(r"\|\s*(\d+)\s*\|", line)
                if m:
                    meta["colonists_reviewed"] = int(m.group(1))
            elif "Skill Updates Applied" in line:
                m = re.search(r"\|\s*(\d+)\s*\|", line)
                if m:
                    meta["skill_updates"] = int(m.group(1))
            elif "L&D Head" in line:
                m = re.search(r"\|\s*\*\*L&D Head\*\*\s*\|\s*(.+?)\s*\|", line)
                if m:
                    meta["ld_head"] = m.group(1)
    except Exception:
        pass
    return meta


@router.get("/status")
def ld_status():
    return get_ld_status()


@router.get("/reports")
def list_reports():
    """List all L&D cycle reports, newest first."""
    if not _REPORTS_DIR.exists():
        return []
    reports = []
    for f in sorted(_REPORTS_DIR.glob("*.md"), reverse=True):
        meta = _parse_report_meta(f)
        # Parse date from filename: 2026-04-09_02-20-33.md
        date_str = f.stem[:10]  # YYYY-MM-DD
        time_str = f.stem[11:16].replace("-", ":")  # HH:MM
        meta["date"] = date_str
        meta["time"] = time_str
        reports.append(meta)
    return reports


@router.get("/reports/onboarding")
def list_onboarding_reports():
    """List all onboarding reports."""
    onboarding_dir = _REPORTS_DIR / "onboarding"
    if not onboarding_dir.exists():
        return []
    reports = []
    for f in sorted(onboarding_dir.glob("*.md"), reverse=True):
        # Filename: 2026-04-08_NOVA.md → agent name = NOVA
        parts = f.stem.split("_", 1)
        reports.append({
            "filename": f.name,
            "date": parts[0] if parts else "",
            "agent_name": parts[1].replace("_", " ") if len(parts) > 1 else f.stem,
        })
    return reports


@router.get("/reports/{filename}")
def get_report(filename: str):
    """Return the markdown content of a cycle report."""
    if not filename.endswith(".md") or "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = _REPORTS_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Report not found")
    return {"filename": filename, "content": path.read_text(encoding="utf-8")}


@router.get("/reports/onboarding/{filename}")
def get_onboarding_report(filename: str):
    """Return the markdown content of an onboarding report."""
    if not filename.endswith(".md") or "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = _REPORTS_DIR / "onboarding" / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Report not found")
    return {"filename": filename, "content": path.read_text(encoding="utf-8")}


@router.get("/agents/{agent_name}/history")
def agent_ld_history(agent_name: str):
    """
    Return all cycle report entries that mention a specific agent,
    plus their onboarding report if it exists.
    """
    results = []

    # Search cycle reports for agent sections
    if _REPORTS_DIR.exists():
        for f in sorted(_REPORTS_DIR.glob("*.md"), reverse=True):
            try:
                content = f.read_text(encoding="utf-8")
                # Each agent section starts with "### AgentName —"
                pattern = rf"### {re.escape(agent_name)} —.*?(?=\n### |\Z)"
                match = re.search(pattern, content, re.DOTALL)
                if match:
                    results.append({
                        "filename": f.name,
                        "date": f.stem[:10],
                        "section": match.group(0).strip(),
                    })
            except Exception:
                pass

    # Check for onboarding report
    onboarding_dir = _REPORTS_DIR / "onboarding"
    onboarding = None
    if onboarding_dir.exists():
        for f in onboarding_dir.glob("*.md"):
            if agent_name.upper() in f.name.upper():
                try:
                    onboarding = {
                        "filename": f.name,
                        "date": f.stem[:10],
                        "content": f.read_text(encoding="utf-8"),
                    }
                except Exception:
                    pass
                break

    return {"cycle_entries": results, "onboarding": onboarding}
