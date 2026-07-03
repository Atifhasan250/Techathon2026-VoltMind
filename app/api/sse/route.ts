import { deviceEvents, getPowerSummary, startSimulator } from "@/lib/devices";
import { getActiveAlerts } from "@/lib/alerts";
import { getOfficeSnapshot } from "@/lib/snapshot";
import type { Device, StreamEvent } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_INTERVAL_MS = 25_000;

export function GET(request: Request) {
  startSimulator();
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const write = (value: string) => {
        if (!closed) controller.enqueue(encoder.encode(value));
      };

      const send = (event: StreamEvent) => {
        write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      };

      const onStateChanged = (device: Device) => {
        send({
          type: "state-changed",
          data: {
            device,
            power: getPowerSummary(),
            alerts: getActiveAlerts(),
          },
          timestamp: new Date().toISOString(),
        });
      };

      send({
        type: "snapshot",
        data: getOfficeSnapshot(),
        timestamp: new Date().toISOString(),
      });

      deviceEvents.on("state-changed", onStateChanged);
      const heartbeat = setInterval(() => write(": heartbeat\n\n"), HEARTBEAT_INTERVAL_MS);
      heartbeat.unref?.();

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        deviceEvents.off("state-changed", onStateChanged);
        try {
          controller.close();
        } catch {
          // The client may have already closed the stream.
        }
      };

      request.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
