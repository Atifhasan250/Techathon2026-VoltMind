# Lights, Fans, Discord: The Boss's Big Idea — Full Implementation Plan

## Overview

Build an office device monitoring system with **15 simulated electrical devices** (2 fans and 3 lights in each of 3 rooms), a **real-time web dashboard**, and a **Discord bot** — all sharing one backend. The system tracks device on/off states, power consumption, and generates alerts for anomalies.

---

## Evaluation Criteria Breakdown (what matters most)

| Criterion | Weight | Our Strategy |
|-----------|--------|-------------|
| Working web dashboard with real-time data | **20%** | SSE-powered live updates, no page refresh needed |
| Working Discord bot reflecting real simulated data | **10%** | Bot queries the same backend API, LLM-humanized responses |
| Dashboard visuals and UX quality | **10%** | Premium dark-mode dashboard using `impeccable` + `ui-ux-pro-max` + `gpt-taste` skills |
| Clear, correct system diagram | **15%** | Excalidraw diagram using `excalidraw-diagram-generator` skill (NOT Mermaid) |
| Sensible circuit schematic | **15%** | Wokwi project for one representative room |
| Quality of demo & dummy data simulation | **15%** | Realistic simulator with random state changes, time-aware behavior |
| Well-structured and documented codebase, commits | **15%** | Clean file structure, README, .env.example, semantic commits |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SIMULATED DEVICE LAYER                      │
│  In-memory store: 15 live devices (3 rooms × 5 devices each)   │
│  Simulator timer: randomly toggles devices, updates timestamps  │
│  Calculates power draw per device based on type + status        │
│  MongoDB history: minute samples + state-change events (TTL)     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NEXT.JS BACKEND (API)                       │
│                                                                 │
│  Route Handlers (app/api/):                                     │
│  ├── GET  /api/devices       → All 15 devices + state           │
│  ├── GET  /api/devices/room/[name] → Devices for a room         │
│  ├── GET  /api/power         → Total + per-room power summary   │
│  ├── GET  /api/alerts        → Active anomaly alerts            │
│  ├── GET  /api/analytics     → Actual kWh + historical samples   │
│  ├── POST /api/devices/[id]/toggle → Toggle a device on/off     │
│  └── GET  /api/sse           → Server-Sent Events stream        │
│                                                                 │
│  SSE stream pushes state changes to the dashboard               │
└────────┬────────────────────────────┬───────────────────────────┘
         │                            │
         ▼                            ▼
