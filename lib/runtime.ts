import { startSimulator } from "@/lib/devices";
import { startHistoryRecorder } from "@/lib/history";
import { startAlertMonitor } from "@/lib/alerts";

export function startOfficeRuntime(): void {
  startSimulator();
  startHistoryRecorder();
  startAlertMonitor();
}
