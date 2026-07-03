import { getAllDevices, startSimulator } from "@/lib/devices";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  startSimulator();
  const devices = getAllDevices();
  return Response.json({ devices, count: devices.length });
}
