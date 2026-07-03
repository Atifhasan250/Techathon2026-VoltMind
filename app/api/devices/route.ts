import { getAllDevices } from "@/lib/devices";
import { startOfficeRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  startOfficeRuntime();
  const devices = getAllDevices();
  return Response.json({ devices, count: devices.length });
}
