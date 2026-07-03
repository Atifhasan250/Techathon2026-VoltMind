# VoltMind diagrams

These are editable source diagrams, not flattened screenshots.

## Dashboard UX skeleton

Open `dashboard-ux-skeleton.excalidraw` to see the proposed monitoring screen:

- live connection header;
- office-wide power, device and alert summary;
- spatial three-room office view;
- per-room power breakdown;
- active-alert priority panel;
- room-grouped device controls; and
- the recommended mobile content order.

The wireframe is a UX reference. It does not force exact colors or dimensions
in the final implementation, but its information hierarchy should be retained.

## System architecture

Open `system-architecture.excalidraw` to see the complete information flow:

1. The simulator changes one of the 15 devices.
2. The shared in-memory store updates status and `lastChanged`.
3. The Next.js backend exposes the same state over REST and SSE.
4. MongoDB optionally stores minute power samples and device-change events.
5. The dashboard consumes REST snapshots, SSE updates, analytics and toggles.
6. The Discord bot consumes `/api/state` and posts proactive alerts.
7. Gemini may rewrite factual text, but never owns or changes device state.

## Open and edit

1. Go to <https://excalidraw.com/>.
2. Drag either `.excalidraw` file onto the canvas, or use **Open**.
3. Edit any box, label, arrow, color or position.
4. Export PNG or SVG only when a static README preview is needed; keep these
   `.excalidraw` files as the editable source of truth.
