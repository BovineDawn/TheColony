# The Colony — Implementation Plan

**Goal:** Build a futuristic AI agent colony management system where users run a company of AI agents organized in a hierarchy, with Rimworld-inspired visual design, persistent memory, and real AI backends.

**Architecture:**
- React + Vite frontend with Pixi.js for the colony map canvas and Tailwind + shadcn/ui for panels
- FastAPI Python backend with LiteLLM for multi-model AI support and WebSockets for real-time agent communication
- SQLite for local persistent storage of agents, memory, missions, and history

**Tech Stack:**
- Frontend: React 18, Vite, TypeScript, Pixi.js, Tailwind CSS, shadcn/ui, Framer Motion, Zustand
- Backend: FastAPI, LiteLLM, SQLAlchemy, SQLite, python-socketio
- AI: Claude, OpenAI GPT-4, Google Gemini (via LiteLLM)

---

## Project Structure

```
the-colony/
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── colony-map/
│   │   │   ├── agent-tile/
│   │   │   ├── panels/
│   │   │   ├── dashboard/
│   │   │   ├── mission/
│   │   │   ├── onboarding/
│   │   │   └── ui/
│   │   ├── stores/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── types/
│   │   └── styles/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   ├── models/
│   │   ├── services/
│   │   ├── db/
│   │   └── config.py
│   ├── requirements.txt
│   └── .env.example
└── docs/
    └── plans/
```

---

## PHASE 1 — Project Scaffolding & Design System

### Task 1: Initialize frontend

```bash
cd ~/the-colony
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
npm install pixi.js @pixi/react framer-motion zustand @tanstack/react-query socket.io-client lucide-react class-variance-authority clsx tailwind-merge
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card dialog drawer input label badge separator scroll-area tabs tooltip
```

### Task 2: Design tokens (globals.css + tailwind.config.ts)

Colors: background #0A0E1A, surface #111827, primary #00D4FF (cyan), secondary #8B5CF6 (violet)
Fonts: Space Grotesk (headings), Inter (body), JetBrains Mono (code/audit)
Animations: pulse-glow (idle agents), pulse-active (working agents), flow-line (connection lines)

### Task 3: TypeScript types

Files:
- src/types/agent.ts — Agent, AgentStatus, AgentTier, Department, Strike, Reward, AgentSkill
- src/types/colony.ts — Colony, DepartmentZone, ColonyPhase
- src/types/mission.ts — Mission, Message, MissionStatus, MessageType

### Task 4: Zustand stores

Files:
- src/stores/colonyStore.ts — colony, agents, missions CRUD (persisted to localStorage)
- src/stores/uiStore.ts — activeView, activePanel, selectedAgentId

---

## PHASE 2 — Backend Foundation

### Task 5: Initialize FastAPI backend

```bash
cd ~/the-colony/backend
python3 -m venv venv && source venv/bin/activate
pip install fastapi uvicorn sqlalchemy python-socketio litellm python-dotenv pydantic httpx alembic
```

### Task 6: Database models

Files:
- app/db/database.py — SQLAlchemy engine, session, Base, create_tables()
- app/models/agent.py — AgentModel (id, employee_id, name, role, tier, department, model, skills JSON, strikes JSON, rewards JSON, memory_context, tile_x, tile_y, is_active)
- app/models/mission.py — MissionModel, MessageModel

### Task 7: API routes

Files:
- app/api/colony.py — GET /colony, POST /colony/found
- app/api/agents.py — GET /agents, POST /agents, PATCH /agents/{id}, DELETE /agents/{id}
- app/api/missions.py — GET /missions, POST /missions, PATCH /missions/{id}
- app/api/hiring.py — GET /hiring/candidates, POST /hiring/approve, POST /hiring/reject

---

## PHASE 3 — Onboarding / Founding Day

### Task 8: IntroScreen component

Cinematic text fade sequence: "Every great company starts with one decision." then "Build your Colony."
Begin button fades in after lines complete.
Full screen dark with subtle grid background pattern.

File: src/components/onboarding/IntroScreen.tsx

### Task 9: FoundingWizard component

