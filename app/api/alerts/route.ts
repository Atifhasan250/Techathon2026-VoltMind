import { getActiveAlerts } from "@/lib/alerts";
import { startSimulator } from "@/lib/devices";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  startSimulator();
  const alerts = getActiveAlerts();
  return Response.json({ alerts, count: alerts.length });
}
