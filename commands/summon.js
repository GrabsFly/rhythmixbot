const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('summon')
        .setDescription('Summon the bot to your voice channel'),
    async execute(interaction) {
        const member = interaction.member;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return await interaction.reply({ 
                content: '❌ You need to be in a voice channel first!', 
                flags: 64 
            });
        }

        const permissions = voiceChannel.permissionsFor(interaction.client.user);
        if (!permissions.has('Connect') || !permissions.has('Speak')) {
            return await interaction.reply({ 
                content: '❌ I need permissions to connect and speak in your voice channel!', 
                flags: 64 
            });
        }

        try {
            // Check if player already exists
            const player = interaction.client.lavalink.getPlayer(interaction.guildId);
            if (player && player.connected) {
                return await interaction.reply({ 
                    content: '✅ I\'m already connected to a voice channel!', 
                    flags: 64 
                });
            }

            // Get default volume for this guild
            const defaultVolumeCommand = interaction.client.commands.get('defaultvolume');
            const defaultVolume = defaultVolumeCommand ? defaultVolumeCommand.getDefaultVolume(interaction.guildId) : (parseInt(process.env.DEFAULT_VOLUME) || 50);
            
            // Create or get player
            const newPlayer = interaction.client.lavalink.createPlayer({
                guildId: interaction.guildId,
                voiceChannelId: voiceChannel.id,
                textChannelId: interaction.channelId,
                selfDeaf: true,
                selfMute: false,
                volume: defaultVolume
            });

            // Connect to voice channel
            await newPlayer.connect();

            await interaction.reply({ 
                content: `🔮 Successfully summoned to **${voiceChannel.name}**!`, 
                flags: 64 
            });

        } catch (error) {
            console.error('Error summoning to voice channel:', error);
            await interaction.reply({ 
                content: '❌ Failed to summon to the voice channel. Please try again.', 
                flags: 64 
            });
        }
    },
};