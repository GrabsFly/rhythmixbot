const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop the music and clear the queue'),
    
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
                    content: '❌ There is no music playing!',
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

            // Stop the player and clear queue
            await player.stopPlaying(true, true);
            
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('⏹️ Music Stopped')
                .setDescription('The music has been stopped and the queue has been cleared!')
                .addFields(
                    { name: '👤 Stopped by', value: interaction.user.toString(), inline: true }
                )
                .setTimestamp();
            
            if (currentTrack) {
                embed.addFields(
                    { name: '🎵 Last Playing', value: `**${currentTrack.info.title}**`, inline: true }
                );
            }
            
            if (queueLength > 0) {
                embed.addFields(
                    { name: '🗑️ Queue Cleared', value: `${queueLength} tracks removed from queue`, inline: true }
                );
            }
            
            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in stop command:', error);
            await interaction.reply({
                content: '❌ An error occurred while trying to stop the music!',
                ephemeral: true
            });
        }
    }
};