┌─────────────────────┐    ┌──────────────────────────┐
│   WEB DASHBOARD     │    │     DISCORD BOT          │
│   (Next.js App)     │    │   (discord.js process)   │
│                     │    │                          │
│ • Live Device Panel │    │  !status → all rooms     │
│ • Power Meter       │    │  !room <name> → room     │
│ • Alerts Panel      │    │  !usage → power stats    │
│ • Top-View Layout   │    │                          │
│ • Auto-updates      │    │  LLM humanized replies   │
│   via SSE           │    │  Alert push to channel   │
└─────────────────────┘    └──────────────────────────┘
```

**CRITICAL**: Both the dashboard and Discord bot read from the same in-memory device store via the same API routes. No separate data copies. Single source of truth.

---

## File Structure (Final)

```
hackathon/
├── .agents/skills/              # Already exists — design & diagram skills
├── app/
│   ├── globals.css              # Design tokens, theme, layout utilities
│   ├── layout.tsx               # Root layout with fonts, metadata
│   ├── page.tsx                 # Main dashboard page
│   ├── components/
│   │   ├── DevicePanel.tsx      # Live device status cards by room
│   │   ├── PowerMeter.tsx       # Total + per-room power consumption
│   │   ├── AlertsPanel.tsx      # Active anomaly alerts
│   │   ├── OfficeTopView.tsx    # Top-view SVG office layout (BONUS)
│   │   ├── DeviceCard.tsx       # Individual device card (light/fan)
│   │   ├── RoomSection.tsx      # Room grouping wrapper
│   │   └── Header.tsx           # Dashboard header / nav bar
│   ├── hooks/
│   │   └── useDeviceStream.ts   # Custom hook for SSE connection
│   └── api/
│       ├── devices/
│       │   ├── route.ts         # GET all devices
│       │   ├── [id]/
│       │   │   └── toggle/
│       │   │       └── route.ts # POST toggle device
│       │   └── room/
│       │       └── [name]/
│       │           └── route.ts # GET devices by room
│       ├── power/
│       │   └── route.ts         # GET power consumption
│       ├── alerts/
│       │   └── route.ts         # GET active alerts
│       └── sse/
│           └── route.ts         # GET Server-Sent Events stream
├── lib/
│   ├── devices.ts               # Device store + simulator engine
│   ├── alerts.ts                # Alert detection logic
│   ├── types.ts                 # TypeScript interfaces
│   └── constants.ts             # Room names, wattage values, office hours
├── bot/
│   ├── index.ts                 # Discord bot entry point
│   ├── commands.ts              # Command handlers (!status, !room, !usage)
│   ├── llm.ts                   # Gemini API integration for humanized responses
│   └── alertWatcher.ts          # Proactive alert poster (BONUS)
├── diagrams/
│   ├── system-diagram.excalidraw    # High-level system diagram
│   └── circuit-schematic.png        # Screenshot from Wokwi (or link)
├── wokwi/
│   └── README.md                # Wokwi project link + explanation
├── .env                         # API keys (gitignored)
├── .env.example                 # Template for env vars
├── README.md                    # Setup + run instructions
├── plan.md                      # This file
├── package.json                 # Dependencies
└── tsconfig.json                # TypeScript strict mode
```

---

## Task Breakdown (Detailed Chunks)

Each task is small and self-contained. Tasks are grouped into **7 phases**. Within each phase, who does the work is marked:

- 🤖 **Agent** = The AI agent builds this
- 👤 **You** = You must do this manually
- 🤝 **Both** = Agent prepares, you verify/complete

---

### Phase 0: Project Setup & Preparation

| # | Task | Who | Details |
|---|------|-----|---------|
| 0.1 | Install additional npm dependencies | 🤖 | `discord.js`, `@google/genai` (Gemini SDK), and any needed utilities |
| 0.2 | Create `.env.example` template | 🤖 | List all required env vars with placeholder values |
| 0.3 | Add Discord bot env vars to `.env` | 👤 | You need to create a Discord bot at [Discord Developer Portal](https://discord.com/developers/applications), get the bot token, and add `DISCORD_TOKEN`, `DISCORD_CHANNEL_ID`, `DISCORD_GUILD_ID` to `.env` |
| 0.4 | Set up TypeScript strict mode | 🤖 | Update `tsconfig.json` with `"strict": true` |
| 0.5 | Configure `next.config.ts` | 🤖 | Add `serverExternalPackages: ['discord.js']` if needed |
| 0.6 | Update `.gitignore` | 🤖 | Ensure `node_modules`, `.env`, `.next` are ignored |

---

### ⚠️ IMPORTANT: What YOU Must Do Before We Start

#### 1. Create a Discord Bot Application
1. Go to https://discord.com/developers/applications
2. Click "New Application" → name it (e.g., "Office Monitor Bot")
3. Go to "Bot" section → click "Reset Token" → **copy the token**
4. Enable **"Message Content Intent"** under Privileged Gateway Intents
5. Go to "OAuth2" → URL Generator → select `bot` scope + permissions: `Send Messages`, `Read Message History`, `Read Messages/View Channels`
6. Copy the generated URL → open it → add bot to your Discord server

#### 2. Get your Discord Server's channel ID
- Enable Developer Mode in Discord settings (Settings → Advanced → Developer Mode)
- Right-click the channel you want alerts posted to → Copy Channel ID

#### 3. Add to your `.env` file
```
DISCORD_TOKEN=your_bot_token_here
DISCORD_CHANNEL_ID=your_channel_id_here
```

#### 4. Configure Gemini keys (optional)
Add up to three keys as `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, and `GEMINI_API_KEY_3`. The bot rotates keys after failures and retains a deterministic fallback, so core commands do not depend on an LLM.

---

### Phase 1: Simulated Device Data Layer

This is the **foundation** — everything else reads from this.

| # | Task | Who | Details |
|---|------|-----|---------|
| 1.1 | Define TypeScript interfaces | 🤖 | `Device`, `Room`, `PowerSummary`, `Alert` types in `lib/types.ts` |
| 1.2 | Define constants | 🤖 | Room names (`Drawing Room`, `Work Room 1`, `Work Room 2`), wattage values (fan=60W, light=15W), office hours (9AM–5PM) in `lib/constants.ts` |
| 1.3 | Create device store | 🤖 | In-memory store with all 15 devices, initial random states, in `lib/devices.ts` |
| 1.4 | Build simulator engine | 🤖 | Timer that randomly toggles 1-2 devices every 5-15 seconds, updates `lastChanged` timestamps |
| 1.5 | Build alert detection logic | 🤖 | Check for: devices ON after office hours (after 5PM), all devices in a room ON for 2+ hours continuously. In `lib/alerts.ts` |
| 1.6 | Add event emitter for state changes | 🤖 | When any device changes, emit an event so SSE can push updates |

