# The Colony — Brainstorm & Ideas Log

Ideas discussed, considered, or queued. Never lose a good idea again.
Format: each idea gets a status — QUEUED / IN PROGRESS / DONE / REJECTED (with reason)

---

## Session: April 07, 2026

### 10 Feature Suggestions (based on codebase audit)

1. **Live Activity Feed** [DONE]
   Colony Activity section in MorningBriefing shows "No activity yet" — a permanent empty state.
   Wire up a real event log: mission completions, strikes, hires, promotions, training starts.
   Store events in Zustand (or SQLite via backend) and render them as a timeline feed.

2. **Animated Agent Tiles** [DONE]
   ColonyMap agent tiles are static — no breathing or pulse animations.
   Add a Pixi.js ticker loop: idle = slow breathing glow, working = faster pulse, training = pink shimmer.
   Makes the map feel alive instead of a static org chart.

3. **Worker Agent Tier** [DONE]
   Orchestrator dispatches to managers only. No worker agents exist yet.
   Add a 3rd tier: workers report to managers, managers delegate sub-tasks to them.
   Hiring pipeline already supports non-manager roles — just needs orchestrator support.

4. **Agent Memory Integration** [DONE]
   memory.py exists in backend but isn't wired into agent calls.
   Each agent should accumulate a rolling compressed memory of past missions.
   Inject memory_context into system prompt so agents remember past work.

5. **Quality Monitoring Service** [DONE]
   quality.py was planned but never built.
   Score agent responses 0-100 for coherence/relevance.
   Auto-flag low scores as a strike review, auto-notify L&D head.

6. **Org Chart Polish** [DONE]
   OrgChart.tsx exists but unknown if it's fully functional with real agent data.
   Should render live hierarchy from Zustand store, not placeholder data.
   Click a node → opens AgentProfilePanel for that agent.

7. **Mission History / Archive** [DONE]
   MissionControl messages disappear when you navigate away.
   Add a persistent mission log — each mission saved to SQLite with full transcript.
   Browse past missions from a sidebar in Mission Control.

8. **Tile Overflow Handling** [DONE]
   HiringPipeline has hardcoded tile positions per dept (max 4 workers).
   When all slots are filled, new hires fall back to {x:0, y:0} — wrong.
   Need a smarter tile assignment: auto-expand to adjacent empty tiles.

9. **Founder Inbox / Escalation Center** [DONE]
   No dedicated place for things requiring Founder attention (strike-3 escalations, hiring approvals, agent ideas).
   Build an Inbox view in AppShell — notification badge on sidebar icon.
   Everything that needs your decision routes here.

10. **Colony Settings & API Key Management** [DONE]
    Settings icon in AppShell sidebar goes nowhere.
    Build a Settings panel: colony name, founder name, API keys per model, default model per dept.
    Allows runtime config without touching .env files.

---

---

## Session: April 07, 2026 — UI Overhaul

### Completed
- **Rimworld ID Card Agent Tiles** [DONE] — Pixi.js tiles redesigned: amber border, dept stripe, employee ID, name in uppercase, barcode, status dot, strike indicator
- **AgentProfilePanel — Full ID Card Dossier** [DONE] — Rimworld reference faithfully implemented: mugshot frame with ruler, THE COLONY header, star emblem, barcode + ref code footer, "SURVIVAL IS OUR ONLY LAW." quote, grain texture overlay, data fields in label:value format, commend/strike actions
- **Design System Overhaul** [DONE] — New palette: warm charcoal base + amber accent (hsl 42 65% 52%) + cyan tech. Added Rajdhani display font. Grain texture via CSS. Updated all CSS tokens
- **AppShell Upgrade** [DONE] — Amber diamond logo, amber active state indicators with left-edge bars, better topbar with Rajdhani colony name + uppercase mono labels, active agents pill, metrics row

---

## Ideas Parking Lot (future sessions)

- Agent personality evolution over time (traits shift based on performance)
- Dark mode / light mode toggle
- Export colony report as PDF
- Agent "mood" visible on tile (color tint changes with strike count)
- Multi-colony support (switch between colonies)
- Public shareable colony snapshot (read-only link)

