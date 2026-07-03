# VoltMind

> A real-time office energy monitoring system powered by simulated devices, a
> shared Next.js backend, a live web dashboard, and a Discord assistant.

## Quick links

- [Problem statement](#problem-statement)
- [Solution approach](#solution-approach)
- [System architecture](#system-architecture)
- [Technologies used](#technologies-used)
- [Current implementation status](#current-implementation-status)
- [Setup and installation](#setup-and-installation)
- [How to run the application](#how-to-run-the-application)
- [Discord bot usage](#discord-bot-usage)
- [API documentation](#api-documentation)
- [Real-time update flow](#real-time-update-flow)
- [AI integration](#ai-integration)
- [Project structure](#project-structure)
- [Diagrams](#diagrams)
- [Testing and verification](#testing-and-verification)
- [Known limitations and remaining work](#known-limitations-and-remaining-work)

## Problem statement

The office operates through Discord, but lights and fans are regularly left on
after employees leave. This wastes electricity, increases operating costs, and
is usually discovered too late.

VoltMind must provide one consistent view of the office through both a web
dashboard and a Discord bot. The fixed office setup contains three rooms:

- **Drawing Room** — waiting and visitor area;
- **Work Room 1** — employee workspace; and
- **Work Room 2** — employee workspace.

Each room contains two fans and three lights. The system therefore monitors
**15 devices in total**: six fans and nine lights.

Every device must expose:

- current status: `on` or `off`;
- rated wattage;
- room;
- device name and type; and
- the timestamp of its most recent state change.

Because the project does not use physical hardware, device activity must be
simulated and must change over time. The dashboard must update without a page
refresh, while the Discord bot must answer from the same current state rather
than from hardcoded responses.

## Solution approach

VoltMind uses a deliberately small architecture with one source of truth:

1. An in-memory simulator owns the state of all 15 devices.
2. One or two devices are toggled every 5–15 seconds.
3. Every change updates the device's `status` and `lastChanged` timestamp.
4. The backend derives current power consumption and active alerts from this
   shared state.
5. REST endpoints provide complete snapshots and targeted queries.
6. Server-Sent Events push changes to the dashboard in real time.
7. The Discord bot reads `/api/state`, so it observes the same state as the
   dashboard.
8. Gemini may rewrite verified facts conversationally, but never creates or
   owns device state.

This avoids unnecessary databases, queues, microservices, and WebSocket
infrastructure while still satisfying the hackathon's live-data requirements.

## System architecture

```text
Simulated Devices
       │
       ▼
Shared In-Memory Device Store
       │
       ▼
Next.js Backend API
       ├──────── REST snapshots ───────► Discord Bot ─────► Discord User
       │                                      │
       │                                      └── optional Gemini wording
       │
       └── REST + SSE live updates ────► Web Dashboard ───► Dashboard User
```

The dashboard and bot do not maintain independent device stores. Both read from
the same Next.js backend. The editable architecture source is available here:

- [Open the system architecture in Excalidraw](diagrams/system-architecture.excalidraw)

## Technologies used

| Area | Technology | Purpose |
| --- | --- | --- |
| Language | TypeScript 5 | Strictly typed backend, bot, and frontend code |
| Web framework | Next.js 16 App Router | Dashboard and backend route handlers |
| UI runtime | React 19 | Dashboard interface |
| Styling | Tailwind CSS 4 | Frontend styling foundation |
| Real-time transport | Server-Sent Events | One-way live backend-to-dashboard updates |
| Discord integration | discord.js 14 | Bot commands and proactive alert messages |
| AI integration | Google Gen AI SDK | Friendly Discord response wording |
| Default AI model | `gemini-3.5-flash` | Low-latency response humanization |
| Package/runtime tooling | Bun | Dependency installation, scripts, and tests |
| Diagram source | Excalidraw | Editable UX and architecture diagrams |

## Current implementation status

### Completed

- Shared state for 15 devices across three rooms
- Realistic fan and light wattages
- Random state changes every 5–15 seconds
- Device lookup, room filtering, and manual toggle operation
- Office-wide and per-room power calculations
- Estimated eight-hour daily energy consumption
- After-hours alerts outside 9:00 AM–5:00 PM
- All-devices-on and two-hour continuous-running alerts
- REST API and SSE stream
- Discord `!status`, `!room`, and `!usage` command implementation
- Optional Gemini humanization with key failover and factual fallback
- Proactive, deduplicated Discord alert watcher
- Editable dashboard UX and system architecture diagrams
- Strict TypeScript, lint, and bot formatter verification

### Not yet completed

- Production dashboard UI
- Browser-level SSE and interaction testing
- Wokwi/Tinkercad electrical schematic
- Live Discord server verification with real credentials
- Final screenshots and three-minute demonstration video

## Setup and installation

### Prerequisites

- [Bun](https://bun.sh/)
- Node.js 20 or newer for deployment compatibility
- A Discord application and bot token for Discord testing
- An optional [Gemini API key](https://aistudio.google.com/app/apikey)

### 1. Clone the repository

```bash
git clone <your-public-repository-url>
cd Techathon2026-VoltMind
```

### 2. Install dependencies

```bash
bun install
```

### 3. Create the environment file

Copy `.env.example` to `.env`:

```powershell
Copy-Item .env.example .env
```

On Bash-compatible systems:

```bash
cp .env.example .env
```

Then replace the placeholder values:

```dotenv
APP_BASE_URL=http://localhost:3000
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CHANNEL_ID=your_alert_channel_id
GEMINI_API_KEY_1=your_first_gemini_api_key
GEMINI_API_KEY_2=your_optional_second_key
GEMINI_API_KEY_3=your_optional_third_key
GEMINI_MODEL=gemini-3.5-flash
```

Only `DISCORD_TOKEN` is required to start the bot. `DISCORD_CHANNEL_ID` enables
proactive alert posts. Gemini keys are optional because the bot has a
deterministic non-AI fallback.

### 4. Configure the Discord application

1. Create an application in the Discord Developer Portal.
2. Add a bot to the application.
3. Enable **Message Content Intent**.
4. Invite the bot with permission to view channels, read message history, and
   send messages.
5. Copy the bot token into `DISCORD_TOKEN`.
6. Enable Discord Developer Mode, copy the target channel ID, and place it in
   `DISCORD_CHANNEL_ID`.

Never commit the real `.env` file or expose bot and Gemini credentials.

## How to run the application

The backend/dashboard server and Discord bot run as separate processes because
the bot consumes the same public backend API as the dashboard.

### Terminal 1 — start Next.js

```bash
bun run dev
```

The application is available at <http://localhost:3000>.

### Terminal 2 — start the Discord bot

```bash
bun run bot:start
```

The bot expects the Next.js server at the URL configured by `APP_BASE_URL`.

## Discord bot usage

| Command | Result |
| --- | --- |
| `!status` | Summarizes current fan and light states for all rooms |
| `!room drawing` | Reports the Drawing Room state |
| `!room work1` | Reports the Work Room 1 state |
| `!room work2` | Reports the Work Room 2 state |
| `!usage` | Reports current total power, room breakdown, and estimated daily kWh |

The bot also polls active alerts and can post newly detected alerts once to the
configured channel. Resolved alert IDs are removed from its seen set, allowing
a future recurrence to be announced again.

## API documentation

All endpoints use the Node.js runtime and dynamic responses.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/state` | Atomic snapshot containing devices, power, and alerts |
| `GET` | `/api/devices` | Lists all 15 devices and their current state |
| `GET` | `/api/devices/room/:name` | Lists devices for one room |
| `POST` | `/api/devices/:id/toggle` | Toggles one device and updates `lastChanged` |
| `GET` | `/api/power` | Returns current and per-room power totals |
| `GET` | `/api/alerts` | Returns all currently active alerts |
| `GET` | `/api/sse` | Streams initial state and subsequent state changes |

Room aliases accepted by the room endpoint include `drawing`, `work1`, and
`work2`. Unknown room names and device IDs return structured `404` responses.

### Example: complete state

```bash
curl http://localhost:3000/api/state
```

```json
{
  "devices": [],
  "power": {
    "totalWatts": 240,
    "perRoom": {
      "Drawing Room": 75,
      "Work Room 1": 90,
      "Work Room 2": 75
    },
    "estimatedDailyKwh": 1.92,
    "devicesOn": 8,
    "devicesOff": 7,
    "measuredAt": "2026-07-03T15:00:00.000Z"
  },
  "alerts": []
}
```

The device and alert arrays above are shortened for documentation. Runtime
responses contain the complete current data.

### Example: room query

```bash
curl http://localhost:3000/api/devices/room/work1
```

### Example: toggle a device

```bash
curl -X POST http://localhost:3000/api/devices/drawing-room-fan-1/toggle
```

### Example: live event stream

```bash
curl -N http://localhost:3000/api/sse
```

## Real-time update flow

When a device changes, `/api/sse` sends a `state-changed` event containing:

- the changed device;
- the latest office and room power summary; and
- the complete current alert list.

New connections immediately receive a `snapshot` event. A heartbeat is emitted
every 25 seconds to keep compatible proxies from closing idle connections.
Event listeners and heartbeat timers are removed when clients disconnect.

## AI integration

Gemini is used only to humanize already verified Discord facts.

- Default model: `gemini-3.5-flash`
- Configurable using `GEMINI_MODEL`
- Up to three API keys supported for failover
- Low temperature (`0.2`) to reduce factual variation
- Ten-second response cache to limit repeated API calls
- System instruction requires every number, unit, room, and device state to be
  preserved
- Responses are limited to 900 characters
- Deterministic formatted facts are returned if every key fails or no key is
  configured

No model was trained or fine-tuned for this project. There is no retrieval
database and no AI-generated device data. The simulator and backend remain the
only source of operational facts.

## Project structure

```text
app/
├── api/                         Next.js backend route handlers
│   ├── alerts/
│   ├── devices/
│   ├── power/
│   ├── sse/
│   └── state/
├── globals.css
├── layout.tsx
└── page.tsx                     Dashboard entry point
bot/
├── alert-watcher.ts             Proactive Discord alerts
├── backend.ts                   Shared backend client
├── commands.ts                  Discord command routing
├── formatters.ts                Deterministic factual responses
├── formatters.test.ts
├── index.ts                     Discord client entry point
└── llm.ts                       Optional Gemini humanization
diagrams/
├── dashboard-ux-skeleton.excalidraw
├── system-architecture.excalidraw
└── README.md
lib/
├── alerts.ts                    Computed alert rules
├── constants.ts                 Rooms, wattage, timing, aliases
├── devices.ts                   Shared store and simulator
├── snapshot.ts                  Atomic office snapshot
└── types.ts                     Strict domain contracts
```

## Diagrams

- [Dashboard UX skeleton — open editable Excalidraw file](diagrams/dashboard-ux-skeleton.excalidraw)
- [System architecture — open editable Excalidraw file](diagrams/system-architecture.excalidraw)
- [Diagram explanation and editing guide](diagrams/README.md)

To edit a diagram, open <https://excalidraw.com> and drag the corresponding
`.excalidraw` file onto the canvas. Keep the `.excalidraw` files as the editable
sources and export PNG/SVG versions later for static README previews.

## Testing and verification

Run the non-build checks:

```bash
bun node_modules/typescript/bin/tsc --noEmit
bun run bot:test
bun run lint
```

Current automated verification covers:

- strict TypeScript correctness;
- ESLint rules;
- Discord status formatting;
- room alias resolution and factual room output; and
- usage output preserving backend totals.

The build command is intentionally not included in the current verification
workflow because this project requires explicit approval before running it.

## Known limitations and remaining work

- The in-memory device state resets when the server process restarts.
- Multiple independent production server instances would not share memory.
- Estimated daily energy is a projection from current power over eight hours,
  not persisted historical metering.
- The production dashboard interface is still pending.
- Discord behavior still needs manual verification with a real bot token.
- The Wokwi/Tinkercad electrical schematic is pending.
- Final screenshots, public repository URL, and demonstration video must be
  added before submission.
