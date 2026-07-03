import { startSimulator } from "@/lib/devices";
import { startHistoryRecorder } from "@/lib/history";

export function startOfficeRuntime(): void {
  startSimulator();
  startHistoryRecorder();
}
