const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause or resume the current track'),
    
    async execute(interaction, client) {
        try {
            // Check if user is in a voice channel
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                return await interaction.reply({
                    content: '❌ You need to be in a voice channel to use this command!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Get player
            const player = client.lavalink.getPlayer(interaction.guildId);
            if (!player) {
                return await interaction.reply({
                    content: '❌ There is no music playing!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Check if user is in the same voice channel as bot
            if (player.voiceChannelId !== voiceChannel.id) {
                return await interaction.reply({
                    content: '❌ You need to be in the same voice channel as the bot!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Toggle pause/resume
            if (player.paused) {
                await player.resume();
                
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('▶️ Music Resumed')
                    .setDescription('The music has been resumed!')
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed] });
            } else {
                await player.pause();
                
                const embed = new EmbedBuilder()
                    .setColor('#ffff00')
                    .setTitle('⏸️ Music Paused')
                    .setDescription('The music has been paused!')
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Error in pause command:', error);
            await interaction.reply({
                content: '❌ An error occurred while trying to pause/resume the music!',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};