import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { setupPlayer } from './player.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const queue = new Map(); // Guild ID -> Queue data

client.once('ready', () => {
  console.log(`🎶 Music bot ready as ${client.user.tag}`);
});

setupPlayer(client, queue);

client.login(process.env.DISCORD_TOKEN);