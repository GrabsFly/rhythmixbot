const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Display information about the currently playing track')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action to perform')
                .addChoices(
                    { name: 'Show Info', value: 'info' },
                    { name: 'Show Lyrics', value: 'lyrics' }
                )
        ),
    
    async execute(interaction, client) {
        try {
            // Get player
            const player = client.lavalink.getPlayer(interaction.guildId);
            if (!player) {
                return await interaction.reply({
                    content: '❌ No music is currently playing!',
                    ephemeral: true
                });
            }

            const currentTrack = player.queue.current;
            if (!currentTrack) {
                return await interaction.reply({
                    content: '❌ No track is currently playing!',
                    ephemeral: true
                });
            }

            // Handle both slash commands and button interactions
            const action = interaction.options ? interaction.options.getString('action') || 'info' : 'info';

            if (action === 'info') {
                const progress = player.position;
                const duration = currentTrack.info.duration;
                const progressBar = createProgressBar(progress, duration);
                const progressPercentage = duration > 0 ? Math.round((progress / duration) * 100) : 0;

                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🎵 Now Playing')
                    .setDescription(`**[${currentTrack.info.title}](${currentTrack.info.uri})**`)
                    .addFields(
                        { name: '👤 Artist', value: currentTrack.info.author || 'Unknown', inline: true },
                        { name: '⏱️ Duration', value: formatDuration(duration), inline: true },
                        { name: '🎯 Source', value: getSourceName(currentTrack.info.sourceName), inline: true },
                        { name: '👤 Requested by', value: currentTrack.requester?.username || 'Unknown', inline: true },
                        { name: '🔊 Volume', value: `${player.volume}%`, inline: true },
                        { name: '📊 Progress', value: `${progressPercentage}%`, inline: true },
                        { name: '⏱️ Time', value: `${formatDuration(progress)} / ${formatDuration(duration)}`, inline: false },
                        { name: '📊 Progress Bar', value: progressBar, inline: false }
                    )
                    .setTimestamp();

                // Add thumbnail if available
                if (currentTrack.info.artworkUrl) {
                    embed.setThumbnail(currentTrack.info.artworkUrl);
                }

                // Add player status
                let status = [];
                if (player.paused) status.push('⏸️ Paused');
                if (player.repeatMode !== 'off') status.push(`🔁 Repeat: ${player.repeatMode}`);
                if (player.queue.shuffled) status.push('🔀 Shuffled');
                
                if (status.length > 0) {
                    embed.addFields({
                        name: '⚙️ Status',
                        value: status.join(' • '),
                        inline: false
                    });
                }

                // Add queue info
                const queueLength = player.queue.tracks.length;
                if (queueLength > 0) {
                    const nextTrack = player.queue.tracks[0];
                    embed.addFields({
                        name: '⏭️ Up Next',
                        value: `**${nextTrack.info.title}** by ${nextTrack.info.author}\n+${queueLength - 1} more in queue`,
                        inline: false
                    });
                }

                // Create interactive buttons
                const row1 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('music_previous')
                            .setLabel('⏮️ Previous')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(player.queue.previous.length === 0),
                        new ButtonBuilder()
                            .setCustomId('music_pause')
                            .setLabel(player.paused ? '▶️ Resume' : '⏸️ Pause')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('music_stop')
                            .setLabel('⏹️ Stop')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('music_skip')
                            .setLabel('⏭️ Skip')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(queueLength === 0),
                        new ButtonBuilder()
                            .setCustomId('music_shuffle')
                            .setLabel(getShuffleLabel(interaction.guildId, client))
                            .setEmoji(getShuffleEmoji(interaction.guildId, client))
                            .setStyle(getShuffleStyle(interaction.guildId, client))
                    );

                const row2 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('music_volume_down')
                            .setLabel('🔉 Vol-')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(player.volume <= 0),
                        new ButtonBuilder()
                            .setCustomId('music_repeat')
                            .setLabel(getRepeatLabel(player))
                            .setEmoji(getRepeatEmoji(player))
                            .setStyle(getRepeatStyle(player)),
                        new ButtonBuilder()
                            .setCustomId('music_queue')
                            .setLabel('📋 Queue')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('music_volume_up')
                            .setLabel('🔊 Vol+')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(player.volume >= 100),
                        new ButtonBuilder()
                            .setCustomId('music_refresh')
                            .setLabel('🔄 Refresh')
                            .setStyle(ButtonStyle.Secondary)
                    );

                await interaction.reply({ 
                    embeds: [embed], 
                    components: [row1, row2]
                });
            } else if (action === 'lyrics') {
                await interaction.deferReply();
                
                // Note: This is a placeholder for lyrics functionality
                // You would need to integrate with a lyrics API like Genius, Musixmatch, etc.
                const embed = new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('🎤 Lyrics')
                    .setDescription(`**${currentTrack.info.title}** by ${currentTrack.info.author}`)
                    .addFields({
                        name: '📝 Lyrics',
                        value: '🚧 Lyrics feature is not yet implemented.\n\nTo add lyrics functionality, you can integrate with:\n• Genius API\n• Musixmatch API\n• LyricFind API\n\nFor now, you can search for lyrics manually on your preferred lyrics website.',
                        inline: false
                    })
                    .setTimestamp();

                if (currentTrack.info.artworkUrl) {
                    embed.setThumbnail(currentTrack.info.artworkUrl);
                }

                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Error in nowplaying command:', error);
            await interaction.reply({
                content: '❌ An error occurred while displaying track information!',
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

// Helper function to get source name
function getSourceName(sourceName) {
    const sources = {
        'youtube': '🔴 YouTube',
        'youtubemusic': '🎵 YouTube Music',
        'spotify': '🟢 Spotify',
        'soundcloud': '🟠 SoundCloud',
        'bandcamp': '🔵 Bandcamp',
        'twitch': '🟣 Twitch',
        'vimeo': '🔷 Vimeo',
        'http': '🌐 HTTP Stream'
    };
    
    return sources[sourceName?.toLowerCase()] || `📻 ${sourceName || 'Unknown'}`;
}

// Helper functions for shuffle mode display
function getShuffleLabel(guildId, client) {
    // Access shuffleModes from the client instance
    const shuffleModes = client.shuffleModes || new Map();
    const currentMode = shuffleModes.get(guildId) || 'off';
    
    switch (currentMode) {
        case 'normal': return 'Shuffle: Normal';
        case 'smart': return 'Shuffle: Smart';
        case 'off':
        default: return 'Shuffle: Off';
    }
}

function getShuffleEmoji(guildId, client) {
    const shuffleModes = client.shuffleModes || new Map();
    const currentMode = shuffleModes.get(guildId) || 'off';
    
    switch (currentMode) {
        case 'smart': return '🧠';
        case 'normal':
        case 'off':
        default: return '🔀';
    }
}

function getShuffleStyle(guildId, client) {
    const shuffleModes = client.shuffleModes || new Map();
    const currentMode = shuffleModes.get(guildId) || 'off';
    
    switch (currentMode) {
        case 'normal':
        case 'smart': return ButtonStyle.Success;
        case 'off':
        default: return ButtonStyle.Secondary;
    }
}

// Helper functions for repeat mode display
function getRepeatLabel(player) {
    if (!player || !player.repeatMode) return 'Repeat';
    
    switch (player.repeatMode) {
        case 'track': return 'Repeat: Track';
        case 'queue': return 'Repeat: Queue';
        case 'off':
        default: return 'Repeat: Off';
    }
}

function getRepeatEmoji(player) {
    if (!player || !player.repeatMode) return '🔁';
    
    switch (player.repeatMode) {
        case 'track': return '🔂';
        case 'queue':
        case 'off':
        default: return '🔁';
    }
}

function getRepeatStyle(player) {
    if (!player || !player.repeatMode) return ButtonStyle.Secondary;
    
    switch (player.repeatMode) {
        case 'track':
        case 'queue': return ButtonStyle.Success;
        case 'off':
        default: return ButtonStyle.Secondary;
    }
}