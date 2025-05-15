import { Client, GatewayIntentBits, DiscordAPIError } from 'discord.js';
import { authenticateToken, JWT_SECRET, checkIsJson } from "./middlewares/authenticateToken.js";
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const BOT_TOKEN = process.env.BOT_TOKEN;
const HAMSTER_HUB_GUILD = process.env.HAMSTER_HUB_GUILD;

const createBotClient = async (app) => {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
        ],
    });

    client.once('ready', async () => {
        console.log(`Bot logged in as ${client.user.tag}`);
    });

    await client.login(BOT_TOKEN);

    app.get("/hamsterHub/user", async (req, res) => {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: "Missing or invalid userId" });
        }

        try {
            const guild = await client.guilds.fetch(HAMSTER_HUB_GUILD);
            const member = await guild.members.fetch(userId);

            if (!member) {
                return res.status(404).json({ error: "Member not found" });
            }

            res.json({
                username: member.user.username,
                nickname: member.nickname ?? member.user.username,
                id: member.user.id
            });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "Failed to fetch nickname" });
        }
    });
}

export default createBotClient;