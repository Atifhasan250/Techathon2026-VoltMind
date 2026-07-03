# Task Checklist — Backend (Solid Foundation)

> **How to use**: Agent ticks `[x]` as each task is done. If interrupted, resume from the first `[ ]`.
> Each task is atomic — complete one fully before moving to the next.

## Current implementation status (2026-07-03)

- [x] Shared 15-device backend source of truth (2 fans + 3 lights per room)
- [x] Strict TypeScript, REST state endpoints, simulator, alerts, and SSE
- [x] Discord `!status`, `!room`, and `!usage` commands backed by `/api/state`
- [x] Gemini humanization with three-key failover, cache, and factual fallback
- [x] Proactive deduplicated Discord alert watcher
- [x] Bot formatter unit tests and non-build verification
- [ ] Live Discord verification (requires a local `.env` with a valid token)

The detailed checklist below is the original execution backlog and is retained
for implementation detail. Its checkboxes are historical; the status block
above is authoritative for completed work.

---

## Phase 0: Project Setup

- [x] **0.1** Install runtime dependencies
  - [x] Install `discord.js` and `@google/genai` with Bun
  - [x] Verify both appear in `package.json` under `dependencies`

- [x] **0.2** Install dev dependencies (if needed)
  - [x] Install `tsx` as a dev dependency
  - [x] `tsx` is configured to run the Discord bot TypeScript files directly

- [x] **0.3** Update `tsconfig.json` for strict mode
  - [x] Set `"strict": true` in `compilerOptions`
  - [x] Set `"forceConsistentCasingInFileNames": true`
  - [x] Ensure `"moduleResolution"` is set appropriately for Next.js 16
  - [x] Verify no existing TypeScript errors after enabling strict

- [x] **0.4** Keep `next.config.ts` minimal
  - [ ] Add `serverExternalPackages: ['discord.js']` if bot code gets imported anywhere by Next.js
  - [x] Keep config minimal; bot code is not imported by Next.js

- [x] **0.5** Create `.env.example` at project root
  ```
  # Gemini API Key (pick one of your keys)
  GEMINI_API_KEY=your_gemini_api_key_here

  # Discord Bot
  DISCORD_TOKEN=your_discord_bot_token_here
  DISCORD_CHANNEL_ID=your_alert_channel_id_here

  # App
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  ```

- [x] **0.6** Add bot scripts to `package.json`
  - [x] Add a Bun-compatible `bot:start` script using `tsx`
  - [ ] Add `"dev:all": "concurrently \"npm run dev\" \"npm run bot:start\""` (optional, if concurrently is installed)

- [x] **0.7** Update `.gitignore`
  - [x] Ensure `.env` is ignored
  - [x] Ensure `.env.local` is covered by the `.env*` rule
  - [x] Ensure `node_modules/`, `.next/` are ignored

---

## Phase 1: TypeScript Types & Constants

### 1.1 — Create `lib/types.ts`

- [x] **1.1.1** Define `DeviceType` type
  ```typescript
  export type DeviceType = "fan" | "light";
  ```

- [x] **1.1.2** Define `RoomName` type
  ```typescript
  export type RoomName = "Drawing Room" | "Work Room 1" | "Work Room 2";
  ```

- [x] **1.1.3** Define `Device` interface
  ```typescript
  export interface Device {
    id: string;            // e.g., "drawing-room-fan-1"
    name: string;          // e.g., "Fan 1"
    type: DeviceType;
    room: RoomName;
    status: boolean;       // true = ON, false = OFF
    wattage: number;       // power draw when ON (60 for fan, 15 for light)
    lastChanged: string;   // ISO 8601 timestamp
  }
  ```

- [x] **1.1.4** Define `PowerSummary` interface
  ```typescript
  export interface PowerSummary {
    totalWatts: number;
    perRoom: Record<RoomName, number>;
    estimatedDailyKwh: number;
    devicesOn: number;
    devicesOff: number;
  }
  ```

