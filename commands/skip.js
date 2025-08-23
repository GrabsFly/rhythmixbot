const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current track')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of tracks to skip (default: 1)')
                .setMinValue(1)
                .setMaxValue(10)
        ),
    
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

            const skipAmount = interaction.options.getInteger('amount') || 1;
            const currentTrack = player.queue.current;
            
            if (!currentTrack) {
                return await interaction.reply({
                    content: '❌ There is no track currently playing!',
                    ephemeral: true
                });
            }

            // Check if there are enough tracks to skip
            if (skipAmount > 1 && player.queue.tracks.length < skipAmount - 1) {
                return await interaction.reply({
                    content: `❌ Not enough tracks in queue! Only ${player.queue.tracks.length + 1} tracks available.`,
                    ephemeral: true
                });
            }

            // Skip tracks
            if (skipAmount === 1) {
                await player.skip();
                
                const embed = new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('⏭️ Track Skipped')
                    .setDescription(`Skipped: **${currentTrack.info.title}**`)
                    .addFields(
                        { name: '👤 Skipped by', value: interaction.user.toString(), inline: true }
                    )
                    .setTimestamp();
                
                if (player.queue.current) {
                    embed.addFields(
                        { name: '🎵 Now Playing', value: `**${player.queue.current.info.title}**`, inline: false }
                    );
                }
                
                await interaction.reply({ embeds: [embed] });
            } else {
                // Skip multiple tracks
                const skippedTracks = [currentTrack];
                
                for (let i = 0; i < skipAmount - 1; i++) {
                    if (player.queue.tracks.length > 0) {
                        skippedTracks.push(player.queue.tracks[0]);
                        player.queue.splice(0, 1);
                    }
                }
                
                await player.skip();
                
                const embed = new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('⏭️ Multiple Tracks Skipped')
                    .setDescription(`Skipped ${skipAmount} tracks`)
                    .addFields(
                        { name: '👤 Skipped by', value: interaction.user.toString(), inline: true },
                        { name: '📋 Skipped Tracks', value: skippedTracks.map((track, index) => `${index + 1}. ${track.info.title}`).join('\n').substring(0, 1024), inline: false }
                    )
                    .setTimestamp();
                
                if (player.queue.current) {
                    embed.addFields(
                        { name: '🎵 Now Playing', value: `**${player.queue.current.info.title}**`, inline: false }
                    );
                }
                
                await interaction.reply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Error in skip command:', error);
            await interaction.reply({
                content: '❌ An error occurred while trying to skip the track(s)!',
                ephemeral: true
            });
        }
    }
};