import type { Client } from "discord.js";
import { getOfficeSnapshot } from "./backend";
import { formatAlert } from "./formatters";
import { humanize } from "./llm";

const POLL_INTERVAL_MS = 60_000;

function canSend(channel: unknown): channel is { send(content: string): Promise<unknown> } {
  return Boolean(channel && typeof channel === "object" && "send" in channel);
}

export function startAlertWatcher(client: Client): () => void {
  const channelId = process.env.DISCORD_CHANNEL_ID;
  if (!channelId) {
    console.warn("[Alerts] DISCORD_CHANNEL_ID is not set; proactive alerts are disabled.");
    return () => {};
  }

  const seen = new Set<string>();
  let running = false;
  const check = async () => {
    if (running) return;
    running = true;
    try {
      const channel = await client.channels.fetch(channelId);
      if (!canSend(channel)) throw new Error("Configured alert channel is not text-based");
      const { alerts } = await getOfficeSnapshot();
      const activeIds = new Set(alerts.map((alert) => alert.id));
      for (const id of seen) if (!activeIds.has(id)) seen.delete(id);
      for (const alert of alerts) {
        if (seen.has(alert.id)) continue;
        seen.add(alert.id);
        await channel.send(await humanize(formatAlert(alert), "Proactively notify the office about this active energy alert."));
      }
    } catch (error) {
      console.error("[Alerts] Check failed:", error);
    } finally {
      running = false;
    }
  };

  void check();
  const timer = setInterval(() => void check(), POLL_INTERVAL_MS);
  return () => clearInterval(timer);
}
