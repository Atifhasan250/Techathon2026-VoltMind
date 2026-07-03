import type { Message } from "discord.js";
import { getEnergyAnalytics, getOfficeSnapshot } from "./backend";
import { formatRoom, formatStatus, formatUsage } from "./formatters";
import { humanize } from "./llm";

const HELP = "Commands: `!status`, `!room drawing|work1|work2`, `!usage`.";

export async function handleCommand(message: Message): Promise<void> {
  const [command, ...args] = message.content.trim().split(/\s+/);
  if (!command.startsWith("!")) return;

  try {
    const snapshot = await getOfficeSnapshot();
    let facts: string;
    let context: string;

    switch (command.toLowerCase()) {
      case "!status":
        facts = formatStatus(snapshot.devices);
        context = "Summarize the current state of every room.";
        break;
      case "!room": {
        if (args.length === 0) {
          await message.reply("Please name a room: `drawing`, `work1`, or `work2`.");
          return;
        }
        const roomSummary = formatRoom(snapshot.devices, args.join(" "));
        if (!roomSummary) {
          await message.reply("I couldn't find that room. Use `drawing`, `work1`, or `work2`.");
          return;
        }
        facts = roomSummary;
        context = "Report the current state of the requested room.";
        break;
      }
      case "!usage":
        facts = formatUsage(snapshot.power, await getEnergyAnalytics());
        context = "Report current office power and estimated daily energy usage.";
        break;
      default:
        await message.reply(HELP);
        return;
    }

    await message.reply(await humanize(facts, context));
  } catch (error) {
    console.error("[Bot] Command failed:", error);
    await message.reply("I can't reach the office backend right now. Check that `npm run dev` is running, then try again.");
  }
}