- [x] **1.1.5** Define `Alert` interface
  ```typescript
  export interface Alert {
    id: string;
    type: "after-hours" | "all-devices-on" | "long-running";
    message: string;
    room: RoomName;
    severity: "warning" | "critical";
    timestamp: string;     // ISO 8601
    devices: string[];     // device IDs involved
  }
  ```

- [x] **1.1.6** Define the SSE `StreamEvent` type
  ```typescript
  export interface SSEEvent {
    type: "device-update" | "alert" | "power-update" | "initial-state";
    data: Device | Device[] | Alert | PowerSummary;
    timestamp: string;
  }
  ```

- [x] **1.1.7** Define `DeviceToggleResponse` interface
  ```typescript
  export interface DeviceToggleResponse {
    success: boolean;
    device: Device;
    message: string;
  }
  ```

### 1.2 — Create `lib/constants.ts`

- [x] **1.2.1** Define room names array
  ```typescript
  export const ROOM_NAMES: RoomName[] = [
    "Drawing Room",
    "Work Room 1",
    "Work Room 2",
  ] as const;
  ```

- [x] **1.2.2** Define wattage values
  ```typescript
  export const WATTAGE: Record<DeviceType, number> = {
    fan: 60,
    light: 15,
  } as const;
  ```

- [x] **1.2.3** Define devices per room
  ```typescript
  export const FANS_PER_ROOM = 2;
  export const LIGHTS_PER_ROOM = 3;
  export const DEVICES_PER_ROOM = FANS_PER_ROOM + LIGHTS_PER_ROOM; // 5
  export const TOTAL_DEVICES = DEVICES_PER_ROOM * ROOM_NAMES.length; // 15... wait
  ```
  > **Authoritative project decision**: Use **2 fans + 3 lights = 5 devices per room, 15 total**. The user confirmed that 18 in the supplied document is a mistake.

  ```typescript
  export const FANS_PER_ROOM = 2;
  export const LIGHTS_PER_ROOM = 3;
  export const DEVICES_PER_ROOM = FANS_PER_ROOM + LIGHTS_PER_ROOM;
  export const TOTAL_DEVICES = DEVICES_PER_ROOM * ROOM_NAMES.length; // 15
  // The confirmed requirement is 2 fans + 3 lights per room, 15 total.
  ```

- [x] **1.2.4** Define office hours
  ```typescript
  export const OFFICE_HOURS = {
    start: 9,  // 9 AM
    end: 17,   // 5 PM
  } as const;
  ```

- [x] **1.2.5** Define simulator config
  ```typescript
  export const SIMULATOR_CONFIG = {
    minIntervalMs: 5000,   // minimum time between random toggles
    maxIntervalMs: 15000,  // maximum time between random toggles
    maxDevicesToToggle: 2, // max devices toggled per tick
  } as const;
  ```

- [x] **1.2.6** Define max power constant
  ```typescript
  export const MAX_POSSIBLE_WATTS =
    ROOM_NAMES.length * (FANS_PER_ROOM * WATTAGE.fan + LIGHTS_PER_ROOM * WATTAGE.light);
  // = 3 * (2*60 + 3*15) = 3 * 165 = 495W
  ```

- [x] **1.2.7** Define alert thresholds
  ```typescript
  export const ALERT_THRESHOLDS = {
    longRunningMinutes: 120,  // alert if ALL devices in a room ON for 2+ hours
  } as const;
  ```

---

## Phase 2: Device Store & Simulator Engine

### 2.1 — Create `lib/devices.ts`

- [x] **2.1.1** Create the device ID helper
  - Input: room name, device type, index
  - Output: slug like `"drawing-room-fan-1"`
  - Convert room name to lowercase, replace spaces with hyphens

- [x] **2.1.2** Create the initial device generator
  - Loop through each room in `ROOM_NAMES`
  - For each room, create `FANS_PER_ROOM` fan devices and `LIGHTS_PER_ROOM` light devices
  - Randomly assign initial `status` (true/false) to each device
  - Set `lastChanged` to current timestamp
  - Set `wattage` based on device type from `WATTAGE` constant
  - Return `Device[]` array

