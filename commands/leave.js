const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Make the bot leave the voice channel'),
    
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
                .setTitle('🚪 Left Voice Channel')
                .setDescription(`Successfully left **${channelName}**`)
                .addFields(
                    { name: '👤 Requested by', value: interaction.user.toString(), inline: true }
                )
                .setTimestamp();

            // Add info about what was playing if there was something
            if (currentTrack) {
                embed.addFields(
                    { name: '🎵 Was playing', value: `[${currentTrack.info.title}](${currentTrack.info.uri})`, inline: true }
                );
            }

            // Add queue info if there were songs in queue
            if (queueLength > 0) {
                embed.addFields(
                    { name: '📋 Queue cleared', value: `${queueLength} song${queueLength === 1 ? '' : 's'} removed`, inline: true }
                );
            }

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in leave command:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred while trying to leave the voice channel.',
                    ephemeral: true
                });
            }
        }
    }
};