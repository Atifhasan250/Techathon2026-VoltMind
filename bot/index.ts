import { createServer } from "http";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { startAlertWatcher } from "./alert-watcher";
import { handleCommand } from "./commands";

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error("DISCORD_TOKEN is required. Add it to .env before starting the bot.");

// Render Web Service Requirement: Bind to a port
const port = process.env.PORT || 10000;
const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("VoltMind Discord Bot is alive and running!\n");
});
server.listen(port, () => {
  console.log(`[Bot] Dummy HTTP server listening on port ${port} (for Render health checks)`);
});

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

client.login(token).catch((err) => {
  console.error("[Bot] Failed to login:", err);
  process.exit(1);
});
