import { NextResponse } from "next/server";
import { getAlertHistory } from "@/lib/history";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const alerts = await getAlertHistory(7);
    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("[API] Failed to fetch alert history:", error);
    return NextResponse.json({ alerts: [] }, { status: 500 });
  }
}
