import { getPowerSummary } from "@/lib/devices";
import { startOfficeRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  startOfficeRuntime();
  return Response.json({ power: getPowerSummary() });
}