- [x] **2.1.3** Create the in-memory device store
  ```typescript
  let devices: Device[] = generateInitialDevices();
  ```
  - This is a module-level variable — persists as long as the server process runs
  - IMPORTANT: In Next.js dev mode with hot reload, modules can re-execute. Use a globalThis pattern to prevent data loss:
  ```typescript
  const globalStore = globalThis as typeof globalThis & { __devices?: Device[] };
  if (!globalStore.__devices) {
    globalStore.__devices = generateInitialDevices();
  }
  export const devices = globalStore.__devices;
  ```

- [x] **2.1.4** Create `getAllDevices()` function
  - Returns a deep copy of all devices (prevent mutation)
  - `return JSON.parse(JSON.stringify(devices))`

- [x] **2.1.5** Create `getDevicesByRoom(room: RoomName)` function
  - Filters devices by room name
  - Returns deep copy of filtered array

- [x] **2.1.6** Create `getDeviceById(id: string)` function
  - Finds device by ID
  - Returns deep copy or `null` if not found

- [x] **2.1.7** Create `toggleDevice(id: string)` function
  - Find device by ID in the store
  - If not found, return `{ success: false, error: "Device not found" }`
  - Flip `status` boolean
  - Update `lastChanged` to current ISO timestamp
  - Emit `"device-update"` event via the event emitter (Phase 2.2)
  - Return `{ success: true, device: <updated device copy> }`

- [x] **2.1.8** Create `getPowerSummary()` function
  - Calculate `totalWatts`: sum of `wattage` for all devices where `status === true`
  - Calculate `perRoom`: for each room, sum watts of ON devices
  - Calculate `estimatedDailyKwh`: `totalWatts * 8 / 1000` (assuming 8 working hours)
  - Count `devicesOn` and `devicesOff`
  - Return `PowerSummary` object

### 2.2 — Create Event Emitter for SSE

- [x] **2.2.1** Create event emitter system in `lib/devices.ts`
  - Use Node.js `EventEmitter` or a simple callback pattern
  - Must work with the `globalThis` pattern to persist across hot reloads
  ```typescript
  import { EventEmitter } from "events";

  const globalEmitter = globalThis as typeof globalThis & { __deviceEmitter?: EventEmitter };
  if (!globalEmitter.__deviceEmitter) {
    globalEmitter.__deviceEmitter = new EventEmitter();
    globalEmitter.__deviceEmitter.setMaxListeners(50); // multiple SSE clients
  }
  export const deviceEmitter = globalEmitter.__deviceEmitter;
  ```

- [x] **2.2.2** Emit events from `toggleDevice()`
  - After toggling, emit: `deviceEmitter.emit("device-update", updatedDevice)`

- [x] **2.2.3** Emit events from simulator
  - After simulator toggles a device, emit same event

### 2.3 — Build Simulator Engine

- [x] **2.3.1** Create `startSimulator()` function in `lib/devices.ts`
  - Uses `setInterval` or recursive `setTimeout` with random delay
  - Random delay between `SIMULATOR_CONFIG.minIntervalMs` and `maxIntervalMs`
  - Each tick: pick 1-2 random devices and toggle them
  - Must NOT create duplicate intervals on hot reload — use `globalThis` guard
  ```typescript
  const globalSim = globalThis as typeof globalThis & { __simulatorRunning?: boolean };
  export function startSimulator() {
    if (globalSim.__simulatorRunning) return;
    globalSim.__simulatorRunning = true;
    // ... start the interval
  }
  ```

- [x] **2.3.2** Implement random device selection in simulator
  - Pick a random number between 1 and `maxDevicesToToggle`
  - Pick that many random device indices
  - Toggle each selected device
  - Log toggles to console for debugging: `[Simulator] Toggled: Fan 1 in Drawing Room → ON`

- [x] **2.3.3** Auto-start simulator on first API request
  - Call `startSimulator()` at module load or inside first API route hit
  - Simulator should be idempotent — calling multiple times doesn't create multiple intervals