#### Device data shape:
```typescript
interface Device {
  id: string;              // e.g., "drawing-room-fan-1"
  name: string;            // e.g., "Fan 1"
  type: "fan" | "light";
  room: "Drawing Room" | "Work Room 1" | "Work Room 2";
  status: "on" | "off";
  wattage: number;         // 60 for fan, 15 for light (when ON)
  lastChanged: string;     // ISO timestamp
}
```

---

### Phase 2: Backend API Routes

| # | Task | Who | Details |
|---|------|-----|---------|
| 2.1 | `GET /api/devices` | 🤖 | Returns all 15 devices with current state |
| 2.2 | `GET /api/devices/room/[name]` | 🤖 | Returns devices filtered by room name |
| 2.3 | `POST /api/devices/[id]/toggle` | 🤖 | Toggles a device's on/off state, updates timestamp, emits change event |
| 2.4 | `GET /api/power` | 🤖 | Returns total watts, per-room watts, estimated daily kWh |
| 2.5 | `GET /api/alerts` | 🤖 | Returns list of active alerts with timestamps |
| 2.6 | `GET /api/sse` | 🤖 | Server-Sent Events endpoint — streams device changes + alert events to connected dashboard clients in real-time |

**SSE approach rationale**: Next.js App Router supports streaming responses natively. SSE is simpler than WebSocket for this one-directional push use case, requires no extra server, and works with the existing Next.js dev server.

---

### Phase 3: Web Dashboard (Frontend)

This is the **highest-weight deliverable** (20% dashboard + 10% UX = 30% total).

#### Phase 3A: Design System & Layout

| # | Task | Who | Details |
|---|------|-----|---------|
| 3A.1 | Generate design system using `ui-ux-pro-max` skill | 🤖 | Run the skill's search script to get color palette, typography, spacing for a dark-mode IoT monitoring dashboard |
| 3A.2 | Build `globals.css` with design tokens | 🤖 | CSS custom properties for colors, spacing, typography, shadows — dark mode dashboard theme |
| 3A.3 | Import Google Fonts | 🤖 | Use `next/font` to load chosen font pair (e.g., Inter for body, JetBrains Mono for data) |
| 3A.4 | Create layout shell with Header | 🤖 | Dashboard header with title "Office Monitor", live clock, total power indicator |

#### Phase 3B: Core Dashboard Components

| # | Task | Who | Details |
|---|------|-----|---------|
| 3B.1 | Build `useDeviceStream` hook | 🤖 | Custom React hook that connects to `/api/sse`, parses events, returns reactive device state |
| 3B.2 | Build `DeviceCard` component | 🤖 | Individual card for one device — shows name, type icon (SVG light bulb / fan blade), on/off status with glow effect, wattage, last changed time. Toggle button to switch state |
| 3B.3 | Build `RoomSection` component | 🤖 | Groups 5 devices under a room heading, shows room total power |
| 3B.4 | Build `DevicePanel` component | 🤖 | Container for all 3 room sections, organized as tabs or stacked sections |
| 3B.5 | Build `PowerMeter` component | 🤖 | Shows total office power (big number), per-room breakdown bars, estimated daily kWh. Animated counter for live feel |
| 3B.6 | Build `AlertsPanel` component | 🤖 | Shows active alerts with timestamps, severity indicators, auto-dismisses resolved alerts. Pulse animation on new alerts |

#### Phase 3C: Bonus Visual Features

| # | Task | Who | Details |
|---|------|-----|---------|
| 3C.1 | Build `OfficeTopView` component (BONUS) | 🤖 | SVG/CSS top-view floor plan of office. 3 rooms visible. Lights glow when ON, fans show spinning CSS animation when ON. Chairs, tables as subtle background elements |
| 3C.2 | Add micro-animations | 🤖 | Smooth transitions for device state changes, power meter counting animation, alert slide-in |
| 3C.3 | Responsive layout | 🤖 | Works on mobile (stacked) and desktop (grid layout) |

#### Dashboard UI Concept:

