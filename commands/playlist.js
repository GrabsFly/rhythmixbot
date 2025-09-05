const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Playlist storage files
const PLAYLISTS_FILE = path.join(__dirname, '..', 'playlists.json');
const SERVER_PLAYLISTS_DIR = path.join(__dirname, '..', 'server-playlists');

// Helper function to load user playlists
function loadPlaylists() {
    try {
        if (fs.existsSync(PLAYLISTS_FILE)) {
            const data = fs.readFileSync(PLAYLISTS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading playlists:', error);
    }
    return {};
}

// Helper function to load server playlists
function loadServerPlaylists(guildId) {
    try {
        const serverPlaylistFile = path.join(SERVER_PLAYLISTS_DIR, `${guildId}.json`);
        if (fs.existsSync(serverPlaylistFile)) {
            const data = fs.readFileSync(serverPlaylistFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading server playlists:', error);
    }
    return {};
}

// Helper function to save user playlists
function savePlaylists(playlists) {
    try {
        fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify(playlists, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving playlists:', error);
        return false;
    }
}

// Helper function to save server playlists
function saveServerPlaylists(guildId, playlists) {
    try {
        // Ensure server playlists directory exists
        if (!fs.existsSync(SERVER_PLAYLISTS_DIR)) {
            fs.mkdirSync(SERVER_PLAYLISTS_DIR, { recursive: true });
        }
        
        const serverPlaylistFile = path.join(SERVER_PLAYLISTS_DIR, `${guildId}.json`);
        fs.writeFileSync(serverPlaylistFile, JSON.stringify(playlists, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving server playlists:', error);
        return false;
    }
}

// Helper function to get user playlists
function getUserPlaylists(userId) {
    const allPlaylists = loadPlaylists();
    return allPlaylists[userId] || {};
}

// Helper function to get server playlists
function getServerPlaylists(guildId) {
    return loadServerPlaylists(guildId);
}

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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playlist')
        .setDescription('Manage your personal playlists')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new empty playlist')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the playlist')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('save')
                .setDescription('Save the current queue as a playlist')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the playlist')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('load')
                .setDescription('Load a saved playlist into the queue')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the playlist to load')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a saved playlist')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the playlist to delete')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all your saved playlists')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Show information about a specific playlist')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the playlist')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('server-create')
                .setDescription('Create a new server playlist (requires Manage Server permission)')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the server playlist')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('server-save')
                .setDescription('Save the current queue as a server playlist (requires Manage Server permission)')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the server playlist')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('server-load')
                .setDescription('Load a server playlist into the queue')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the server playlist to load')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('server-delete')
                .setDescription('Delete a server playlist (requires Manage Server permission)')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the server playlist to delete')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('server-list')
                .setDescription('List all server playlists')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('server-info')
                .setDescription('Show information about a specific server playlist')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the server playlist')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        ),

    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        const subcommand = interaction.options.getSubcommand();
        
        if (focusedOption.name === 'name') {
            let playlistNames = [];
            
            if (subcommand.startsWith('server-')) {
                // Server playlist autocomplete
                const serverPlaylists = getServerPlaylists(interaction.guildId);
                playlistNames = Object.keys(serverPlaylists);
            } else {
                // User playlist autocomplete
                const userPlaylists = getUserPlaylists(interaction.user.id);
                playlistNames = Object.keys(userPlaylists);
            }
            
            const filtered = playlistNames.filter(name => 
                name.toLowerCase().includes(focusedOption.value.toLowerCase())
            ).slice(0, 25);
            
            await interaction.respond(
                filtered.map(name => ({ name: name, value: name }))
            );
        }
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        
        try {
            switch (subcommand) {
                case 'create':
                    await this.handleCreate(interaction, userId);
                    break;
                case 'save':
                    await this.handleSave(interaction, userId);
                    break;
                case 'load':
                    await this.handleLoad(interaction, userId);
                    break;
                case 'delete':
                    await this.handleDelete(interaction, userId);
                    break;
                case 'list':
                    await this.handleList(interaction, userId);
                    break;
                case 'info':
                    await this.handleInfo(interaction, userId);
                    break;
                case 'server-create':
                    await this.handleServerCreate(interaction);
                    break;
                case 'server-save':
                    await this.handleServerSave(interaction);
                    break;
                case 'server-load':
                    await this.handleServerLoad(interaction);
                    break;
                case 'server-delete':
                    await this.handleServerDelete(interaction);
                    break;
                case 'server-list':
                    await this.handleServerList(interaction);
                    break;
                case 'server-info':
                    await this.handleServerInfo(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Unknown subcommand!',
                        flags: MessageFlags.Ephemeral
                    });
            }
        } catch (error) {
            console.error('Error in playlist command:', error);
            
            const errorMessage = {
                content: '❌ An error occurred while processing your playlist command!',
                flags: MessageFlags.Ephemeral
            };
            
            if (interaction.deferred) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    },

    async handleCreate(interaction, userId) {
        const playlistName = interaction.options.getString('name');
        
        if (playlistName.length > 50) {
            return await interaction.reply({
                content: '❌ Playlist name must be 50 characters or less!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        const allPlaylists = loadPlaylists();
        if (!allPlaylists[userId]) {
            allPlaylists[userId] = {};
        }
        
        if (allPlaylists[userId][playlistName]) {
            return await interaction.reply({
                content: `❌ You already have a playlist named "${playlistName}"!`,
                flags: MessageFlags.Ephemeral
            });
        }
        
        allPlaylists[userId][playlistName] = {
            name: playlistName,
            tracks: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        if (savePlaylists(allPlaylists)) {
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('📋 Playlist Created')
                .setDescription(`Successfully created playlist **${playlistName}**!`)
                .addFields(
                    { name: '📝 Name', value: playlistName, inline: true },
                    { name: '🎵 Tracks', value: '0', inline: true },
                    { name: '⏱️ Duration', value: '00:00', inline: true }
                )
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply({
                content: '❌ Failed to create playlist. Please try again!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async handleSave(interaction, userId) {
        const playlistName = interaction.options.getString('name');
        
        if (playlistName.length > 50) {
            return await interaction.reply({
                content: '❌ Playlist name must be 50 characters or less!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        const player = interaction.client.lavalink.getPlayer(interaction.guildId);
        if (!player || (!player.queue.current && player.queue.tracks.length === 0)) {
            return await interaction.reply({
                content: '❌ No music is currently playing or queued!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        const tracks = [];
        
        // Add current track if playing
        if (player.queue.current) {
            tracks.push({
                title: player.queue.current.info.title,
                author: player.queue.current.info.author,
                uri: player.queue.current.info.uri,
                duration: player.queue.current.info.duration,
                artworkUrl: player.queue.current.info.artworkUrl
            });
        }
        
        // Add queued tracks
        player.queue.tracks.forEach(track => {
            tracks.push({
                title: track.info.title,
                author: track.info.author,
                uri: track.info.uri,
                duration: track.info.duration,
                artworkUrl: track.info.artworkUrl
            });
        });
        
        const allPlaylists = loadPlaylists();
        if (!allPlaylists[userId]) {
            allPlaylists[userId] = {};
        }
        
        const totalDuration = tracks.reduce((acc, track) => acc + (track.duration || 0), 0);
        
        allPlaylists[userId][playlistName] = {
            name: playlistName,
            tracks: tracks,
            createdAt: allPlaylists[userId][playlistName]?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        if (savePlaylists(allPlaylists)) {
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('💾 Playlist Saved')
                .setDescription(`Successfully saved current queue as **${playlistName}**!`)
                .addFields(
                    { name: '📝 Name', value: playlistName, inline: true },
                    { name: '🎵 Tracks', value: tracks.length.toString(), inline: true },
                    { name: '⏱️ Duration', value: formatDuration(totalDuration), inline: true }
                )
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply({
                content: '❌ Failed to save playlist. Please try again!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async handleLoad(interaction, userId) {
        const playlistName = interaction.options.getString('name');
        
        // Check if user is in a voice channel
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return await interaction.reply({
                content: '❌ You need to be in a voice channel to load a playlist!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        // Check bot permissions
        const permissions = voiceChannel.permissionsFor(interaction.guild.members.me);
        if (!permissions.has(['Connect', 'Speak'])) {
            return await interaction.reply({
                content: '❌ I need permissions to connect and speak in your voice channel!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        const userPlaylists = getUserPlaylists(userId);
        const playlist = userPlaylists[playlistName];
        
        if (!playlist) {
            return await interaction.reply({
                content: `❌ You don't have a playlist named "${playlistName}"!`,
                flags: MessageFlags.Ephemeral
            });
        }
        
        if (playlist.tracks.length === 0) {
            return await interaction.reply({
                content: `❌ Playlist "${playlistName}" is empty!`,
                flags: MessageFlags.Ephemeral
            });
        }
        
        await interaction.deferReply();
        
        // Get or create player
        let player = interaction.client.lavalink.getPlayer(interaction.guildId);
        if (!player) {
            const defaultVolumeCommand = interaction.client.commands.get('defaultvolume');
            const defaultVolume = defaultVolumeCommand ? defaultVolumeCommand.getDefaultVolume(interaction.guildId) : (parseInt(process.env.DEFAULT_VOLUME) || 50);
            
            player = await interaction.client.lavalink.createPlayer({
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
        
        let loadedTracks = 0;
        let failedTracks = 0;
        
        for (const trackData of playlist.tracks) {
            try {
                const result = await player.search({
                    query: trackData.uri,
                    source: 'youtube'
                }, interaction.user);
                
                if (result && result.tracks && result.tracks.length > 0) {
                    await player.queue.add(result.tracks[0]);
                    loadedTracks++;
                } else {
                    failedTracks++;
                }
            } catch (error) {
                console.error('Error loading track:', error);
                failedTracks++;
            }
        }
        
        const totalDuration = playlist.tracks.reduce((acc, track) => acc + (track.duration || 0), 0);
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('📂 Playlist Loaded')
            .setDescription(`Successfully loaded playlist **${playlistName}**!`)
            .addFields(
                { name: '📝 Name', value: playlistName, inline: true },
                { name: '✅ Loaded', value: loadedTracks.toString(), inline: true },
                { name: '❌ Failed', value: failedTracks.toString(), inline: true },
                { name: '⏱️ Duration', value: formatDuration(totalDuration), inline: true }
            )
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        
        // Start playing if not already playing
        if (!player.playing && !player.paused) {
            await player.play();
        }
    },

    async handleDelete(interaction, userId) {
        const playlistName = interaction.options.getString('name');
        
        const userPlaylists = getUserPlaylists(userId);
        
        if (!userPlaylists[playlistName]) {
            return await interaction.reply({
                content: `❌ You don't have a playlist named "${playlistName}"!`,
                flags: MessageFlags.Ephemeral
            });
        }
        
        const allPlaylists = loadPlaylists();
        delete allPlaylists[userId][playlistName];
        
        if (savePlaylists(allPlaylists)) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🗑️ Playlist Deleted')
                .setDescription(`Successfully deleted playlist **${playlistName}**!`)
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply({
                content: '❌ Failed to delete playlist. Please try again!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async handleList(interaction, userId) {
        const userPlaylists = getUserPlaylists(userId);
        const playlistNames = Object.keys(userPlaylists);
        
        if (playlistNames.length === 0) {
            return await interaction.reply({
                content: '📋 You don\'t have any saved playlists yet!\n\nUse `/playlist create <name>` to create a new playlist or `/playlist save <name>` to save your current queue.',
                flags: MessageFlags.Ephemeral
            });
        }
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📋 Your Playlists')
            .setDescription(`You have ${playlistNames.length} saved playlist${playlistNames.length === 1 ? '' : 's'}:`);
        
        const playlistList = playlistNames.map(name => {
            const playlist = userPlaylists[name];
            const trackCount = playlist.tracks.length;
            const totalDuration = playlist.tracks.reduce((acc, track) => acc + (track.duration || 0), 0);
            return `**${name}** - ${trackCount} track${trackCount === 1 ? '' : 's'} (${formatDuration(totalDuration)})`;
        }).join('\n');
        
        embed.addFields({ name: '🎵 Playlists', value: playlistList, inline: false });
        embed.setFooter({ text: 'Use /playlist info <name> to view details' });
        embed.setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    },

    async handleInfo(interaction, userId) {
        const playlistName = interaction.options.getString('name');
        
        const userPlaylists = getUserPlaylists(userId);
        const playlist = userPlaylists[playlistName];
        
        if (!playlist) {
            return await interaction.reply({
                content: `❌ You don't have a playlist named "${playlistName}"!`,
                flags: MessageFlags.Ephemeral
            });
        }
        
        const totalDuration = playlist.tracks.reduce((acc, track) => acc + (track.duration || 0), 0);
        const createdDate = new Date(playlist.createdAt).toLocaleDateString();
        const updatedDate = new Date(playlist.updatedAt).toLocaleDateString();
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`📋 ${playlist.name}`)
            .setDescription('Playlist Information')
            .addFields(
                { name: '🎵 Tracks', value: playlist.tracks.length.toString(), inline: true },
                { name: '⏱️ Duration', value: formatDuration(totalDuration), inline: true },
                { name: '📅 Created', value: createdDate, inline: true },
                { name: '🔄 Updated', value: updatedDate, inline: true }
            )
            .setTimestamp();
        
        if (playlist.tracks.length > 0) {
            const trackList = playlist.tracks.slice(0, 10).map((track, index) => {
                return `${index + 1}. **${track.title}** by ${track.author} (${formatDuration(track.duration)})`;
            }).join('\n');
            
            embed.addFields({ 
                name: `🎶 Tracks ${playlist.tracks.length > 10 ? '(First 10)' : ''}`, 
                value: trackList, 
                inline: false 
            });
            
            if (playlist.tracks.length > 10) {
                embed.setFooter({ text: `... and ${playlist.tracks.length - 10} more tracks` });
            }
        }
        
        await interaction.reply({ embeds: [embed] });
    },

    // Helper function to check server permissions
    hasServerPermission(interaction) {
        return interaction.member.permissions.has('ManageGuild') || interaction.member.permissions.has('Administrator');
    },

    async handleServerCreate(interaction) {
        if (!this.hasServerPermission(interaction)) {
            return await interaction.reply({
                content: '❌ You need "Manage Server" or "Administrator" permissions to create server playlists!',
                flags: MessageFlags.Ephemeral
            });
        }

        const playlistName = interaction.options.getString('name');
        
        if (playlistName.length > 50) {
            return await interaction.reply({
                content: '❌ Playlist name must be 50 characters or less!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        const serverPlaylists = getServerPlaylists(interaction.guildId);
        
        if (serverPlaylists[playlistName]) {
            return await interaction.reply({
                content: `❌ Server already has a playlist named "${playlistName}"!`,
                flags: MessageFlags.Ephemeral
            });
        }
        
        serverPlaylists[playlistName] = {
            name: playlistName,
            tracks: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: interaction.user.id,
            guildId: interaction.guildId
        };
        
        if (saveServerPlaylists(interaction.guildId, serverPlaylists)) {
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🏰 Server Playlist Created')
                .setDescription(`Successfully created server playlist **${playlistName}**!`)
                .addFields(
                    { name: '📝 Name', value: playlistName, inline: true },
                    { name: '🎵 Tracks', value: '0', inline: true },
                    { name: '⏱️ Duration', value: '00:00', inline: true },
                    { name: '👤 Created by', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply({
                content: '❌ Failed to create server playlist. Please try again!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async handleServerSave(interaction) {
        if (!this.hasServerPermission(interaction)) {
            return await interaction.reply({
                content: '❌ You need "Manage Server" or "Administrator" permissions to save server playlists!',
                flags: MessageFlags.Ephemeral
            });
        }

        const playlistName = interaction.options.getString('name');
        
        if (playlistName.length > 50) {
            return await interaction.reply({
                content: '❌ Playlist name must be 50 characters or less!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        const player = interaction.client.lavalink.getPlayer(interaction.guildId);
        if (!player || (!player.queue.current && player.queue.tracks.length === 0)) {
            return await interaction.reply({
                content: '❌ No music is currently playing or queued!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        const tracks = [];
        
        // Add current track if playing
        if (player.queue.current) {
            tracks.push({
                title: player.queue.current.info.title,
                author: player.queue.current.info.author,
                uri: player.queue.current.info.uri,
                duration: player.queue.current.info.duration,
                artworkUrl: player.queue.current.info.artworkUrl
            });
        }
        
        // Add queued tracks
        player.queue.tracks.forEach(track => {
            tracks.push({
                title: track.info.title,
                author: track.info.author,
                uri: track.info.uri,
                duration: track.info.duration,
                artworkUrl: track.info.artworkUrl
            });
        });
        
        const serverPlaylists = getServerPlaylists(interaction.guildId);
        const totalDuration = tracks.reduce((acc, track) => acc + (track.duration || 0), 0);
        
        serverPlaylists[playlistName] = {
            name: playlistName,
            tracks: tracks,
            createdAt: serverPlaylists[playlistName]?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: serverPlaylists[playlistName]?.createdBy || interaction.user.id,
            guildId: interaction.guildId
        };
        
        if (saveServerPlaylists(interaction.guildId, serverPlaylists)) {
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🏰 Server Playlist Saved')
                .setDescription(`Successfully saved current queue as server playlist **${playlistName}**!`)
                .addFields(
                    { name: '📝 Name', value: playlistName, inline: true },
                    { name: '🎵 Tracks', value: tracks.length.toString(), inline: true },
                    { name: '⏱️ Duration', value: formatDuration(totalDuration), inline: true },
                    { name: '👤 Saved by', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply({
                content: '❌ Failed to save server playlist. Please try again!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async handleServerLoad(interaction) {
        const playlistName = interaction.options.getString('name');
        const serverPlaylists = getServerPlaylists(interaction.guildId);
        
        if (!serverPlaylists[playlistName]) {
            return await interaction.reply({
                content: `❌ Server playlist "${playlistName}" not found!`,
                flags: MessageFlags.Ephemeral
            });
        }
        
        const playlist = serverPlaylists[playlistName];
        
        if (!playlist.tracks || playlist.tracks.length === 0) {
            return await interaction.reply({
                content: `❌ Server playlist "${playlistName}" is empty!`,
                flags: MessageFlags.Ephemeral
            });
        }
        
        // Check if user is in a voice channel
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return await interaction.reply({
                content: '❌ You need to be in a voice channel to load a playlist!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        await interaction.deferReply();
        
        // Get or create player
        let player = interaction.client.lavalink.getPlayer(interaction.guildId);
        if (!player) {
            player = interaction.client.lavalink.createPlayer({
                guildId: interaction.guildId,
                voiceChannelId: voiceChannel.id,
                textChannelId: interaction.channelId
            });
            await player.connect();
        }
        
        let loadedTracks = 0;
        let failedTracks = 0;
        
        for (const track of playlist.tracks) {
            try {
                const result = await interaction.client.lavalink.search({
                    query: track.uri,
                    source: 'youtube'
                }, interaction.user);
                
                if (result.tracks && result.tracks.length > 0) {
                    await player.queue.add(result.tracks[0]);
                    loadedTracks++;
                } else {
                    failedTracks++;
                }
            } catch (error) {
                console.error('Error loading track:', error);
                failedTracks++;
            }
        }
        
        const totalDuration = playlist.tracks.reduce((acc, track) => acc + (track.duration || 0), 0);
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🏰 Server Playlist Loaded')
            .setDescription(`Successfully loaded server playlist **${playlistName}**!`)
            .addFields(
                { name: '📝 Name', value: playlistName, inline: true },
                { name: '🎵 Loaded', value: `${loadedTracks}/${playlist.tracks.length}`, inline: true },
                { name: '⏱️ Duration', value: formatDuration(totalDuration), inline: true }
            )
            .setTimestamp();
        
        if (failedTracks > 0) {
            embed.addFields({ name: '⚠️ Failed', value: `${failedTracks} tracks could not be loaded`, inline: false });
        }
        
        // Start playing if nothing is currently playing
        if (!player.playing && !player.paused && player.queue.tracks.length > 0) {
            await player.play();
        }
        
        await interaction.editReply({ embeds: [embed] });
    },

    async handleServerDelete(interaction) {
        if (!this.hasServerPermission(interaction)) {
            return await interaction.reply({
                content: '❌ You need "Manage Server" or "Administrator" permissions to delete server playlists!',
                flags: MessageFlags.Ephemeral
            });
        }

        const playlistName = interaction.options.getString('name');
        const serverPlaylists = getServerPlaylists(interaction.guildId);
        
        if (!serverPlaylists[playlistName]) {
            return await interaction.reply({
                content: `❌ Server playlist "${playlistName}" not found!`,
                flags: MessageFlags.Ephemeral
            });
        }
        
        delete serverPlaylists[playlistName];
        
        if (saveServerPlaylists(interaction.guildId, serverPlaylists)) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🗑️ Server Playlist Deleted')
                .setDescription(`Successfully deleted server playlist **${playlistName}**!`)
                .addFields(
                    { name: '👤 Deleted by', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply({
                content: '❌ Failed to delete server playlist. Please try again!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async handleServerList(interaction) {
        const serverPlaylists = getServerPlaylists(interaction.guildId);
        const playlistNames = Object.keys(serverPlaylists);
        
        if (playlistNames.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#ffa500')
                .setTitle('🏰 Server Playlists')
                .setDescription('No server playlists found for this server.\n\nUse `/playlist server-create` to create your first server playlist!')
                .setTimestamp();
            
            return await interaction.reply({ embeds: [embed] });
        }
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🏰 Server Playlists')
            .setDescription(`Found ${playlistNames.length} server playlist(s):`)
            .setTimestamp();
        
        playlistNames.slice(0, 10).forEach((name, index) => {
            const playlist = serverPlaylists[name];
            const trackCount = playlist.tracks ? playlist.tracks.length : 0;
            const duration = playlist.tracks ? 
                formatDuration(playlist.tracks.reduce((acc, track) => acc + (track.duration || 0), 0)) : '00:00';
            
            embed.addFields({
                name: `${index + 1}. ${name}`,
                value: `🎵 ${trackCount} tracks • ⏱️ ${duration}`,
                inline: false
            });
        });
        
        if (playlistNames.length > 10) {
            embed.setFooter({ text: `... and ${playlistNames.length - 10} more playlists` });
        }
        
        await interaction.reply({ embeds: [embed] });
    },

    async handleServerInfo(interaction) {
        const playlistName = interaction.options.getString('name');
        const serverPlaylists = getServerPlaylists(interaction.guildId);
        
        if (!serverPlaylists[playlistName]) {
            return await interaction.reply({
                content: `❌ Server playlist "${playlistName}" not found!`,
                flags: MessageFlags.Ephemeral
            });
        }
        
        const playlist = serverPlaylists[playlistName];
        const trackCount = playlist.tracks ? playlist.tracks.length : 0;
        const totalDuration = playlist.tracks ? 
            playlist.tracks.reduce((acc, track) => acc + (track.duration || 0), 0) : 0;
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🏰 Server Playlist Info')
            .addFields(
                { name: '📝 Name', value: playlistName, inline: true },
                { name: '🎵 Tracks', value: trackCount.toString(), inline: true },
                { name: '⏱️ Duration', value: formatDuration(totalDuration), inline: true },
                { name: '👤 Created by', value: playlist.createdBy ? `<@${playlist.createdBy}>` : 'Unknown', inline: true },
                { name: '📅 Created', value: playlist.createdAt ? new Date(playlist.createdAt).toLocaleDateString() : 'Unknown', inline: true },
                { name: '📅 Updated', value: playlist.updatedAt ? new Date(playlist.updatedAt).toLocaleDateString() : 'Unknown', inline: true }
            )
            .setTimestamp();
        
        if (playlist.tracks && playlist.tracks.length > 0) {
            const trackList = playlist.tracks.slice(0, 10).map((track, index) => 
                `${index + 1}. **${track.title}** by ${track.author} \`${formatDuration(track.duration)}\``
            ).join('\n');
            
            embed.addFields({ 
                name: '🎵 Tracks', 
                value: trackList, 
                inline: false 
            });
            
            if (playlist.tracks.length > 10) {
                embed.setFooter({ text: `... and ${playlist.tracks.length - 10} more tracks` });
            }
        }
        
        await interaction.reply({ embeds: [embed] });
    }
};