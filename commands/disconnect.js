const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('disconnect')
        .setDescription('Disconnect the bot from the voice channel'),
    
    async execute(interaction, client) {
        try {
            // Check if user is in a voice channel
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                return await interaction.reply({
                    content: '❌ You need to be in a voice channel to use this command!',
                    ephemeral: true
                });
            }

            // Get player
            const player = client.lavalink.getPlayer(interaction.guildId);
            if (!player) {
                return await interaction.reply({
                    content: '❌ The bot is not connected to any voice channel!',
                    ephemeral: true
                });
            }

            // Check if user is in the same voice channel as bot
            if (player.voiceChannelId !== voiceChannel.id) {
                return await interaction.reply({
                    content: '❌ You need to be in the same voice channel as the bot!',
                    ephemeral: true
                });
            }

            const currentTrack = player.queue.current;
            const queueLength = player.queue.tracks.length;
            const channelName = voiceChannel.name;

            // Destroy the player (this will disconnect and clean up)
            await player.destroy();
            
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('👋 Disconnected')
                .setDescription(`Successfully disconnected from **${channelName}**`)
                .addFields(
                    { name: '👤 Disconnected by', value: interaction.user.toString(), inline: true }
                )
                .setTimestamp();
            
            if (currentTrack) {
                embed.addFields(
                    { name: '🎵 Was Playing', value: `**${currentTrack.info.title}**`, inline: true }
                );
            }
            
            if (queueLength > 0) {
                embed.addFields(
                    { name: '📋 Queue Cleared', value: `${queueLength} tracks removed`, inline: true }
                );
            }
            
            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in disconnect command:', error);
            await interaction.reply({
                content: '❌ An error occurred while trying to disconnect!',
                ephemeral: true
            });
        }
    }
};