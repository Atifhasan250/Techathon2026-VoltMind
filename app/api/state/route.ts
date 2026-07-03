import { startSimulator } from "@/lib/devices";
import { getOfficeSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  startSimulator();
  return Response.json(getOfficeSnapshot());
}