```
┌─────────────────────────────────────────────────────────┐
│  ⚡ Office Monitor                    Total: 345W  🕐  │  ← Header
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ Power Overview ──────┐  ┌─ Alerts ──────────────┐  │
│  │  Total: 345W          │  │ ⚠ Work Room 2: all    │  │
│  │  ████████░░ 345/1080W │  │   devices ON for 2h+  │  │
│  │                       │  │ ⚠ Drawing Room: Light  │  │
│  │  Drawing Room   90W   │  │   3 ON after hours     │  │
│  │  Work Room 1   120W   │  │                        │  │
│  │  Work Room 2   135W   │  │                        │  │
│  └───────────────────────┘  └────────────────────────┘  │
│                                                         │
│  ┌─ Office Floor Plan (Top View) ──────────────────┐   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │   │
│  │  │ Drawing  │ │ Work     │ │ Work             │ │   │
│  │  │ Room     │ │ Room 1   │ │ Room 2           │ │   │
│  │  │ 💡💡💡  │ │ 💡💡💡  │ │ 💡💡💡          │ │   │
│  │  │ 🌀 🌀   │ │ 🌀 🌀   │ │ 🌀 🌀           │ │   │
│  │  └──────────┘ └──────────┘ └──────────────────┘ │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ Drawing Room ─────────────────────────────────────┐ │
│  │  [Fan 1 ON 60W] [Fan 2 OFF] [Light1 ON 15W] ...   │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌─ Work Room 1 ──────────────────────────────────────┐ │
│  │  [Fan 1 OFF] [Fan 2 ON 60W] [Light1 OFF] ...      │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌─ Work Room 2 ──────────────────────────────────────┐ │
│  │  [Fan 1 ON 60W] [Fan 2 ON 60W] [Light1 ON 15W]... │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### Visual effects for device cards:
- **Light ON**: Warm yellow glow (`box-shadow` radial), bright icon
- **Light OFF**: Dim gray, muted icon
- **Fan ON**: Spinning animation on fan blade icon (`@keyframes spin`)
- **Fan OFF**: Static gray fan icon

---

### Phase 4: Discord Bot

| # | Task | Who | Details |
|---|------|-----|---------|
| 4.1 | Set up discord.js client | 🤖 | Create `bot/index.ts` with Client initialization, login with token from env |
| 4.2 | Implement `!status` command | 🤖 | Calls `/api/devices`, formats per-room summary. Uses LLM to humanize response |
| 4.3 | Implement `!room <name>` command | 🤖 | Calls `/api/devices/room/[name]`, shows detailed device list for that room |
| 4.4 | Implement `!usage` command | 🤖 | Calls `/api/power`, shows current total watts + estimated daily kWh |
| 4.5 | Integrate Gemini LLM for humanized responses | 🤖 | Pass raw data to Gemini API with a system prompt to generate friendly, conversational responses (not robotic data dumps) |
| 4.6 | Build alert watcher (BONUS) | 🤖 | Polls `/api/alerts` every 60 seconds, posts new alerts to designated channel with friendly tone |
| 4.7 | Add `bot:start` script to package.json | 🤖 | Run the TypeScript bot directly with Bun and `.env` loading |

**Bot architecture**: The bot runs as a **separate process** alongside the Next.js dev server. It calls the same API routes (`http://localhost:3000/api/...`) that the dashboard uses.

#### LLM response example:
```
User: !status
Bot: "Hey boss! 👋 Here's the office rundown:

🏢 Drawing Room — Pretty chill right now. 1 fan humming away, 
   2 lights keeping it cozy. Power draw: ~90W

💼 Work Room 1 — All quiet on the western front! Everything's 
   switched off. Zero watts being burned. Nice!

💼 Work Room 2 — Bit of a party going on — 2 fans AND 3 lights 
   are all ON. That's 165W right there. Someone working late? 🤔"
```

#### Alert push example (BONUS):
```
Bot (auto-post to #alerts channel):
"⚠️ Hey! Work Room 2 still has 2 fans and 3 lights ON 
and it's 10 PM. Did someone forget to leave?"
```

---

### Phase 5: System Diagrams

| # | Task | Who | Details |
|---|------|-----|---------|
| 5.1 | Create high-level system diagram | 🤖 | Using `excalidraw-diagram-generator` skill. Shows: Physical Devices → Simulated Data Layer → Next.js Backend API → (Web Dashboard + Discord Bot) → User. Full data flow with labeled arrows |
| 5.2 | Create hardware/circuit schematic | 🤝 | **Agent** writes a `wokwi/README.md` explaining the circuit concept + sample Arduino sketch. **You** create the actual circuit on Wokwi.com (or Tinkercad) |

