import { resolveRoomName } from "@/lib/constants";
import { getDevicesByRoom, startSimulator } from "@/lib/devices";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  startSimulator();
  const { name } = await params;
  const room = resolveRoomName(decodeURIComponent(name));

  if (!room) {
    return Response.json(
      { error: "Room not found", code: "ROOM_NOT_FOUND" },
      { status: 404 },
    );
  }

  const devices = getDevicesByRoom(room);
  return Response.json({ room, devices, count: devices.length });
}