Form: colony name (default "The Colony") + founder name
On submit: creates Colony in store, creates Agent #0001 (Founder), transitions to OnboardingFlow
File: src/components/onboarding/FoundingWizard.tsx

### Task 10: HireCard component

Shows for each founding hire #0002 through #0007
Displays: candidate name, role, department, skills, model, Sr. Executive recommendation text
Two actions: Approve Hire (green) / Reject (red outline)
File: src/components/onboarding/HireCard.tsx

### Task 11: OnboardingFlow orchestrator

Generates 6 founding candidates (one per department: executive, engineering, research, writing, legal, ld)
Shows HireCards one at a time
Each approval: adds agent to store, triggers map arrival animation
After all approved: transitions to AppShell with colony map loaded
File: src/components/onboarding/OnboardingFlow.tsx

### Founding hire defaults

#0002 — Sr. Executive | executive dept | claude-3-5-sonnet
#0003 — Head of Engineering | engineering dept | gpt-4o
#0004 — Head of Research | research dept | claude-3-5-sonnet
#0005 — Head of Writing | writing dept | gemini-1.5-pro
#0006 — Head of Legal | legal dept | gpt-4o
#0007 — Head of L&D | ld dept | claude-3-5-sonnet

---

## PHASE 4 — Colony Map (Pixi.js)

### Task 12: ColonyMap canvas

Pixi.js Application: 14 cols x 10 rows, 120px tiles, background #0A0E1A
Grid overlay: subtle dark lines
Department zones: rounded rect outlines with color glow per department

Department zone layout:
  executive:   cols 5-8,  rows 0-1 (top center)
  engineering: cols 0-3,  rows 3-5 (left)
  research:    cols 5-8,  rows 3-5 (center)
  writing:     cols 10-13, rows 3-5 (right)
  legal:       cols 0-3,  rows 7-9 (bottom left)
  ld:          cols 10-13, rows 7-9 (bottom right)

Founder tile: cols 6-7, row 0 — larger, brighter cyan glow

File: src/components/colony-map/ColonyMap.tsx

### Task 13: Agent tile rendering

Each agent tile renders inside Pixi stage:
- Name badge style: employee ID (top left, font-mono), name (center, font-heading), role (below name, dept color)
- Status dot: top right — grey=idle, amber=thinking, green=working, cyan=chatting, pink=training
- Hover: tile brightens, cursor pointer
- Click: fires setSelectedAgent + setActivePanel('agent-profile')

### Task 14: Arriving animations

On hire approval during onboarding: agent tile fades in with a glow burst
Connection line draws from manager to new hire (animated flow dots)
Zone lights up brighter when first agent arrives

---

## PHASE 5 — Agent Profile Panel

### Task 15: AgentProfilePanel

Slides in from right (Framer Motion spring)
Top color stripe = department color
Shows: employee ID, name, role, department badge, model badge
Stats row: days tenure, strike count, award count
Skills list with level tags
Strike history (if any)
Personality note
File: src/components/panels/AgentProfilePanel.tsx

---

## PHASE 6 — Morning Briefing Dashboard

### Task 16: MorningBriefing

Greeting: "Good morning, [Founder name]."
Date line in font-mono
Pending approvals warning if any
5 DepartmentCards in grid (engineering, research, writing, legal, ld)
IdeasFeed below cards

File: src/components/dashboard/MorningBriefing.tsx

### Task 17: DepartmentCard

Shows: department name, agent count, active task count, status (green/amber/red)
Placeholder data for now, hooks into real missions in Phase 9
File: src/components/dashboard/DepartmentCard.tsx

### Task 18: IdeasFeed

"Ideas from the floor" section
Placeholder cards with agent name, idea text, upvote button
Hooks into real agent suggestions in Phase 9
File: src/components/dashboard/IdeasFeed.tsx

---

## PHASE 7 — App Shell & Navigation

### Task 19: AppShell

Left sidebar (narrow, icon-only):
  - Colony icon (top)
  - Dashboard icon (MorningBriefing view)
  - Map icon (ColonyMap view)
  - Chat icon (MissionControl view)
  - Org icon (OrgChart view)
  - Settings icon (bottom)

Main content area: renders active view
Right side: AgentProfilePanel overlays when active

File: src/components/layout/AppShell.tsx

