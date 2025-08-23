const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Display the current music queue')
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number to display (default: 1)')
                .setMinValue(1)
        ),
    
    async execute(interaction, client) {
        try {
            // Get player
            const player = client.lavalink.getPlayer(interaction.guildId);
            if (!player) {
                return await interaction.reply({
                    content: '❌ There is no music playing!',
                    ephemeral: true
                });
            }

            const currentTrack = player.queue.current;
            const queue = player.queue.tracks;
            const page = interaction.options.getInteger('page') || 1;
            const tracksPerPage = 10;
            const startIndex = (page - 1) * tracksPerPage;
            const endIndex = startIndex + tracksPerPage;
            const totalPages = Math.ceil(queue.length / tracksPerPage);

            if (page > totalPages && totalPages > 0) {
                return await interaction.reply({
                    content: `❌ Invalid page number! Please choose a page between 1 and ${totalPages}.`,
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🎵 Music Queue')
                .setTimestamp();

            // Current track
            if (currentTrack) {
                const progress = player.position;
                const duration = currentTrack.info.duration;
                const progressBar = createProgressBar(progress, duration);
                
                embed.addFields({
                    name: '🎵 Now Playing',
                    value: `**[${currentTrack.info.title}](${currentTrack.info.uri})**\n` +
                           `👤 ${currentTrack.info.author}\n` +
                           `⏱️ ${formatDuration(progress)} / ${formatDuration(duration)}\n` +
                           `${progressBar}\n` +
                           `👤 Requested by: ${currentTrack.requester?.username || 'Unknown'}`,
                    inline: false
                });
            }

            // Queue
            if (queue.length === 0) {
                embed.addFields({
                    name: '📋 Queue',
                    value: 'No tracks in queue',
                    inline: false
                });
            } else {
                const queueTracks = queue.slice(startIndex, endIndex);
                const queueText = queueTracks.map((track, index) => {
                    const position = startIndex + index + 1;
                    return `**${position}.** [${track.info.title}](${track.info.uri})\n` +
                           `👤 ${track.info.author} • ⏱️ ${formatDuration(track.info.duration)} • 👤 ${track.requester?.username || 'Unknown'}`;
                }).join('\n\n');

                embed.addFields({
                    name: `📋 Queue (${queue.length} tracks)`,
                    value: queueText.length > 1024 ? queueText.substring(0, 1021) + '...' : queueText,
                    inline: false
                });

                // Page info
                if (totalPages > 1) {
                    embed.setFooter({
                        text: `Page ${page} of ${totalPages} • Total duration: ${formatDuration(queue.reduce((acc, track) => acc + track.info.duration, 0))}`
                    });
                } else {
                    embed.setFooter({
                        text: `Total duration: ${formatDuration(queue.reduce((acc, track) => acc + track.info.duration, 0))}`
                    });
                }
            }

            // Player info
            const volume = player.volume;
            const repeatMode = player.repeatMode;
            const shuffled = player.queue.shuffled;
            
            let playerInfo = `🔊 Volume: ${volume}%`;
            if (repeatMode !== 'off') {
                playerInfo += ` • 🔁 Repeat: ${repeatMode}`;
            }
            if (shuffled) {
                playerInfo += ` • 🔀 Shuffled`;
            }
            if (player.paused) {
                playerInfo += ` • ⏸️ Paused`;
            }
            
            embed.addFields({
                name: '⚙️ Player Settings',
                value: playerInfo,
                inline: false
            });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in queue command:', error);
            await interaction.reply({
                content: '❌ An error occurred while displaying the queue!',
                ephemeral: true
            });
        }
    }
};

// Helper function to format duration
function formatDuration(ms) {
    if (!ms || ms === 0) return '00:00';
    
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    
    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Helper function to create progress bar
function createProgressBar(current, total, length = 20) {
    if (!total || total === 0) return '▬'.repeat(length);
    
    const progress = Math.round((current / total) * length);
    const emptyProgress = length - progress;
    
    const progressText = '▬'.repeat(progress);
    const emptyProgressText = '▬'.repeat(emptyProgress);
    
    return '🔘' + progressText + emptyProgressText;
}