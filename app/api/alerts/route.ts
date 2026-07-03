import { getActiveAlerts } from "@/lib/alerts";
import { startOfficeRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  startOfficeRuntime();
  const alerts = getActiveAlerts();
  return Response.json({ alerts, count: alerts.length });
}