---

## Phase 3: Alert Detection Logic

### 3.1 — Create `lib/alerts.ts`

- [x] **3.1.1** Create `getActiveAlerts()` function
  - Returns `Alert[]` — all currently active alerts
  - Checks the following conditions on every call (computed, not stored):

- [x] **3.1.2** Implement "After Office Hours" alert detection
  - Get current hour
  - If current hour is outside `OFFICE_HOURS.start` to `OFFICE_HOURS.end` (i.e., before 9AM or after 5PM)
  - Find all devices that are ON
  - Group them by room
  - For each room with ON devices, create an alert:
    ```
    type: "after-hours"
    severity: "warning"
    message: "Drawing Room has 2 lights and 1 fan still ON after office hours"
    ```

- [x] **3.1.3** Implement "All Devices ON" alert detection
  - For each room, check if ALL devices are ON
  - If so, create an alert:
    ```
    type: "all-devices-on"
    severity: "critical"
    message: "All devices in Work Room 2 are ON simultaneously"
    ```

- [x] **3.1.4** Implement "Long Running" alert detection
  - For each room, check if ALL devices have been ON continuously for 2+ hours
  - Compare `lastChanged` timestamps: if the *most recent* `lastChanged` among ON devices is 2+ hours ago, all have been on that long
  - Create alert:
    ```
    type: "long-running"
    severity: "warning"
    message: "All devices in Drawing Room have been ON for over 2 hours"
    ```

- [x] **3.1.5** Generate unique alert IDs
  - Use a deterministic ID based on alert type + room: `"after-hours-drawing-room"`
  - This prevents duplicate alerts for the same condition

- [ ] **3.1.6** Emit alert events when new alerts appear
  - Keep track of previous alert IDs (in `globalThis`)
  - If a new alert ID appears that wasn't in the previous check, emit `deviceEmitter.emit("alert", newAlert)`

---

## Phase 4: API Route Handlers

### 4.1 — `GET /api/devices` → `app/api/devices/route.ts`

- [x] **4.1.1** Create the file `app/api/devices/route.ts`
- [x] **4.1.2** Import `getAllDevices` from `lib/devices`
- [x] **4.1.3** Implement `GET` handler
  - Call `startSimulator()` to ensure simulator is running
  - Return `NextResponse.json({ devices: getAllDevices(), count: devices.length })`
- [x] **4.1.4** Set `dynamic = "force-dynamic"` to prevent caching
  ```typescript
  export const dynamic = "force-dynamic";
  ```

### 4.2 — `GET /api/devices/room/[name]` → `app/api/devices/room/[name]/route.ts`

- [x] **4.2.1** Create the file with dynamic route segment `[name]`
- [x] **4.2.2** Extract room name from params
  - Decode the URL param: `decodeURIComponent(params.name)`
  - Map common aliases: `"work1"` → `"Work Room 1"`, `"work2"` → `"Work Room 2"`, `"drawing"` → `"Drawing Room"`
- [x] **4.2.3** Validate room name exists in `ROOM_NAMES`
  - If not found, return 404: `NextResponse.json({ error: "Room not found" }, { status: 404 })`
- [x] **4.2.4** Return filtered devices for that room
  ```typescript
  return NextResponse.json({ room: roomName, devices: getDevicesByRoom(roomName) });
  ```

### 4.3 — `POST /api/devices/[id]/toggle` → `app/api/devices/[id]/toggle/route.ts`

- [x] **4.3.1** Create the file with dynamic route segment `[id]`
- [x] **4.3.2** Extract device ID from params
- [x] **4.3.3** Call `toggleDevice(id)`
- [x] **4.3.4** If device not found, return 404
- [x] **4.3.5** If success, return toggled device
  ```typescript
  return NextResponse.json({ success: true, device: result.device, message: `${device.name} turned ${device.status ? "ON" : "OFF"}` });
  ```

