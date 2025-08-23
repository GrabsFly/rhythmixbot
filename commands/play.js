const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play music from YouTube, Spotify, or SoundCloud')
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
                    content: '❌ I don\'t have permission to connect or speak in your voice channel!',
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
                await player.queue.add(result.tracks);
                
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('📋 Playlist Added to Queue')
                    .setDescription(`**${playlist.name}**\n🎵 Added ${result.tracks.length} tracks to the queue`)
                    .addFields(
                        { name: '👤 Requested by', value: interaction.user.toString(), inline: true },
                        { name: '⏱️ Total Duration', value: formatDuration(result.tracks.reduce((acc, track) => acc + track.info.duration, 0)), inline: true }
                    )
                    .setTimestamp();
                
                if (playlist.selectedTrack) {
                    embed.addFields({ name: '▶️ Starting with', value: playlist.selectedTrack.info.title, inline: false });
                }
                
                await interaction.editReply({ embeds: [embed] });
            } else {
                // Handle single track
                const track = result.tracks[0];
                await player.queue.add(track);
                
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🎵 Track Added to Queue')
                    .setDescription(`**[${track.info.title}](${track.info.uri})**`)
                    .addFields(
                        { name: '🎤 Artist', value: track.info.author || 'Unknown', inline: true },
                        { name: '⏱️ Duration', value: formatDuration(track.info.duration), inline: true },
                        { name: '👤 Requested by', value: interaction.user.toString(), inline: true }
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
            console.error('Error in play command:', error);
            
            // Skip responding to expired interactions
            if (error.code === 10062 || error.message?.includes('Unknown interaction')) {
                console.warn('⚠️ Play command interaction expired, skipping response');
                return;
            }
            
            const errorMessage = {
                content: '❌ An error occurred while trying to play music. Please try again.',
                ephemeral: true
            };
            
            try {
                if (interaction.deferred) {
                    await interaction.editReply(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            } catch (replyError) {
                // If we can't reply, just log it
                console.warn('⚠️ Could not send error message to user:', replyError.message);
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