import { getEnergyAnalytics, resolveAnalyticsRange } from "@/lib/history";
import { startOfficeRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  startOfficeRuntime();
  const range = resolveAnalyticsRange(new URL(request.url).searchParams.get("range"));
  return Response.json({ analytics: await getEnergyAnalytics(range) });
}