### 4.4 — `GET /api/power` → `app/api/power/route.ts`

- [x] **4.4.1** Create the file
- [x] **4.4.2** Import `getPowerSummary` from `lib/devices`
- [x] **4.4.3** Return power summary JSON
- [x] **4.4.4** Set `dynamic = "force-dynamic"`

### 4.5 — `GET /api/alerts` → `app/api/alerts/route.ts`

- [x] **4.5.1** Create the file
- [x] **4.5.2** Import `getActiveAlerts` from `lib/alerts`
- [x] **4.5.3** Return alerts JSON
  ```typescript
  return NextResponse.json({ alerts: getActiveAlerts(), count: alerts.length });
  ```
- [x] **4.5.4** Set `dynamic = "force-dynamic"`

### 4.6 — `GET /api/sse` → `app/api/sse/route.ts`

This is the **most critical API route** — it powers real-time dashboard updates.

- [x] **4.6.1** Create the file
- [x] **4.6.2** Implement SSE response using `ReadableStream`
  ```typescript
  export async function GET() {
    const stream = new ReadableStream({
      start(controller) {
        // Send initial state
        const initialData: SSEEvent = {
          type: "initial-state",
          data: getAllDevices(),
          timestamp: new Date().toISOString(),
        };
        controller.enqueue(`data: ${JSON.stringify(initialData)}\n\n`);

        // Listen for device updates
        const onDeviceUpdate = (device: Device) => {
          const event: SSEEvent = {
            type: "device-update",
            data: device,
            timestamp: new Date().toISOString(),
          };
          controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
        };

        // Listen for alerts
        const onAlert = (alert: Alert) => {
          const event: SSEEvent = {
            type: "alert",
            data: alert,
            timestamp: new Date().toISOString(),
          };
          controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
        };

        deviceEmitter.on("device-update", onDeviceUpdate);
        deviceEmitter.on("alert", onAlert);

        // Cleanup on close
        // ...
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }
  ```

- [x] **4.6.3** Handle client disconnect cleanup
  - Remove event listeners when the client disconnects
  - Use `AbortSignal` or `cancel()` method on the stream

- [x] **4.6.4** Ensure simulator starts on first SSE connection
  - Call `startSimulator()` inside the SSE handler

- [x] **4.6.5** Add heartbeat to keep connection alive
  - Send a comment `": heartbeat\n\n"` every 30 seconds
  - Prevents proxy/load balancer timeouts

- [x] **4.6.6** Set `dynamic = "force-dynamic"` and `runtime = "nodejs"`
  ```typescript
  export const dynamic = "force-dynamic";
  export const runtime = "nodejs"; // SSE needs Node.js runtime, not Edge
  ```

- [x] **4.6.7** Encode stream data properly
  - Use `TextEncoder` to convert strings to `Uint8Array` for the ReadableStream controller
  ```typescript
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  ```

---

## Phase 5: Discord Bot

### 5.1 — Bot Core Setup

- [x] **5.1.1** Create `bot/index.ts`
  - Import `Client`, `GatewayIntentBits` from `discord.js`
  - Create client with intents: `Guilds`, `GuildMessages`, `MessageContent`
  - Login with `process.env.DISCORD_TOKEN`
  - Log "Bot is ready" on `ready` event

- [x] **5.1.2** Add message listener
  - Listen for `messageCreate` event
  - Ignore messages from bots (`message.author.bot`)
  - Check if message starts with `!` prefix
  - Route to appropriate command handler

- [x] **5.1.3** Handle graceful shutdown
  - Listen for `SIGINT` and `SIGTERM`
  - Call `client.destroy()` before exit

### 5.2 — Command Handlers (`bot/commands.ts`)

- [x] **5.2.1** Create `handleStatus` command flow
  - Fetch `http://localhost:3000/api/devices`
  - Group devices by room
  - For each room: count ON fans, ON lights, total watts
  - Pass raw data to LLM for humanized response
  - Send response to Discord channel