#### Circuit Schematic — What You Must Do (Task 5.2)

The hackathon requires a **Wokwi or Tinkercad circuit design** for one representative room. This is a visual/simulation tool and cannot be fully automated by an agent. Here's what to build:

**Components for ONE room (representative):**
- 1× ESP32 (or Arduino Uno) microcontroller
- 2× DC Motors (representing fans) — connected to digital output pins
- 3× LEDs (representing lights) — connected to digital output pins with 220Ω resistors
- 2× Relay modules (representing fan control)
- 1× ACS712 current sensor (optional — for power sensing demo)
- Power supply connections

**Wokwi steps:**
1. Go to https://wokwi.com → New Project → ESP32
2. Add components from the parts list above
3. Wire them: ESP32 GPIO pins → Relays → Motors / LEDs
4. Write a simple Arduino sketch that toggles devices and reads sensor values
5. Save and get the shareable link
6. Take a screenshot for the repo

The agent will provide a sample Arduino sketch in `wokwi/README.md` and a wiring guide.

---

### Phase 6: Documentation & Polish

| # | Task | Who | Details |
|---|------|-----|---------|
| 6.1 | Write comprehensive README.md | 🤖 | Project overview, setup steps, how to run (backend + dashboard + bot), screenshots, architecture explanation |
| 6.2 | Create `.env.example` | 🤖 | Template with all required variables and comments |
| 6.3 | Code comments and JSDoc | 🤖 | All files documented with clear comments |
| 6.4 | Final design polish pass | 🤖 | Use `impeccable` skill for critique/polish of dashboard UI |
| 6.5 | Git commits | 🤝 | Agent writes code, you commit with semantic messages (or agent commits if git access is granted) |
| 6.6 | Push to GitHub/GitLab | 👤 | Create public repo, push all code, ensure diagrams are included |

---

### Phase 7: Verification & Testing

| # | Task | Who | Details |
|---|------|-----|---------|
| 7.1 | Verify dashboard loads and updates in real-time | 🤝 | Start `npm run dev`, open dashboard, confirm devices update without refresh |
| 7.2 | Verify Discord bot responds correctly | 🤝 | Run bot, test `!status`, `!room work1`, `!usage` in Discord |
| 7.3 | Verify bot and dashboard show same data | 🤝 | Toggle a device on dashboard, check if bot's next `!status` reflects the change |
| 7.4 | Verify alerts trigger correctly | 🤝 | Wait for after-hours simulation or manually trigger, check alerts panel + Discord |
| 7.5 | Screenshot the dashboard | 🤖 | Use `agent-browser` skill to take screenshots for README |
| 7.6 | Cross-check against evaluation criteria | 🤝 | Walk through all 7 criteria and confirm each is met |

---

## Technology Choices & Rationale

| Technology | Purpose | Why |
|-----------|---------|-----|
| **Next.js 16 (App Router)** | Web framework | Already scaffolded, supports API routes + SSE + React Server Components |
| **TailwindCSS 4** | Styling | Already installed, fast utility-first CSS for dashboard |
| **Server-Sent Events (SSE)** | Real-time updates | Simpler than WebSocket for one-way server→client push, native Next.js support |
| **In-memory store** | Device state | No database needed — simulated data, fast, simple. Resets on server restart |
| **discord.js** | Discord bot | Most popular, well-documented Discord library for Node.js |
| **@google/genai** | LLM responses | Gemini API for humanizing bot responses. Keys already in `.env` |
| **Excalidraw** | System diagram | Required by hackathon rules (no Mermaid). `excalidraw-diagram-generator` skill available |
| **Wokwi** | Circuit schematic | Free browser-based simulator, good for ESP32 + LED circuits |
| **TypeScript (strict)** | Language | Required by `AGENTS.md` rules |

---

## Design & UX Approach

### Color Theme (Dark Mode Dashboard)

The dashboard will use a **dark mode** theme inspired by professional monitoring dashboards (like Grafana, Datadog):

