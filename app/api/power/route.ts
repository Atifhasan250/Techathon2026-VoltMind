import { getPowerSummary, startSimulator } from "@/lib/devices";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  startSimulator();
  return Response.json({ power: getPowerSummary() });
}