- [x] **5.2.2** Create `handleRoom` command flow
  - Parse room name from command: `!room work1` → `"work1"`
  - Map aliases: `work1` → `Work Room 1`, `work2` → `Work Room 2`, `drawing` → `Drawing Room`
  - Fetch `http://localhost:3000/api/devices/room/{name}`
  - List each device with status, wattage, last changed
  - Pass to LLM for humanized response

- [x] **5.2.3** Create `handleUsage` command flow
  - Fetch `http://localhost:3000/api/power`
  - Format: total watts, per-room breakdown, estimated daily kWh
  - Pass to LLM for humanized response

- [x] **5.2.4** Handle unknown commands
  - Reply with available commands list
  - Friendly tone: "I don't know that one! Try: !status, !room <name>, !usage"

- [x] **5.2.5** Error handling in all commands
  - If API fetch fails (server not running), reply: "Hmm, I can't reach the backend right now. Is the dashboard server running?"
  - Wrap all commands in try/catch

### 5.3 — LLM Integration (`bot/llm.ts`)

- [x] **5.3.1** Create the Gemini humanization function
  - Takes: raw data object + command type string
  - Calls Gemini API (`@google/genai`)
  - System prompt:
    ```
    You are a friendly office assistant bot. Convert the following device
    data into a casual, conversational Discord message. Use emojis sparingly.
    Be concise but informative. The boss hates robotic data dumps.
    Keep it under 300 words.
    ```
  - Returns humanized string

- [x] **5.3.2** Handle LLM API errors gracefully
  - If Gemini API fails, fall back to a simple formatted response (not LLM-generated)
  - Log the error but don't crash the bot

- [x] **5.3.3** Add response caching
  - Cache LLM responses for 10 seconds to avoid excessive API calls
  - If same command is sent within 10 seconds, return cached response

### 5.4 — Alert Watcher (`bot/alertWatcher.ts`) — BONUS

- [x] **5.4.1** Create `startAlertWatcher` function
  - Polls `http://localhost:3000/api/alerts` every 60 seconds
  - Keeps track of previously seen alert IDs
  - If new alerts appear, post them to the designated Discord channel

- [x] **5.4.2** Format alert messages
  - Use LLM to humanize alert messages
  - Example: "⚠️ Hey! Work Room 2 still has 2 fans and 3 lights ON and it's 10 PM. Did someone forget to leave?"

- [x] **5.4.3** Don't spam — only post each alert once
  - Store seen alert IDs in a `Set`
  - Clear the set periodically (every hour) to allow re-alerting if condition persists

---

## Phase 6: Frontend (Dashboard)

### 6.1 — SSE Hook

- [ ] **6.1.1** Create `app/hooks/useDeviceStream.ts`
  - Custom React hook that connects to `/api/sse`
  - Creates `EventSource` instance
  - Parses incoming `SSEEvent` objects
  - Maintains state: `devices: Device[]`, `alerts: Alert[]`
  - Handles reconnection on disconnect (retry after 3 seconds)
  - Cleanup: close `EventSource` on component unmount

### 6.2 — Layout & Header

- [ ] **6.2.1** Update `app/layout.tsx`
  - Import fonts via `next/font/google`
  - Set metadata: title, description
  - Apply font classes to body

- [ ] **6.2.2** Create `app/components/Header.tsx`
  - Dashboard title: "⚡ Office Monitor"
  - Live clock (updates every second)
  - Total power indicator (from SSE data)
  - Device count badge: "X/Y devices ON"

### 6.3 — Device Components

- [ ] **6.3.1** Create `app/components/DeviceCard.tsx`
  - Props: `device: Device`, `onToggle: (id: string) => void`
  - Shows: device name, type icon (SVG), status badge, wattage (if ON), last changed relative time
  - Visual states: ON = glowing colored card, OFF = dim muted card
  - Fan ON: spinning animation on icon
  - Light ON: warm glow effect
  - Toggle button: calls `POST /api/devices/[id]/toggle` then optimistic UI update

