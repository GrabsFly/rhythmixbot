const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playtop')
        .setDescription('Add a song to the top of the queue')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Song name, URL, or search query')
                .setRequired(true)
        ),
    
    async execute(interaction, client) {
        try {
            // Check if user is in a voice channel
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                return await interaction.reply({
                    content: '❌ You need to be in a voice channel to play music!',
                    ephemeral: true
                });
            }

            // Check bot permissions
            const permissions = voiceChannel.permissionsFor(interaction.guild.members.me);
            if (!permissions.has(['Connect', 'Speak'])) {
                return await interaction.reply({
                    content: '❌ I need permissions to connect and speak in your voice channel!',
                    ephemeral: true
                });
            }

            await interaction.deferReply();

            const query = interaction.options.getString('query');
            
            // Determine search platform based on URL
            let searchPlatform = 'ytsearch';
            if (query.includes('spotify.com')) {
                searchPlatform = 'spsearch';
            } else if (query.includes('soundcloud.com')) {
                searchPlatform = 'scsearch';
            } else if (query.includes('youtube.com') || query.includes('youtu.be')) {
                searchPlatform = 'ytmsearch';
            }

            // Get or create player
            let player = client.lavalink.getPlayer(interaction.guildId);
            if (!player) {
                // Get default volume for this guild
                const defaultVolumeCommand = client.commands.get('defaultvolume');
                const defaultVolume = defaultVolumeCommand ? defaultVolumeCommand.getDefaultVolume(interaction.guildId) : (parseInt(process.env.DEFAULT_VOLUME) || 50);
                
                player = await client.lavalink.createPlayer({
                    guildId: interaction.guildId,
                    voiceChannelId: voiceChannel.id,
                    textChannelId: interaction.channelId,
                    selfDeaf: true,
                    volume: defaultVolume
                });
            }

            // Connect to voice channel if not connected
            if (!player.connected) {
                await player.connect();
            }

            // Search for tracks
            const searchQuery = query.startsWith('http') ? query : `${searchPlatform}:${query}`;
            const result = await player.search({
                query: searchQuery,
                source: searchPlatform.replace('search', '')
            }, interaction.user);

            if (!result || !result.tracks || result.tracks.length === 0) {
                return await interaction.editReply({
                    content: '❌ No tracks found for your search query!'
                });
            }

            // Handle playlist
            if (result.loadType === 'playlist') {
                const playlist = result.playlist;
                
                // Add tracks to the top of the queue (reverse order to maintain playlist order)
                for (let i = result.tracks.length - 1; i >= 0; i--) {
                    player.queue.splice(0, 0, result.tracks[i]);
                }
                
                const embed = new EmbedBuilder()
                    .setColor('#ff6b35')
                    .setTitle('📋 Playlist Added to Top')
                    .setDescription(`**${playlist.name}**\n${result.tracks.length} tracks added to the top of queue`)
                    .addFields(
                        { name: '👤 Requested by', value: interaction.user.toString(), inline: true },
                        { name: '⏱️ Duration', value: formatDuration(result.tracks.reduce((acc, track) => acc + track.info.duration, 0)), inline: true }
                    )
                    .setTimestamp();
                
                if (playlist.selectedTrack) {
                    embed.addFields({ name: '🎵 Starting with', value: playlist.selectedTrack.info.title, inline: false });
                }
                
                await interaction.editReply({ embeds: [embed] });
            } else {
                // Handle single track - add to top of queue
                const track = result.tracks[0];
                
                // If queue is empty or no current track, just add normally
                if (player.queue.tracks.length === 0 && !player.queue.current) {
                    await player.queue.add(track);
                } else {
                    // Add to the very top of the queue (position 0)
                    player.queue.splice(0, 0, track);
                }
                
                const embed = new EmbedBuilder()
                    .setColor('#ff6b35')
                    .setTitle('🔝 Track Added to Top')
                    .setDescription(`**[${track.info.title}](${track.info.uri})**`)
                    .addFields(
                        { name: '👤 Artist', value: track.info.author || 'Unknown', inline: true },
                        { name: '⏱️ Duration', value: formatDuration(track.info.duration), inline: true },
                        { name: '👤 Requested by', value: interaction.user.toString(), inline: true },
                        { name: '📍 Position', value: 'Next in queue', inline: true }
                    )
                    .setTimestamp();
                
                if (track.info.artworkUrl) {
                    embed.setThumbnail(track.info.artworkUrl);
                }
                
                await interaction.editReply({ embeds: [embed] });
            }

            // Start playing if not already playing
            if (!player.playing && !player.paused) {
                await player.play();
            }

        } catch (error) {
            console.error('Error in playtop command:', error);
            
            const errorMessage = {
                content: '❌ An error occurred while trying to add the track to the top of the queue!',
                ephemeral: true
            };
            
            if (interaction.deferred) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
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