### Task 20: TopNav bar

Colony name (top left)
Active agents count
Current date/time (font-mono)
Notification bell (pending approvals count)
File: src/components/layout/TopNav.tsx

---

## PHASE 8 — Mission Control

### Task 21: MissionControl

Toggle at top: Chat / Formal Brief
Chat mode: conversational interface, messages list, input at bottom
Formal Brief mode: structured form (title, objective, priority, deadline)
Escalation inbox: collapsible section showing urgent agent flags
Audit Drawer: pull-out right panel with full agent-to-agent logs
File: src/components/mission/MissionControl.tsx

---

## PHASE 9 — AI Backend Integration

### Task 22: LiteLLM service

Unified call_agent(agent, messages) that routes to correct model
System prompt builder: injects agent name, role, personality, skills, memory
File: backend/app/services/llm.py

### Task 23: Orchestrator service

Receives mission from founder
Routes to Sr. Executive agent
Sr. Executive decomposes task and delegates to department managers
Managers delegate to workers
Results bubble back up through hierarchy
Status updates emitted via WebSocket to frontend
File: backend/app/services/orchestrator.py

### Task 24: Memory service

Compress agent conversation history into rolling summary
Store compressed context in agent.memory_context
On agent call: inject memory_context into system prompt
File: backend/app/services/memory.py

### Task 25: Quality monitoring service

Score agent responses for coherence and relevance (0-100)
Flag responses below threshold for review
Auto-notify L&D department head on repeated low scores
Track score history per agent
File: backend/app/services/quality.py

---

## PHASE 10 — Org Chart View

### Task 26: OrgChart component

D3.js or custom SVG tree layout
Nodes = agent tiles (mini badge style)
Edges = hierarchy lines with flow animation
Click node = opens AgentProfilePanel
Color coded by department
Toggle between tree view and colony map view
File: src/components/panels/OrgChart.tsx

---

## PHASE 11 — Hiring Pipeline (Post-#0007)

### Task 27: HiringPipeline component

Triggered when a manager submits a hiring recommendation
Shows candidate card with manager reasoning
Duplicate role warning: red alert if role already exists in that dept
User approves or rejects
Approved: agent created with next sequential employee ID, added to map
File: src/components/panels/HiringPipeline.tsx

---

## PHASE 12 — Strike & L&D System

### Task 28: Strike management

Manual flag: Founder can flag any agent output as a strike
Auto-flag: quality score below 50 triggers a strike review
Strike 1: L&D notified, training card appears in L&D zone
Strike 2: Formal training session visual on colony map, manager alerted
Strike 3: Escalated to Founder inbox for final decision
Never fire without Founder approval

### Task 29: Training session visual

L&D zone shows animated group shimmer when session active
Affected agent tile shows "IN TRAINING" overlay
Duration: configurable, default 24h before agent returns to active
File: src/components/colony-map/TrainingSession.tsx

---

## PHASE 13 — Rewards & Promotions

### Task 30: Ideas & rewards system

Agents can submit process optimization ideas via their manager
Ideas appear in Morning Briefing "Ideas from the floor" feed
Founder can approve: adds a reward badge to agent profile
Promotion: requires manager recommendation + Founder approval
Promoted agents: role title updates, tile gets a subtle gold glow

---

## VERIFICATION CHECKLIST

Phase 1 done when:
  - npm run dev runs on localhost:5173 with no errors
  - uvicorn starts on localhost:8000
  - GET /health returns {"status": "Colony is online"}
  - Design tokens render correctly (dark bg, cyan accents)

Onboarding done when:
  - Fresh load shows intro cinematic
  - Founding wizard creates #0001 in store
  - HireCards show for #0002-#0007
  - Each approval adds agent to colony map with arrival animation
  - After #0007, transitions to Morning Briefing

Colony map done when:
  - All department zones render with correct colors
  - Agent tiles render in correct zones
  - Clicking a tile opens AgentProfilePanel
  - Status dots update when agent status changes

AI integration done when:
  - Posting a mission to /api/missions triggers orchestrator
  - Sr. Executive receives mission and delegates to managers
  - Workers execute and return results
  - Results visible in Mission Control
  - Agent memory persists between sessions
