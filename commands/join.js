const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Join your voice channel'),
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
            // Check if Lavalink is available
            if (!interaction.client.lavalinkAvailable) {
                return await interaction.reply({ 
                    content: '❌ Music service is currently unavailable. Please try again in a few moments.', 
                    flags: 64 
                });
            }

            // Check if player already exists
            const player = interaction.client.lavalink.getPlayer(interaction.guildId);
            if (player && player.connected) {
                return await interaction.reply({ 
                    content: '✅ I\'m already connected to a voice channel!', 
                    flags: 64 
                });
            }

            // Check if there are any connected nodes
            const connectedNodes = Array.from(interaction.client.lavalink.nodeManager.nodes.values()).filter(node => node.connected);
            if (connectedNodes.length === 0) {
                return await interaction.reply({ 
                    content: '❌ Music service nodes are not connected. Please try again later.', 
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
                content: `✅ Successfully joined **${voiceChannel.name}**!`, 
                flags: 64 
            });

        } catch (error) {
            console.error('Error joining voice channel:', error);
            
            // Provide more specific error messages
            let errorMessage = '❌ Failed to join the voice channel. Please try again.';
            
            if (error.message && error.message.includes('No available Node')) {
                errorMessage = '❌ Music service is temporarily unavailable. Please try again in a few moments.';
            } else if (error.message && error.message.includes('Missing Permissions')) {
                errorMessage = '❌ I don\'t have permission to join that voice channel.';
            }
            
            await interaction.reply({ 
                content: errorMessage, 
                flags: 64 
            });
        }
    },
};