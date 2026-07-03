import { startSimulator, toggleDevice } from "@/lib/devices";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  startSimulator();
  const { id } = await params;
  const device = toggleDevice(decodeURIComponent(id));

  if (!device) {
    return Response.json(
      { error: "Device not found", code: "DEVICE_NOT_FOUND" },
      { status: 404 },
    );
  }

  return Response.json({
    success: true,
    device,
    message: `${device.name} in ${device.room} turned ${device.status.toUpperCase()}.`,
  });
}