- [ ] **6.3.2** Create `app/components/RoomSection.tsx`
  - Props: `roomName: RoomName`, `devices: Device[]`, `onToggle`
  - Room heading with total power for that room
  - Grid of `DeviceCard` components
  - Subtle room-level styling differences

- [ ] **6.3.3** Create `app/components/DevicePanel.tsx`
  - Maps all rooms and renders `RoomSection` for each
  - Handles loading state (skeleton cards)

### 6.4 — Power & Alerts Components

- [ ] **6.4.1** Create `app/components/PowerMeter.tsx`
  - Big total watts number with animated counter
  - Progress bar: current vs max possible watts
  - Per-room breakdown mini-bars
  - Estimated daily kWh

- [ ] **6.4.2** Create `app/components/AlertsPanel.tsx`
  - List of active alerts
  - Each alert: icon by severity, message, timestamp, affected room
  - Empty state: "All clear! No alerts right now."
  - New alert slide-in animation

### 6.5 — Office Top View (BONUS)

- [ ] **6.5.1** Create `app/components/OfficeTopView.tsx`
  - SVG-based top-down floor plan
  - 3 rooms as rectangles with labels
  - Light bulb dots that glow amber when ON, gray when OFF
  - Fan circles that spin when ON, static when OFF
  - Optional: desk/chair shapes as background furniture

### 6.6 — Main Page Assembly

- [ ] **6.6.1** Update `app/page.tsx`
  - Use `useDeviceStream` hook for live data
  - Layout: Header on top → PowerMeter + AlertsPanel side by side → OfficeTopView → DevicePanel
  - Responsive: on mobile, stack vertically
  - Loading state: skeleton UI while SSE connects

### 6.7 — Styling

- [ ] **6.7.1** Build `app/globals.css` with design tokens
  - CSS custom properties for all colors, spacing, shadows
  - Dark theme as default
  - Tailwind utility extensions if needed
  - Animation keyframes: spin, pulse-glow, slide-in, counter
  - Responsive breakpoints

---

## Phase 7: Diagrams & Documentation

### 7.1 — System Diagram

- [x] **7.1.1** Create the editable Excalidraw system architecture diagram
  - Nodes: Physical Devices (IoT layer), Simulated Data Store, Next.js API, Web Dashboard, Discord Bot, User
  - Arrows: data flow direction with labels
  - NOT Mermaid — Excalidraw format only

### 7.2 — Wokwi Circuit Guide

- [ ] **7.2.1** Create `wokwi/README.md`
  - Wiring diagram description for one room
  - Component list: ESP32, LEDs, relay modules, resistors
  - Sample Arduino sketch: reads digital pins, toggles LEDs/motors
  - Link to Wokwi project (user fills in after creating)
  - Screenshot placeholder

### 7.3 — README

- [x] **7.3.1** Write `README.md`
  - Project overview (2-3 sentences)
  - Tech stack list
  - Prerequisites (Node.js, npm, Discord bot setup)
  - Installation steps
  - How to run: `npm run dev` (dashboard), `npm run bot:start` (Discord bot)
  - Environment variables table
  - Screenshots section
  - Architecture diagram reference
  - API endpoints documentation
  - Folder structure tree
  - License

### 7.4 — Final Polish

- [ ] **7.4.1** Run `npm run build` — fix any build errors
- [x] **7.4.2** Run the non-build lint check — fix any lint errors
- [x] **7.4.3** Ensure TypeScript strict mode has no errors
- [ ] **7.4.4** Test dashboard in browser — devices update live
- [ ] **7.4.5** Test Discord bot — all 3 commands work
- [ ] **7.4.6** Verify dashboard and bot show same data
- [ ] **7.4.7** Review against all 7 evaluation criteria

---

## Quick Resume Guide

**If you stopped and need to continue:**

1. Open this file
2. Find the first unchecked `[ ]` task
3. Start from there
4. The previous `[x]` tasks are already done — don't redo them
5. If a phase is fully checked, skip to the next phase

**Run order**: Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 (sequential, each phase depends on the previous)