- **Background**: Deep dark navy (`oklch(0.15 0.02 260)`)
- **Surface/Cards**: Slightly lighter (`oklch(0.20 0.02 260)`)
- **Primary accent**: Electric blue (`oklch(0.70 0.18 240)`) — for active states, borders
- **ON state - Light**: Warm amber glow (`oklch(0.85 0.16 85)`)
- **ON state - Fan**: Cool cyan (`oklch(0.75 0.14 195)`)
- **OFF state**: Muted gray (`oklch(0.40 0.01 260)`)
- **Alert/Warning**: Vivid orange-red (`oklch(0.70 0.20 30)`)
- **Success/Good**: Soft green (`oklch(0.70 0.16 150)`)
- **Text primary**: Near-white (`oklch(0.95 0.01 260)`)
- **Text secondary**: Medium gray (`oklch(0.65 0.01 260)`)

### Typography

- **Headings**: `Inter` (weight 600-700)
- **Body/Data**: `Inter` (weight 400)
- **Numbers/Metrics**: `JetBrains Mono` or tabular-lining figures for aligned data
- **Base size**: 16px body, metrics at 32-48px for prominence

### Key UX Decisions

1. **Top-view office layout** at the top of the dashboard — gives instant spatial understanding
2. **Room-grouped device cards** below — detailed status per room
3. **Power meter** as a sidebar widget (desktop) or top card (mobile)
4. **Alerts** as a notification panel with visual urgency
5. **No page refresh needed** — SSE provides continuous updates
6. **Click-to-toggle** devices from the dashboard for interactive demo

### Animations

- Device state toggle: smooth color + glow transition (300ms ease-out)
- Fan ON: CSS `@keyframes spin` on fan blade SVG (2s linear infinite)
- Light ON: Pulsing glow effect (`box-shadow` animation)
- Power meter: Animated counter (number counting up/down)
- Alerts: Slide-in from right with subtle bounce
- New data: Brief highlight flash on changed device card

---

## Agent Skills Usage Plan

| Skill | When Used | Purpose |
|-------|-----------|---------|
| `excalidraw-diagram-generator` | Phase 5 (Task 5.1) | Generate the high-level system architecture diagram as `.excalidraw` file |
| `ui-ux-pro-max` | Phase 3A (Task 3A.1) | Generate design system — color palette, typography, spacing for the dashboard |
| `impeccable` | Phase 6 (Task 6.4) | Final polish/critique pass on the dashboard UI for production quality |
| `gpt-taste` | Phase 3C | Reference for premium animation and visual design patterns |
| `agent-browser` | Phase 7 (Task 7.5) | Take screenshots of the running dashboard for README |
| `find-skills` | If needed | Discover any additional skills needed during development |

---

## Open Questions (Answer Before Starting)

1. **Discord bot token ready?** Have you already created the Discord bot application, or do you need step-by-step guidance to set it up?

2. **Wokwi vs Tinkercad?** The hackathon says to explore both. Do you have a preference? (The agent will write the Arduino sketch either way — you just need to wire it in the tool)

3. **Gemini key strategy (resolved)**: Rotate through all three configured keys and preserve a deterministic fallback.

4. **Discord implementation (resolved)**: The bot is implemented first and runs as a separate process against the shared backend.

5. **Git strategy**: Should the agent commit as it goes, or do you prefer to review all changes first and commit yourself?

---

## Execution Order (Recommended)

```
Phase 0 (Setup)          ──→  ~10 min
Phase 1 (Device Layer)   ──→  ~20 min
Phase 2 (API Routes)     ──→  ~15 min
Phase 3A (Design System) ──→  ~15 min
Phase 3B (Components)    ──→  ~45 min
Phase 3C (Bonus Visual)  ──→  ~30 min
Phase 4 (Discord Bot)    ──→  ~30 min
Phase 5 (Diagrams)       ──→  ~20 min
Phase 6 (Documentation)  ──→  ~15 min
Phase 7 (Verification)   ──→  ~15 min
                          ─────────────
                    Total:  ~3.5 hours (agent time)
```

**TIP**: While the agent builds Phases 0-3, you can simultaneously:
1. Create the Discord bot application (Phase 0.3)
2. Start the Wokwi circuit (Phase 5.2)
3. Create the GitHub repo for final push (Phase 6.6)

---

## Verification Plan

### Automated Checks
- `npm run build` — Ensure Next.js builds without errors
- `npm run lint` — Pass ESLint checks
- TypeScript strict mode — No type errors

### Manual Verification
- Dashboard loads at `http://localhost:3000` and devices update in real-time
- Discord bot responds to `!status`, `!room <name>`, `!usage` with humanized LLM responses
- Toggling a device on the dashboard is reflected in the bot's next response
- Alerts appear both on dashboard and in Discord channel
- System diagram opens correctly in Excalidraw
- README instructions are sufficient for someone else to set up and run the project
