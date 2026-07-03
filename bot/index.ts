import { Client, Events, GatewayIntentBits } from "discord.js";
import { startAlertWatcher } from "./alert-watcher";
import { handleCommand } from "./commands";

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error("DISCORD_TOKEN is required. Add it to .env before starting the bot.");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

let stopAlertWatcher = () => {};
client.once(Events.ClientReady, (readyClient) => {
  console.log(`[Bot] Ready as ${readyClient.user.tag}`);
  stopAlertWatcher = startAlertWatcher(client);
});
client.on(Events.MessageCreate, async (message) => {
  if (!message.author.bot) await handleCommand(message);
});

const shutdown = () => {
  stopAlertWatcher();
  client.destroy();
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

await client.login(token);
