import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, MessageFlags } from 'discord.js';
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const BOT_TOKEN = process.env.BOT_TOKEN;
const HAMSTER_HUB_GUILD = process.env.HAMSTER_HUB_GUILD;

const createBotClient = async (app) => {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers
        ]
    });

    client.once('ready', async () => {
        console.log(`Bot logged in as ${client.user.tag}`);

        // Register the slash command
        const commands = [
            new SlashCommandBuilder()
                .setName('checkid')
                .setDescription('Returns a Discord user ID')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('The user to check')
                        .setRequired(false)
                )
        ].map(command => command.toJSON());

        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

        try {
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, HAMSTER_HUB_GUILD),
                { body: commands },
            );
        } catch (error) {
            console.error('❌ Failed to register commands:', error);
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'checkid') {
            const targetUser = interaction.options.getUser('target') ?? interaction.user;

            await interaction.reply({
                content: `${targetUser.username}'s ID is: ${targetUser.id}`,
                ephemeral: true
            });
        }
    });

    await client.login(BOT_TOKEN);

    // Keep your /hamsterHub/user route here as it is
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
