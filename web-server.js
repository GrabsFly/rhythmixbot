const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { testConnection, initializeDatabase } = require('./database');
const { GuildSettings } = require('./models');

class WebServer {
    constructor(discordClient) {
        this.client = discordClient;
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        // Check user permissions for a specific guild
        this.app.get('/api/user/:userId/guild/:guildId/permissions', async (req, res) => {
            try {
                const { userId, guildId } = req.params;
                const { access_token } = req.query;

                if (!access_token) {
                    return res.status(401).json({ error: 'Access token required' });
                }

                // Get user guilds to check permissions
                const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
                    headers: {
                        'Authorization': `Bearer ${access_token}`
                    }
                });

                const guildsData = await guildsResponse.json();
                const guild = guildsData.find(g => g.id === guildId);

                if (!guild) {
                    return res.status(404).json({ error: 'Guild not found or user not in guild' });
                }

                const permissions = parseInt(guild.permissions);
                const MANAGE_GUILD = 0x20;
                const ADMINISTRATOR = 0x8;
                const MANAGE_CHANNELS = 0x10;
                const MANAGE_ROLES = 0x10000000;

                const hasManageGuild = (permissions & MANAGE_GUILD) === MANAGE_GUILD;
                const hasAdministrator = (permissions & ADMINISTRATOR) === ADMINISTRATOR;
                const hasManageChannels = (permissions & MANAGE_CHANNELS) === MANAGE_CHANNELS;
                const hasManageRoles = (permissions & MANAGE_ROLES) === MANAGE_ROLES;

                // Check if bot is in the guild
                const botInGuild = this.client.guilds.cache.has(guildId);

                res.json({
                    userId,
                    guildId,
                    guildName: guild.name,
                    botInGuild,
                    permissions: {
                        administrator: hasAdministrator,
                        manageGuild: hasManageGuild,
                        manageChannels: hasManageChannels,
                        manageRoles: hasManageRoles,
                        canAccessSettings: hasManageGuild || hasAdministrator,
                        canManageBot: hasManageGuild || hasAdministrator,
                        canViewDashboard: true // All users can view dashboard if bot is in guild
                    },
                    permissionLevel: hasAdministrator ? 'administrator' : hasManageGuild ? 'manage_guild' : 'member'
                });
            } catch (error) {
                console.error('Error checking user permissions:', error);
                res.status(500).json({ error: 'Failed to check permissions' });
            }
        });
        this.port = process.env.WEB_PORT || 3001;
        this.settingsFile = path.join(__dirname, 'guild-settings.json');
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketEvents();
        this.initializeDatabase();
    }

    // Helper function to get target channel ID (configured, auto-detected, or default)
    async getTargetChannelId(guildId, defaultChannelId) {
        try {
            const guildSettings = await this.getGuildSettings(guildId);
            if (guildSettings && guildSettings.nowPlayingChannelId) {
                console.log(`🎵 Using configured channel: ${guildSettings.nowPlayingChannelId} for guild ${guildId}`);
                return guildSettings.nowPlayingChannelId;
            }
        } catch (error) {
            console.error(`❌ 获取服务器 ${guildId} 设置失败:`, error.message);
        }
        
        // Auto-detect music-related text channel if no configured channel
        const guild = this.client.guilds.cache.get(guildId);
        if (guild) {
            const musicChannels = guild.channels.cache.filter(channel => 
                channel.type === 0 && // Text channel
                (channel.name.includes('music') || 
                 channel.name.includes('bot') || 
                 channel.name.includes('command'))
            );
            
            if (musicChannels.size > 0) {
                const autoChannel = musicChannels.first();
                console.log(`🔍 Auto-detected channel: ${autoChannel.name} (${autoChannel.id}) for guild ${guildId}`);
                return autoChannel.id;
            }
        }
        
        console.log(`📝 Using default channel: ${defaultChannelId} for guild ${guildId}`);
        return defaultChannelId;
    }

    setupMiddleware() {
        this.app.use(cors());
        
        this.app.use(express.json({ limit: '10mb' }));
        
        // Static middleware will be added after routes to avoid conflicts
    }

    setupRoutes() {
        // Serve the homepage
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        // Serve pages without .html extension
        this.app.get('/dashboard', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
        });
        
        this.app.get('/commands', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'commands.html'));
        });
        
        this.app.get('/servers', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'servers.html'));
        });
        
        this.app.get('/login', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'login.html'));
        });
        
        this.app.get('/terms', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'terms.html'));
        });
        
        this.app.get('/privacy', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
        });
        
        // Redirect .html requests to clean URLs
        this.app.get('/*.html', (req, res) => {
            const cleanUrl = req.path.replace('.html', '');
            res.redirect(301, cleanUrl);
        });

        // API Routes
        this.app.get('/api/status', (req, res) => {
            const botStatus = {
                online: this.client.isReady(),
                guilds: this.client.guilds.cache.size,
                users: this.client.users.cache.size,
                uptime: this.client.uptime,
                ping: this.client.ws.ping
            };
            res.json(botStatus);
        });
        
        this.app.get('/api/bot/status', (req, res) => {
            const botStatus = {
                online: this.client.isReady(),
                guilds: this.client.guilds.cache.size,
                users: this.client.users.cache.size,
                uptime: this.client.uptime,
                ping: this.client.ws.ping
            };
            res.json(botStatus);
        });

        this.app.get('/api/music/current', (req, res) => {
            try {
                const players = this.client.lavalink.players;
                const currentPlayers = [];
                
                players.forEach((player, guildId) => {
                    if (player.queue.current) {
                        const guild = this.client.guilds.cache.get(guildId);
                        const current = player.queue.current;
                        currentPlayers.push({
                            guildId: guildId,
                            guildName: guild ? guild.name : 'Unknown Guild',
                            track: {
                                title: current.info.title,
                                author: current.info.author,
                                duration: current.info.duration,
                                uri: current.info.uri,
                                thumbnail: current.info.artworkUrl || 'https://via.placeholder.com/300x300?text=No+Image',
                                requester: current.requester ? {
                                    username: current.requester.username,
                                    displayName: current.requester.displayName || current.requester.username,
                                    id: current.requester.id
                                } : { username: 'Unknown', displayName: 'Unknown', id: null }
                            },
                            position: player.position,
                            volume: player.volume,
                            paused: player.paused,
                            queueSize: player.queue.tracks.length,
                            loop: player.repeatMode,
                            filters: player.filterManager ? Object.keys(player.filterManager.filters || {}) : []
                        });
                    }
                });
                
                res.json(currentPlayers);
            } catch (error) {
                console.error('Error in /api/music/current:', error);
                res.status(500).json({ error: 'Failed to get current music info' });
            }
        });

        this.app.get('/api/guilds', (req, res) => {
            try {
                console.log('🔍 /api/guilds endpoint called');
                const guilds = [];
                this.client.guilds.cache.forEach(guild => {
                    const player = this.client.lavalink.getPlayer(guild.id);
                    guilds.push({
                        id: guild.id,
                        name: guild.name,
                        icon: guild.iconURL() || null,
                        memberCount: guild.memberCount,
                        hasActivePlayer: player && player.queue.current ? true : false,
                        isPlaying: player && player.queue.current && !player.paused ? true : false
                    });
                });

                res.json(guilds);
            } catch (error) {
                console.error('Error in /api/guilds:', error);
                res.status(500).json({ error: 'Failed to get guilds info' });
            }
        });

        this.app.get('/api/music/queue/:guildId', (req, res) => {
            try {
                const { guildId } = req.params;
                const player = this.client.lavalink.getPlayer(guildId);
                
                if (!player) {
                    return res.status(404).json({ error: 'No active player found' });
                }
                
                const queue = player.queue.tracks.map((track, index) => ({
                    position: index + 1,
                    title: track.info.title,
                    author: track.info.author,
                    duration: track.info.duration,
                    uri: track.info.uri,
                    thumbnail: track.info.artworkUrl || 'https://via.placeholder.com/300x300?text=No+Image',
                    requester: track.requester ? {
                        username: track.requester.username,
                        displayName: track.requester.displayName || track.requester.username,
                        id: track.requester.id
                    } : { username: 'Unknown', displayName: 'Unknown', id: null }
                }));
                
                const current = player.queue.current;
                res.json({
                    current: current ? {
                        title: current.info.title,
                        author: current.info.author,
                        duration: current.info.duration,
                        uri: current.info.uri,
                        thumbnail: current.info.artworkUrl || 'https://via.placeholder.com/300x300?text=No+Image',
                        requester: current.requester ? {
                            username: current.requester.username,
                            displayName: current.requester.displayName || current.requester.username,
                            id: current.requester.id
                        } : { username: 'Unknown', displayName: 'Unknown', id: null },
                        position: player.position,
                        paused: player.paused
                    } : null,
                    queue: queue,
                    totalTracks: queue.length,
                    guildId: guildId,
                    guildName: this.client.guilds.cache.get(guildId)?.name || 'Unknown Guild'
                });
            } catch (error) {
                res.status(500).json({ error: 'Failed to get queue info' });
            }
        });

        // Music control endpoints
        this.app.post('/api/music/pause/:guildId', async (req, res) => {
            try {
                const { guildId } = req.params;
                const player = this.client.lavalink.getPlayer(guildId);
                
                if (!player) {
                    return res.status(404).json({ error: 'No active player found' });
                }
                
                let action;
                if (player.paused) {
                    player.resume();
                    action = 'resumed';
                    res.json({ success: true, action: 'resumed' });
                } else {
                    player.pause();
                    action = 'paused';
                    res.json({ success: true, action: 'paused' });
                }
                
                // Update Discord Now Playing message if it exists
                this.updateDiscordNowPlayingMessage(guildId, player);
                
                // Send notification embed for Dashboard action
                await this.sendDashboardNotificationEmbed(guildId, action, player);
                
                // Emit updated music status to all clients
                setTimeout(() => this.emitMusicStatus(), 100);
            } catch (error) {
                console.error('Error toggling pause:', error);
                res.status(500).json({ error: 'Failed to toggle pause' });
            }
        });

        this.app.post('/api/music/skip/:guildId', async (req, res) => {
            try {
                const { guildId } = req.params;
                const player = this.client.lavalink.getPlayer(guildId);
                
                if (!player) {
                    return res.status(404).json({ error: 'No active player found' });
                }
                
                if (player.queue.tracks.length === 0) {
                    return res.status(400).json({ error: 'No tracks in queue to skip' });
                }
                
                // Send notification embed before skipping (to show current track being skipped)
                await this.sendDashboardNotificationEmbed(guildId, 'skipped', player);
                
                player.skip();
                res.json({ success: true, action: 'skipped' });
                
                // Emit updated music status to all clients
                setTimeout(() => this.emitMusicStatus(), 300);
            } catch (error) {
                console.error('Error skipping track:', error);
                res.status(500).json({ error: 'Failed to skip track' });
            }
        });

        this.app.post('/api/music/volume/:guildId', async (req, res) => {
            try {
                const { guildId } = req.params;
                const { volume } = req.body;
                const player = this.client.lavalink.getPlayer(guildId);
                
                if (!player) {
                    return res.status(404).json({ error: 'No active player found' });
                }
                
                if (typeof volume !== 'number' || volume < 0 || volume > 100) {
                    return res.status(400).json({ error: 'Volume must be a number between 0 and 100' });
                }
                
                player.setVolume(volume);
                res.json({ success: true, volume: volume });
                
                // Send notification embed for Dashboard action
                await this.sendDashboardNotificationEmbed(guildId, 'volume', player, { volume });
                
                // Emit updated music status to all clients
                setTimeout(() => this.emitMusicStatus(), 100);
            } catch (error) {
                console.error('Error setting volume:', error);
                res.status(500).json({ error: 'Failed to set volume' });
            }
        });

        // Get music status for all guilds
        this.app.get('/api/music/status', (req, res) => {
            try {
                const players = this.client.lavalink.players;
                const activePlayers = [];
                
                players.forEach((player, guildId) => {
                    if (player.queue.current) {
                        const guild = this.client.guilds.cache.get(guildId);
                        const current = player.queue.current;
                        activePlayers.push({
                            guildId: guildId,
                            guildName: guild ? guild.name : 'Unknown Guild',
                            track: {
                                title: current.info.title,
                                author: current.info.author,
                                duration: current.info.duration,
                                uri: current.info.uri,
                                thumbnail: current.info.artworkUrl || 'https://via.placeholder.com/300x300?text=No+Image',
                                requester: current.requester ? {
                                    username: current.requester.username,
                                    displayName: current.requester.displayName || current.requester.username,
                                    id: current.requester.id
                                } : { username: 'Unknown', displayName: 'Unknown', id: null }
                            },
                            position: player.position,
                            volume: player.volume,
                            paused: player.paused,
                            queueSize: player.queue.tracks.length
                        });
                    }
                });
                
                res.json(activePlayers);
            } catch (error) {
                console.error('Error getting music status:', error);
                res.status(500).json({ error: 'Failed to get music status' });
            }
        });
        
        // Get music status for a specific guild (for timeline updates)
        this.app.get('/api/music/status/:guildId', (req, res) => {
            try {
                const { guildId } = req.params;
                const player = this.client.lavalink.getPlayer(guildId);
                
                if (!player || !player.queue.current) {
                    return res.status(404).json({ error: 'No active player or track found' });
                }
                
                const current = player.queue.current;
                const playerData = {
                    guildId: guildId,
                    track: {
                        title: current.info.title,
                        author: current.info.author,
                        duration: current.info.duration,
                        uri: current.info.uri,
                        thumbnail: current.info.artworkUrl || 'https://via.placeholder.com/300x300?text=No+Image',
                        requester: current.requester ? {
                            username: current.requester.username,
                            displayName: current.requester.displayName || current.requester.username,
                            id: current.requester.id
                        } : { username: 'Unknown', displayName: 'Unknown', id: null }
                    },
                    position: player.position,
                    volume: player.volume,
                    paused: player.paused,
                    queueSize: player.queue.tracks.length
                };
                
                res.json(playerData);
            } catch (error) {
                console.error('Error getting music status:', error);
                res.status(500).json({ error: 'Failed to get music status' });
            }
        });

        // Test route to verify POST requests work
        this.app.post('/api/test', (req, res) => {
            console.log('🧪 TEST ENDPOINT HIT - Request received');
            res.json({ message: 'Test endpoint working', body: req.body });
        });

        // Simple test search endpoint
        this.app.post('/api/test-search', (req, res) => {
            console.log('🔍 TEST SEARCH ENDPOINT HIT - Request received');
            console.log('🔍 Request body:', req.body);
            res.json({ message: 'Test search endpoint working', body: req.body });
        });

        // Search for music
        this.app.post('/api/music/search', async (req, res) => {
            console.log('🔍 SEARCH ENDPOINT HIT - Request received');
            try {
                console.log('🔍 Search request received:', req.body);
                const { query } = req.body;
                
                if (!query || typeof query !== 'string') {
                    console.log('❌ Invalid query:', query);
                    return res.status(400).json({ error: 'Query is required' });
                }
                
                console.log('🔍 Searching for:', query);
                console.log('🔍 Lavalink available:', !!this.client.lavalink);
                console.log('🔍 Lavalink nodeManager nodes:', this.client.lavalink?.nodeManager?.nodes?.size || 0);
                
                // Determine search platform based on URL
                let searchPlatform = 'ytsearch';
                if (query.includes('spotify.com')) {
                    searchPlatform = 'spsearch';
                } else if (query.includes('soundcloud.com')) {
                    searchPlatform = 'scsearch';
                } else if (query.includes('youtube.com') || query.includes('youtu.be')) {
                    searchPlatform = 'ytmsearch';
                }
                
                // Create search query
                const searchQuery = query.startsWith('http') ? query : `${searchPlatform}:${query}`;
                console.log('🔍 Search query:', searchQuery);
                
                // Use the first available node to search
                if (!this.client.lavalink || !this.client.lavalink.nodeManager || !this.client.lavalink.nodeManager.nodes) {
                    console.log('❌ Lavalink not available or nodeManager not initialized');
                    return res.status(503).json({ error: 'Music service unavailable' });
                }
                
                const nodes = Array.from(this.client.lavalink.nodeManager.nodes.values());
                if (nodes.length === 0) {
                    console.log('❌ No Lavalink nodes available in nodeManager');
                    return res.status(503).json({ error: 'Music service unavailable' });
                }
                
                // Check if any nodes are connected
                const connectedNodes = nodes.filter(node => node.connected);
                if (connectedNodes.length === 0) {
                    console.log('❌ No connected Lavalink nodes available');
                    return res.status(503).json({ error: 'Music service unavailable - no connected nodes' });
                }
                
                const node = connectedNodes[0];
                console.log('🔍 Using connected node:', node.id, 'connected:', node.connected);
                
                // Fallback: Direct HTTP request to Lavalink server if WebSocket connection fails
                let searchResult;
                try {
                    // Try using the Lavalink manager's search method first
                    searchResult = await this.client.lavalink.search({
                        query: searchQuery,
                        source: searchPlatform
                    }, null, false);
                    console.log('🔍 Search result from Lavalink manager:', searchResult);
                } catch (error) {
                    console.log('🔄 Lavalink manager search failed, trying direct HTTP request:', error.message);
                    
                    // Direct HTTP request to Lavalink server
                    const axios = require('axios');
                    try {
                        const response = await axios.get(`http://${process.env.LAVALINK_HOST}:${process.env.LAVALINK_PORT}/v4/loadtracks`, {
                            params: {
                                identifier: searchQuery
                            },
                            headers: {
                                'Authorization': process.env.LAVALINK_PASSWORD
                            },
                            timeout: 10000
                        });
                        
                        searchResult = {
                            tracks: response.data.data || [],
                            loadType: response.data.loadType
                        };
                        console.log('🔍 Search result from direct HTTP:', searchResult);
                    } catch (httpError) {
                        console.error('❌ Direct HTTP search also failed:', httpError.message);
                        return res.status(503).json({ error: 'Music service unavailable - search failed' });
                    }
                }
                
                if (!searchResult || !searchResult.tracks || searchResult.tracks.length === 0) {
                    console.log('🔍 No results found');
                    return res.json({ results: [], count: 0 });
                }
                
                // Format search results - handle both array and single track results
                let tracks = searchResult.tracks;
                if (!Array.isArray(tracks)) {
                    // If it's a single track (loadType: 'track'), wrap it in an array
                    tracks = [tracks];
                }
                
                const results = tracks.slice(0, 10).map(track => {
                    const duration = track.info.duration || track.info.length || 0;
                    console.log(`🔍 Track: ${track.info.title} - Duration: ${duration}ms (from duration: ${track.info.duration}, length: ${track.info.length})`);
                    return {
                        title: track.info.title,
                        artist: track.info.author,
                        duration: duration,
                        uri: track.info.uri,
                        thumbnail: track.info.artworkUrl || 'https://via.placeholder.com/300x300?text=No+Image',
                        encoded: track.encoded
                    };
                });
                
                console.log('🔍 Returning', results.length, 'results');
                res.json({ results, count: results.length });
            } catch (error) {
                console.error('❌ Error searching for music:', error);
                console.error('❌ Error stack:', error.stack);
                res.status(500).json({ error: 'Failed to search for music' });
            }
        });
        
        // Play/Add track to queue
        this.app.post('/api/music/play', async (req, res) => {
            try {
                const { track, user, guildId } = req.body;
                
                if (!track || !track.encoded) {
                    return res.status(400).json({ error: 'Track data is required' });
                }
                
                if (!guildId) {
                    return res.status(400).json({ error: 'Guild ID is required' });
                }
                
                // Log the request with user information
                const userInfo = user ? `${user.username}#${user.discriminator} (${user.id})` : 'Unknown User';
                console.log(`🎵 Track add request from ${userInfo}: ${track.info?.title} in guild ${guildId}`);
                
                // Get or create player for the specified guild
                let player = this.client.lavalink.getPlayer(guildId);
                
                if (!player) {
                    // Find a voice channel to join in the guild
                    const guild = this.client.guilds.cache.get(guildId);
                    if (!guild) {
                        return res.status(404).json({ error: 'Guild not found' });
                    }
                    
                    let voiceChannel = null;
                    
                    // First, try to find the user's current voice channel if user info is provided
                    if (user && user.id) {
                        const member = guild.members.cache.get(user.id);
                        if (member && member.voice && member.voice.channel) {
                            const userVoiceChannel = member.voice.channel;
                            // Check if bot has permissions to join this channel
                            if (userVoiceChannel.permissionsFor(guild.members.me).has(['Connect', 'Speak'])) {
                                voiceChannel = userVoiceChannel;
                                console.log(`🎯 User ${userInfo} is in voice channel ${voiceChannel.name}, joining there`);
                            } else {
                                console.log(`⚠️ Bot lacks permissions to join user's voice channel ${userVoiceChannel.name}`);
                            }
                        }
                    }
                    
                    // If user is not in a voice channel or bot can't join, find the first available voice channel
                    if (!voiceChannel) {
                        voiceChannel = guild.channels.cache.find(channel => 
                            channel.type === 2 && // Voice channel
                            channel.permissionsFor(guild.members.me).has(['Connect', 'Speak'])
                        );
                        
                        if (voiceChannel) {
                            console.log(`🔍 User not in voice channel, using available channel ${voiceChannel.name}`);
                        }
                    }
                    
                    if (!voiceChannel) {
                        return res.status(400).json({ error: 'No available voice channel found. Please join a voice channel first.' });
                    }
                    
                    // Get configured text channel ID or auto-detect music channel
                    const guildSettings = this.getGuildSettings(guildId);
                    let textChannelId = null;
                    
                    if (guildSettings && guildSettings.nowPlayingChannelId) {
                        // Use configured channel if available
                        textChannelId = guildSettings.nowPlayingChannelId;
                        console.log(`🎵 Using configured text channel: ${textChannelId}`);
                    } else {
                        // Auto-detect music-related text channel
                        const musicKeywords = ['music', '音乐', 'song', '歌曲', 'audio', 'sound', 'bot'];
                        const textChannels = guild.channels.cache.filter(channel => 
                            channel.type === 0 && // Text channel
                            channel.permissionsFor(guild.members.me).has(['SendMessages', 'EmbedLinks'])
                        );
                        
                        let musicChannel = null;
                        for (const [channelId, channel] of textChannels) {
                            const channelNameLower = channel.name.toLowerCase();
                            for (const keyword of musicKeywords) {
                                if (channelNameLower.includes(keyword)) {
                                    musicChannel = channel;
                                    break;
                                }
                            }
                            if (musicChannel) break;
                        }
                        
                        if (musicChannel) {
                            textChannelId = musicChannel.id;
                            console.log(`🎯 Auto-detected music channel: ${musicChannel.name} (${textChannelId})`);
                        } else {
                            // No music channel found, require user to select one
                            return res.status(400).json({ 
                                error: 'No music-related channel found. Please select a channel in Settings before using Dashboard features.',
                                requireChannelSelection: true
                            });
                        }
                    }
                    
                    // Create player
                    player = this.client.lavalink.createPlayer({
                        guildId: guildId,
                        voiceChannelId: voiceChannel.id,
                        textChannelId: textChannelId,
                        selfDeafen: true
                    });
                    
                    try {
                        await player.connect();
                        console.log(`✅ Player connected to voice channel ${voiceChannel.name} in guild ${guildId}`);
                    } catch (connectError) {
                        console.error(`❌ Failed to connect player to voice channel:`, connectError);
                        throw new Error(`Failed to connect to voice channel: ${connectError.message}`);
                    }
                }
                
                // Create track object with user information
                const trackToAdd = {
                    encoded: track.encoded,
                    info: track.info,
                    requester: user ? {
                        id: user.id,
                        username: user.username,
                        discriminator: user.discriminator,
                        displayName: user.username,
                        avatar: user.avatar
                    } : {
                        id: 'web-dashboard',
                        username: 'Web Dashboard',
                        discriminator: '0000',
                        displayName: 'Web Dashboard',
                        avatar: null
                    }
                };
                
                // Add track to queue
                player.queue.add(trackToAdd);
                
                console.log(`✅ Track "${track.info?.title}" added to queue by ${userInfo}`);
                
                // Send notification embed for track added to queue first
                await this.sendTrackAddedNotificationEmbed(guildId, trackToAdd, player);
                
                // Start playing if not already playing
                if (!player.playing && !player.paused) {
                    try {
                        console.log(`🔍 DEBUG: About to call player.play() for guild ${guildId}`);
                        console.log(`🔍 DEBUG: Player state before play - playing: ${player.playing}, paused: ${player.paused}, connected: ${player.connected}`);
                        
                        // Ensure player is connected before playing
                        if (!player.connected) {
                            console.log(`🔗 DEBUG: Player not connected, attempting to connect...`);
                            await player.connect();
                            console.log(`🔗 DEBUG: Player connection attempt completed, connected: ${player.connected}`);
                        }
                        
                        await player.play();
                        console.log(`▶️ Started playing track in guild ${guildId}`);
                        console.log(`🔍 DEBUG: Player state after play - playing: ${player.playing}, paused: ${player.paused}`);
                        
                        // Now Playing embed will be sent by trackStart event handler
                    } catch (playError) {
                        console.error(`❌ Failed to start playback:`, playError);
                        // Don't throw here as the track was still added to queue
                        console.log(`⚠️ Track added to queue but playback failed - will try again on next track`);
                    }
                }
                
                res.json({ 
                    success: true, 
                    message: 'Track added to queue',
                    queuePosition: player.queue.tracks.length,
                    addedBy: userInfo
                });
                
                // Emit updated music status to all clients
                setTimeout(() => this.emitMusicStatus(), 100);
                
            } catch (error) {
                console.error('❌ Error adding track to queue:', error);
                res.status(500).json({ error: 'Failed to add track to queue' });
            }
        });

        // Add song to queue
        this.app.post('/api/music/add/:guildId', async (req, res) => {
            try {
                const { guildId } = req.params;
                const { encoded, title, artist, duration, uri, thumbnail } = req.body;
                
                if (!encoded) {
                    return res.status(400).json({ error: 'Track data is required' });
                }
                
                // Get or create player
                let player = this.client.lavalink.getPlayer(guildId);
                
                if (!player) {
                    // Find a voice channel to join (this is a simplified approach)
                    const guild = this.client.guilds.cache.get(guildId);
                    if (!guild) {
                        return res.status(404).json({ error: 'Guild not found' });
                    }
                    
                    // For now, we'll require that a player already exists
                    // In a full implementation, you'd need to handle voice channel joining
                    return res.status(400).json({ error: 'Bot must be in a voice channel first. Use Discord commands to start playing music.' });
                }
                
                // Create track object
                const track = {
                    encoded: encoded,
                    info: {
                        title: title,
                        author: artist,
                        duration: duration,
                        uri: uri,
                        artworkUrl: thumbnail
                    }
                };
                
                // Add track to queue
                player.queue.add(track);
                
                console.log(`🔍 DEBUG: Adding track from dashboard for guild ${guildId}`);
                console.log(`🔍 DEBUG: Current guild settings:`, this.getGuildSettings(guildId));
                
                // Send notification embed for track added to queue first
                await this.sendTrackAddedNotificationEmbed(guildId, track, player);
                
                // If nothing is playing, start playing
                if (!player.playing && !player.paused) {
                    try {
                        console.log(`🔍 DEBUG: About to call player.play() for guild ${guildId} (dashboard endpoint)`);
                        console.log(`🔍 DEBUG: Player state before play - playing: ${player.playing}, paused: ${player.paused}, connected: ${player.connected}`);
                        
                        // Ensure player is connected before playing
                        if (!player.connected) {
                            console.log(`🔗 DEBUG: Player not connected, attempting to connect...`);
                            await player.connect();
                            console.log(`🔗 DEBUG: Player connection attempt completed, connected: ${player.connected}`);
                        }
                        
                        await player.play();
                        console.log(`▶️ Started playing track in guild ${guildId}`);
                        console.log(`🔍 DEBUG: Player state after play - playing: ${player.playing}, paused: ${player.paused}`);
                        
                        // Ensure duration is preserved after Lavalink processing
                        if (player.queue.current && duration) {
                            player.queue.current.info.duration = duration;
                            console.log(`🔧 Manually set duration to ${duration}ms for current track`);
                        }
                        
                        // Now Playing embed will be sent by trackStart event handler
                    } catch (playError) {
                        console.error(`❌ Failed to start playback:`, playError);
                        // Don't throw here as the track was still added to queue
                        console.log(`⚠️ Track added to queue but playback failed - will try again on next track`);
                    }
                } else {
                    // If already playing, ensure duration is set for the added track
                    const addedTrack = player.queue.tracks[player.queue.tracks.length - 1];
                    if (addedTrack && duration) {
                        addedTrack.info.duration = duration;
                        console.log(`🔧 Manually set duration to ${duration}ms for queued track`);
                    }
                }
                
                res.json({ 
                    success: true, 
                    message: 'Song added to queue',
                    track: {
                        title: title,
                        artist: artist,
                        duration: duration
                    },
                    queuePosition: player.queue.tracks.length
                });
                
                // Emit updated music status to all clients
                setTimeout(() => this.emitMusicStatus(), 100);
            } catch (error) {
                console.error('Error adding song to queue:', error);
                res.status(500).json({ error: 'Failed to add song to queue' });
            }
        });

        // Error handling middleware for body parsing (after routes)
        this.app.use((error, req, res, next) => {
            if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
                console.error('❌ Body parsing error:', error.message);
                return res.status(400).json({ error: 'Invalid JSON in request body' });
            }
            next(error);
        });
        
        // Discord OAuth2 Authentication Routes
        this.app.get('/auth/discord', (req, res) => {
            // Store the redirect destination in session state
            const redirectTo = req.query.redirect || 'servers';
            const state = Buffer.from(JSON.stringify({ redirectTo })).toString('base64');
            const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&response_type=code&scope=identify%20guilds&state=${state}`;
            res.redirect(discordAuthUrl);
        });

        this.app.get('/auth/discord/callback', async (req, res) => {
            const { code, state } = req.query;
            
            if (!code) {
                return res.status(400).json({ error: 'No authorization code provided' });
            }
            
            // Parse state to determine redirect destination
            let redirectTo = 'servers';
            if (state) {
                try {
                    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
                    redirectTo = stateData.redirectTo || 'servers';
                } catch (error) {
                    console.warn('Failed to parse OAuth state:', error);
                }
            }

            try {
                console.log('🔍 OAuth callback - Starting token exchange...');
                console.log('🔍 OAuth callback - Code received:', code ? 'Yes' : 'No');
                console.log('🔍 OAuth callback - CLIENT_ID:', process.env.CLIENT_ID ? 'Set' : 'Missing');
                console.log('🔍 OAuth callback - CLIENT_SECRET:', process.env.CLIENT_SECRET ? 'Set' : 'Missing');
                console.log('🔍 OAuth callback - REDIRECT_URI:', process.env.REDIRECT_URI);
                
                // Exchange code for access token
                const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        client_id: process.env.CLIENT_ID,
                        client_secret: process.env.CLIENT_SECRET,
                        grant_type: 'authorization_code',
                        code: code,
                        redirect_uri: process.env.REDIRECT_URI
                    })
                });

                console.log('🔍 OAuth callback - Token response status:', tokenResponse.status);
                const tokenData = await tokenResponse.json();
                console.log('🔍 OAuth callback - Token response data:', tokenData);
                
                if (!tokenData.access_token) {
                    console.error('❌ OAuth callback - No access token in response:', tokenData);
                    return res.status(400).json({ error: 'Failed to get access token', details: tokenData });
                }

                // Get user data
                const userResponse = await fetch('https://discord.com/api/users/@me', {
                    headers: {
                        'Authorization': `Bearer ${tokenData.access_token}`
                    }
                });

                const userData = await userResponse.json();

                // Get user guilds
                const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
                    headers: {
                        'Authorization': `Bearer ${tokenData.access_token}`
                    }
                });

                const guildsData = await guildsResponse.json();

                // Store user session (in production, use proper session management)
                const userSession = {
                    id: userData.id,
                    username: userData.username,
                    discriminator: userData.discriminator,
                    avatar: userData.avatar,
                    guilds: guildsData,
                    access_token: tokenData.access_token
                };

                // Store session temporarily (in production, use Redis or proper session store)
                this.userSessions = this.userSessions || new Map();
                const sessionId = `session_${userData.id}_${Date.now()}`;
                this.userSessions.set(sessionId, userSession);

                // Redirect based on the original request
                if (redirectTo === 'home') {
                    res.redirect(`/?session=${sessionId}`);
                } else {
                    res.redirect(`/servers.html?session=${sessionId}`);
                }
                
                // Clean up old sessions after 1 hour
                setTimeout(() => {
                    this.userSessions.delete(sessionId);
                }, 3600000);
            } catch (error) {
                console.error('OAuth callback error:', error);
                res.status(500).json({ error: 'Authentication failed' });
            }
        });

        // Get session data endpoint
        this.app.get('/api/session/:sessionId', (req, res) => {
            try {
                const { sessionId } = req.params;
                const userSessions = this.userSessions || new Map();
                const sessionData = userSessions.get(sessionId);
                
                if (!sessionData) {
                    return res.status(404).json({ error: 'Session not found or expired' });
                }
                
                res.json(sessionData);
            } catch (error) {
                console.error('Session retrieval error:', error);
                res.status(500).json({ error: 'Failed to retrieve session' });
            }
        });

        this.app.get('/api/user/guilds/:userId', async (req, res) => {
            try {
                const { userId } = req.params;
                const { access_token } = req.query;

                if (!access_token) {
                    return res.status(401).json({ error: 'Access token required' });
                }

                // Get user guilds
                const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
                    headers: {
                        'Authorization': `Bearer ${access_token}`
                    }
                });

                const guildsData = await guildsResponse.json();
                
                // Check which guilds already have the bot
                const botGuilds = this.client.guilds.cache.map(guild => guild.id);
                
                // Process all guilds with permission and bot status
                const guildsWithStatus = guildsData.map(guild => {
                    const permissions = parseInt(guild.permissions);
                    const MANAGE_GUILD = 0x20; // MANAGE_GUILD permission
                    const ADMINISTRATOR = 0x8; // ADMINISTRATOR permission
                    
                    const hasManageGuild = (permissions & MANAGE_GUILD) === MANAGE_GUILD;
                    const hasAdministrator = (permissions & ADMINISTRATOR) === ADMINISTRATOR;
                    const hasBotAlready = botGuilds.includes(guild.id);
                    
                    return {
                        ...guild,
                        hasBotAlready,
                        canManageBot: hasManageGuild || hasAdministrator,
                        canAccessSettings: hasManageGuild || hasAdministrator,
                        permissionLevel: hasAdministrator ? 'administrator' : hasManageGuild ? 'manage_guild' : 'member',
                        inviteUrl: `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot%20applications.commands&guild_id=${guild.id}`
                    };
                });

                // Sort guilds: bot already added first, then by permission level
                const sortedGuilds = guildsWithStatus.sort((a, b) => {
                    if (a.hasBotAlready && !b.hasBotAlready) return -1;
                    if (!a.hasBotAlready && b.hasBotAlready) return 1;
                    if (a.canManageBot && !b.canManageBot) return -1;
                    if (!a.canManageBot && b.canManageBot) return 1;
                    return 0;
                });

                res.json(sortedGuilds);
            } catch (error) {
                console.error('Error fetching user guilds:', error);
                res.status(500).json({ error: 'Failed to fetch guilds' });
            }
        });

        // Get available channels for a guild
        this.app.get('/api/guilds/:guildId/channels', (req, res) => {
            try {
                const { guildId } = req.params;
                const guild = this.client.guilds.cache.get(guildId);
                
                if (!guild) {
                    return res.status(404).json({ error: 'Guild not found' });
                }
                
                // Get text channels where bot can send messages
                const textChannels = guild.channels.cache
                    .filter(channel => 
                        channel.type === 0 && // Text channel
                        channel.permissionsFor(this.client.user).has(['SendMessages', 'EmbedLinks'])
                    )
                    .map(channel => ({
                        id: channel.id,
                        name: channel.name,
                        position: channel.position
                    }))
                    .sort((a, b) => a.position - b.position);
                
                res.json(textChannels);
            } catch (error) {
                console.error('Error fetching guild channels:', error);
                res.status(500).json({ error: 'Failed to fetch channels' });
            }
        });

        // Save channel settings for a guild
        this.app.post('/api/guilds/:guildId/settings', async (req, res) => {
            try {
                const { guildId } = req.params;
                const { nowPlayingChannelId } = req.body;
                
                if (!guildId) {
                    return res.status(400).json({ error: 'Guild ID is required' });
                }
                
                // Initialize guild settings storage if not exists
                if (!this.guildSettings) {
                    this.guildSettings = new Map();
                }
                
                // Validate channel exists and bot has permissions
                if (nowPlayingChannelId) {
                    const guild = this.client.guilds.cache.get(guildId);
                    if (!guild) {
                        return res.status(404).json({ error: 'Guild not found' });
                    }
                    
                    const channel = guild.channels.cache.get(nowPlayingChannelId);
                    if (!channel) {
                        return res.status(404).json({ error: 'Channel not found' });
                    }
                    
                    if (!channel.permissionsFor(this.client.user).has(['SendMessages', 'EmbedLinks'])) {
                        return res.status(403).json({ error: 'Bot does not have permission to send messages in this channel' });
                    }
                }
                
                // Save settings
                const currentSettings = this.guildSettings.get(guildId) || {};
                const updatedSettings = {
                    ...currentSettings,
                    nowPlayingChannelId: nowPlayingChannelId || null
                };

                this.guildSettings.set(guildId, updatedSettings);
                await this.saveGuildSettings(guildId, updatedSettings);

                // Send confirmation embed to the configured channel
                if (nowPlayingChannelId) {
                    await this.sendChannelSettingsConfirmationEmbed(guildId, nowPlayingChannelId);
                }

                res.json({ 
                    success: true, 
                    settings: updatedSettings 
                });
            } catch (error) {
                console.error('Error saving guild settings:', error);
                res.status(500).json({ error: 'Failed to save settings' });
            }
        });

        // Get user's current voice channel in a guild
        this.app.get('/api/guilds/:guildId/user/:userId/voice-channel', (req, res) => {
            try {
                const { guildId, userId } = req.params;
                const guild = this.client.guilds.cache.get(guildId);
                
                if (!guild) {
                    return res.status(404).json({ error: 'Guild not found' });
                }
                
                // Get the member from the guild
                const member = guild.members.cache.get(userId);
                if (!member) {
                    return res.status(404).json({ error: 'User not found in this guild' });
                }
                
                // Check if user is in a voice channel
                const voiceState = member.voice;
                if (!voiceState || !voiceState.channel) {
                    return res.json({ 
                        inVoiceChannel: false, 
                        voiceChannel: null 
                    });
                }
                
                // Return voice channel information
                res.json({
                    inVoiceChannel: true,
                    voiceChannel: {
                        id: voiceState.channel.id,
                        name: voiceState.channel.name,
                        type: voiceState.channel.type,
                        userLimit: voiceState.channel.userLimit,
                        memberCount: voiceState.channel.members.size
                    }
                });
            } catch (error) {
                console.error('Error getting user voice channel:', error);
                res.status(500).json({ error: 'Failed to get user voice channel' });
            }
        });

        // Get channel settings for a guild
        this.app.get('/api/guilds/:guildId/settings', (req, res) => {
            try {
                const { guildId } = req.params;
                
                if (!this.guildSettings) {
                    this.guildSettings = new Map();
                }
                
                const settings = this.guildSettings.get(guildId) || {
                    nowPlayingChannelId: null
                };
                
                res.json(settings);
            } catch (error) {
                console.error('Error fetching guild settings:', error);
                res.status(500).json({ error: 'Failed to fetch settings' });
            }
        });

        // Add static file serving after all API routes to avoid conflicts
        this.app.use(express.static(path.join(__dirname, 'public')));
        
        // Debug: Log all registered routes
        console.log('🔍 Registered routes:');
        this.app._router.stack.forEach((middleware) => {
            if (middleware.route) {
                console.log(`  ${Object.keys(middleware.route.methods).join(', ').toUpperCase()} ${middleware.route.path}`);
            }
        });
    }

    setupSocketEvents() {
        this.io.on('connection', (socket) => {
            console.log('🌐 Web client connected:', socket.id);
            
            // Debug client state
            console.log('🔍 Client ready state:', this.client.isReady());
            console.log('🔍 Client guilds count:', this.client.guilds.cache.size);
            console.log('🔍 Lavalink players count:', this.client.lavalink ? this.client.lavalink.players.size : 'Lavalink not available');
            
            // Send initial bot status
            this.emitBotStatus();
            this.emitMusicStatus();
            
            socket.on('disconnect', () => {
                console.log('🌐 Web client disconnected:', socket.id);
            });
            
            // Handle music status requests
            socket.on('requestMusicStatus', () => {
                console.log('🔄 Client requested music status update');
                this.emitMusicStatus();
            });
            
            // Handle settings updates for real-time synchronization
            socket.on('settingsUpdate', (data) => {
                console.log('📡 Broadcasting settings update for guild:', data.guildId);
                // Broadcast to all other clients except the sender
                socket.broadcast.emit('settingsUpdated', {
                    guildId: data.guildId,
                    settings: data.settings
                });
            });
        });
    }

    emitBotStatus() {
        const botStatus = {
            online: this.client.isReady(),
            guilds: this.client.guilds.cache.size,
            users: this.client.users.cache.size,
            uptime: this.client.uptime,
            ping: this.client.ws.ping
        };
        console.log('🤖 Emitting bot status:', botStatus);
        this.io.emit('botStatus', botStatus);
    }

    emitMusicStatus() {
        try {
            const players = this.client.lavalink.players;
            const currentPlayers = [];
            
            console.log(`🌐 Emitting music status for ${players.size} players`);
            
            players.forEach((player, guildId) => {
                if (player.queue.current) {
                    const guild = this.client.guilds.cache.get(guildId);
                    const playerData = {
                        guildId: guildId,
                        guildName: guild ? guild.name : 'Unknown Guild',
                        track: {
                            title: player.queue.current.info.title,
                            author: player.queue.current.info.author,
                            duration: player.queue.current.info.duration,
                            uri: player.queue.current.info.uri,
                            thumbnail: player.queue.current.info.artworkUrl || 'https://via.placeholder.com/300x300?text=No+Image',
                            requester: player.queue.current.requester ? {
                                username: player.queue.current.requester.username,
                                displayName: player.queue.current.requester.displayName || player.queue.current.requester.username,
                                id: player.queue.current.requester.id
                            } : { username: 'Unknown', displayName: 'Unknown', id: null }
                        },
                        position: player.position,
                        volume: player.volume,
                        paused: player.paused,
                        queueSize: player.queue.tracks.length
                    };
                    currentPlayers.push(playerData);
                    console.log(`🎵 Player found in guild ${guildId}: ${player.queue.current.info.title}`);
                    console.log(`⚠️ DURATION DEBUG: ${player.queue.current.info.duration} (type: ${typeof player.queue.current.info.duration})`);
                    console.log(`📍 Player position: ${player.position}ms (${Math.floor(player.position / 1000)}s)`);
                }
            });
            
            console.log(`🌐 Sending music status with ${currentPlayers.length} active players`);
            this.io.emit('musicStatus', currentPlayers);
        } catch (error) {
            console.error('Error emitting music status:', error);
        }
    }

    // Initialize database connection and load settings
    async initializeDatabase() {
        try {
            // Test database connection
            const connected = await testConnection();
            if (!connected) {
                console.warn('⚠️ Database connection failed, falling back to JSON file storage');
                await this.loadSettingsFromFile();
                return;
            }
            
            // Initialize database tables
            await initializeDatabase();
            console.log('✅ Database initialization successful');
            
            // Load settings from database
            await this.loadSettingsFromDatabase();
            
        } catch (error) {
            console.error('❌ Database initialization failed:', error.message);
            console.warn('⚠️ Falling back to JSON file storage');
            await this.loadSettingsFromFile();
        }
    }
    
    // Load settings from database
    async loadSettingsFromDatabase() {
        try {
            const allSettings = await GuildSettings.findAll();
            this.guildSettings = new Map();
            
            allSettings.forEach(setting => {
                const guildSettings = {
                    nowPlayingChannelId: setting.now_playing_channel_id,
                    defaultVolume: setting.default_volume,
                    maxQueueSize: setting.max_queue_size,
                    autoLeave: setting.auto_leave,
                    autoLeaveTimeout: setting.auto_leave_timeout,
                    djRoleId: setting.dj_role_id,
                    prefix: setting.prefix
                };
                
                // 如果有额外的JSON设置，合并它们
                if (setting.settings_json) {
                    try {
                        const extraSettings = JSON.parse(setting.settings_json);
                        Object.assign(guildSettings, extraSettings);
                    } catch (error) {
                        console.warn(`⚠️ 解析服务器 ${setting.guild_id} 的额外设置失败:`, error.message);
                    }
                }
                
                this.guildSettings.set(setting.guild_id, guildSettings);
            });
            
            console.log(`✅ Loaded ${allSettings.length} server settings from database`);
            this.usingDatabase = true;
            
        } catch (error) {
            console.error('❌ Failed to load settings from database:', error.message);
            throw error;
        }
    }
    
    // Fallback: Load settings from JSON file
    async loadSettingsFromFile() {
        try {
            if (require('fs').existsSync(this.settingsFile)) {
                const data = await require('fs').promises.readFile(this.settingsFile, 'utf8');
                const settings = JSON.parse(data);
                this.guildSettings = new Map(Object.entries(settings));
                console.log('✅ Loaded server settings from JSON file');
            } else {
                this.guildSettings = new Map();
                console.log('ℹ️ No existing settings file found, starting with empty settings');
            }
            this.usingDatabase = false;
        } catch (error) {
            console.error('❌ Failed to load settings from file:', error);
            this.guildSettings = new Map();
            this.usingDatabase = false;
        }
    }

    // Save settings to database or file
    async saveSettings() {
        if (this.usingDatabase) {
            await this.saveSettingsToDatabase();
        } else {
            await this.saveSettingsToFile();
        }
    }
    
    // Save settings to database
    async saveSettingsToDatabase() {
        // 这个方法在保存单个服务器设置时会被调用
        // 实际的保存逻辑在 saveGuildSettings 方法中
        console.log('✅ 设置已保存到数据库');
    }
    
    // Save settings to JSON file (fallback)
    async saveSettingsToFile() {
        try {
            const settings = Object.fromEntries(this.guildSettings);
            await require('fs').promises.writeFile(this.settingsFile, JSON.stringify(settings, null, 2));
            console.log('✅ 设置已保存到JSON文件');
        } catch (error) {
            console.error('❌ 保存设置到文件失败:', error);
        }
    }
    
    // Save individual guild settings
    async saveGuildSettings(guildId, settings) {
        try {
            if (this.usingDatabase) {
                // 使用数据库保存
                const [guildSetting, created] = await GuildSettings.findOrCreate({
                    where: { guild_id: guildId },
                    defaults: {
                        guild_id: guildId,
                        now_playing_channel_id: settings.nowPlayingChannelId || null,
                        default_volume: settings.defaultVolume || 50,
                        max_queue_size: settings.maxQueueSize || 100,
                        auto_leave: settings.autoLeave !== undefined ? settings.autoLeave : true,
                        auto_leave_timeout: settings.autoLeaveTimeout || 300,
                        dj_role_id: settings.djRoleId || null,
                        prefix: settings.prefix || '!',
                        settings_json: JSON.stringify(settings)
                    }
                });
                
                if (!created) {
                    // 更新现有记录
                    await guildSetting.update({
                        now_playing_channel_id: settings.nowPlayingChannelId || null,
                        default_volume: settings.defaultVolume || guildSetting.default_volume,
                        max_queue_size: settings.maxQueueSize || guildSetting.max_queue_size,
                        auto_leave: settings.autoLeave !== undefined ? settings.autoLeave : guildSetting.auto_leave,
                        auto_leave_timeout: settings.autoLeaveTimeout || guildSetting.auto_leave_timeout,
                        dj_role_id: settings.djRoleId || guildSetting.dj_role_id,
                        prefix: settings.prefix || guildSetting.prefix,
                        settings_json: JSON.stringify(settings)
                    });
                }
                
                console.log(`✅ 服务器 ${guildId} 设置已保存到数据库`);
            } else {
                // 使用JSON文件保存（回退方案）
                await this.saveSettingsToFile();
            }
        } catch (error) {
            console.error(`❌ 保存服务器 ${guildId} 设置失败:`, error.message);
            // 如果数据库保存失败，尝试保存到文件
            if (this.usingDatabase) {
                console.warn('⚠️ 数据库保存失败，尝试保存到JSON文件');
                await this.saveSettingsToFile();
            }
            throw error;
        }
    }

    // Get guild settings (for use by bot logic)
    async getGuildSettings(guildId) {
        if (!this.guildSettings) {
            this.guildSettings = new Map();
        }
        
        try {
            if (this.usingDatabase) {
                // 从数据库获取设置
                const guildSetting = await GuildSettings.findOne({
                    where: { guild_id: guildId }
                });
                
                if (guildSetting) {
                    // 将数据库字段转换为应用程序格式
                    const settings = {
                        nowPlayingChannelId: guildSetting.now_playing_channel_id,
                        addSongChannelId: guildSetting.add_song_channel_id,
                        defaultVolume: guildSetting.default_volume,
                        maxQueueSize: guildSetting.max_queue_size,
                        autoLeave: guildSetting.auto_leave,
                        autoLeaveTimeout: guildSetting.auto_leave_timeout,
                        djRoleId: guildSetting.dj_role_id,
                        prefix: guildSetting.prefix
                    };
                    
                    // 如果有额外的JSON设置，合并它们
                    if (guildSetting.settings_json) {
                        try {
                            const jsonSettings = JSON.parse(guildSetting.settings_json);
                            Object.assign(settings, jsonSettings);
                        } catch (error) {
                            console.warn(`⚠️ 解析服务器 ${guildId} 的JSON设置失败:`, error.message);
                        }
                    }
                    
                    // 更新内存缓存
                    this.guildSettings.set(guildId, settings);
                    return settings;
                } else {
                    // 数据库中没有找到设置，返回默认设置
                    const defaultSettings = {
                        nowPlayingChannelId: null,
                        addSongChannelId: null
                    };
                    this.guildSettings.set(guildId, defaultSettings);
                    return defaultSettings;
                }
            } else {
                // 从内存缓存获取设置（JSON文件模式）
                return this.guildSettings.get(guildId) || {
                    nowPlayingChannelId: null,
                    addSongChannelId: null
                };
            }
        } catch (error) {
            console.error(`❌ 获取服务器 ${guildId} 设置失败:`, error.message);
            // 如果数据库查询失败，从内存缓存返回
            return this.guildSettings.get(guildId) || {
                nowPlayingChannelId: null,
                addSongChannelId: null
            };
        }
    }

    start() {
        this.startServer(this.port);
    }
    
    startServer(port) {
        this.server.listen(port, () => {
            console.log(`🌐 Web dashboard running on http://localhost:${port}/`);
        }).on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`⚠️ Port ${port} is in use, trying port ${port + 1}...`);
                this.startServer(port + 1);
            } else {
                console.error('❌ Web server error:', err.message);
                throw err;
            }
        });
    }

    // Method to be called when music events occur
    onMusicEvent() {
        this.emitMusicStatus();
    }

    // Method to be called when bot status changes
    onBotStatusChange() {
        this.emitBotStatus();
    }

    // Method to update Discord Now Playing message when web controls are used
    async updateDiscordNowPlayingMessage(guildId, player) {
        try {
            // Access the nowPlayingMessages Map from the main bot instance
            const nowPlayingMessages = this.client.nowPlayingMessages;
            if (!nowPlayingMessages) {
                console.log('nowPlayingMessages not available');
                return;
            }

            const nowPlayingMessage = nowPlayingMessages.get(guildId);
            if (!nowPlayingMessage || !player.queue.current) {
                console.log('No Discord Now Playing message found or no current track');
                return;
            }

            // Get the helper functions from the main bot instance
            const createNowPlayingEmbed = this.client.createNowPlayingEmbed;
            const createMusicControlButtons = this.client.createMusicControlButtons;
            
            if (!createNowPlayingEmbed || !createMusicControlButtons) {
                console.log('Helper functions not available');
                return;
            }

            // Update the Discord message with new button states
            const embed = createNowPlayingEmbed(player, player.queue.current);
            const buttons = createMusicControlButtons(player);
            
            await nowPlayingMessage.edit({
                embeds: [embed],
                components: buttons
            });
            
            console.log(`🎵 Updated Discord Now Playing message for guild ${guildId}`);
        } catch (error) {
            console.error('Error updating Discord Now Playing message:', error);
        }
    }

    // Method to send notification embeds for track added to queue
    async sendTrackAddedNotificationEmbed(guildId, track, player) {
        try {
            // Get the helper functions from the main bot instance
            const getTargetChannelId = this.client.getTargetChannelId;
            const { EmbedBuilder } = require('discord.js');
            
            if (!getTargetChannelId) {
                console.log('getTargetChannelId function not available');
                return;
            }

            // Get target channel using the same logic as the main bot
            const targetChannelId = await this.getTargetChannelId(guildId, player?.textChannelId);
            console.log(`🔍 DEBUG: Target channel ID for notifications: ${targetChannelId}`);
            const channel = this.client.channels.cache.get(targetChannelId);
            
            if (!channel) {
                console.warn(`⚠️ Could not find channel ${targetChannelId} for guild ${guildId}`);
                return;
            }

            // Check if bot has permissions to send messages in this channel
            if (!channel.permissionsFor(this.client.user).has(['SendMessages', 'EmbedLinks'])) {
                console.warn(`⚠️ Bot lacks permissions to send messages in channel ${targetChannelId} (${channel.name}) for guild ${guildId}`);
                return;
            }

            const queuePosition = player?.queue?.tracks?.length || 0;
            const isPlaying = player?.playing && !player?.paused;
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🎵 Track Added to Queue')
                .setDescription(`**${track.info.title}** by ${track.info.author}`)
                .addFields(
                    { name: '👤 Added by', value: track.requester?.displayName || 'Web Dashboard', inline: true },
                    { name: '🎛️ Source', value: 'Web Dashboard', inline: true },
                    { name: '📊 Queue Position', value: queuePosition > 0 ? `#${queuePosition + 1}` : 'Now Playing', inline: true }
                )
                .setTimestamp();
            
            if (track.info.uri) {
                embed.setURL(track.info.uri);
            }
            
            if (track.info.artworkUrl) {
                embed.setThumbnail(track.info.artworkUrl);
            }
            
            if (track.info.length && track.info.length > 0) {
                const duration = this.formatDuration(track.info.length);
                embed.addFields({ name: '⏱️ Duration', value: duration, inline: true });
            }

            await channel.send({ embeds: [embed] });
            console.log(`📢 Sent track added notification embed to channel ${targetChannelId} for guild ${guildId}`);
            
        } catch (error) {
            console.error('Error sending track added notification embed:', error);
        }
    }

    async sendChannelSettingsConfirmationEmbed(guildId, channelId) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;

            const channel = guild.channels.cache.get(channelId);
            if (!channel) return;

            // Check permissions
            if (!channel.permissionsFor(this.client.user).has(['SendMessages', 'EmbedLinks'])) {
                return;
            }

            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('⚙️ Channel Settings Updated')
                .setDescription(`Channel settings have been successfully updated via the Web Dashboard.`)
                .addFields(
                    { name: '📢 Now Playing Channel', value: `<#${channelId}>`, inline: true },
                    { name: '🌐 Updated via', value: 'Web Dashboard', inline: true },
                    { name: '✅ Status', value: 'Settings Saved', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Rhythmix Web Dashboard' });

            await channel.send({ embeds: [embed] });
            console.log(`📢 Sent channel settings confirmation embed to channel ${channelId} for guild ${guildId}`);
        } catch (error) {
            console.error('Error sending channel settings confirmation embed:', error);
        }
    }
    
    async sendNowPlayingEmbed(guildId, track, player) {
        try {
            const getTargetChannelId = this.client.getTargetChannelId;
            
            if (!getTargetChannelId) {
                console.log('getTargetChannelId function not available');
                return;
            }
            
            const targetChannelId = await this.getTargetChannelId(guildId, player?.textChannelId);
            console.log(`🔍 DEBUG: Now Playing target channel ID: ${targetChannelId} for guild ${guildId}`);
            
            if (!targetChannelId) {
                console.log(`⚠️ No target channel configured for guild ${guildId}`);
                return;
            }
            
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;
            
            const channel = guild.channels.cache.get(targetChannelId);
            if (!channel) {
                console.warn(`⚠️ Could not find channel ${targetChannelId} for guild ${guildId}`);
                return;
            }
            
            // Check if bot has permissions to send messages in this channel
            if (!channel.permissionsFor(this.client.user).has(['SendMessages', 'EmbedLinks'])) {
                console.warn(`⚠️ Bot lacks permissions to send Now Playing message in channel ${targetChannelId} (${channel.name}) for guild ${guildId}`);
                return;
            }
            
            // Delete previous now playing message if it exists
            const nowPlayingMessages = this.client.nowPlayingMessages;
            if (nowPlayingMessages) {
                const previousMessage = nowPlayingMessages.get(guildId);
                if (previousMessage) {
                    try {
                        await previousMessage.delete();
                    } catch (error) {
                        // Message might already be deleted, ignore error
                    }
                }
            }
            
            // Get the helper functions from the main bot instance
            const createNowPlayingEmbed = this.client.createNowPlayingEmbed;
            const createMusicControlButtons = this.client.createMusicControlButtons;
            
            if (!createNowPlayingEmbed || !createMusicControlButtons) {
                console.log('Helper functions not available');
                return;
            }
            
            const embed = createNowPlayingEmbed(player, track);
            const buttons = createMusicControlButtons(player);
            
            const message = await channel.send({
                embeds: [embed],
                components: buttons
            });
            
            // Store the message for later cleanup
            if (nowPlayingMessages) {
                nowPlayingMessages.set(guildId, message);
            }
            
            console.log(`📢 Sent Now Playing embed to channel ${targetChannelId} for guild ${guildId}`);
            
        } catch (error) {
            console.error('Error sending Now Playing embed:', error);
        }
    }

    // Method to send notification embeds for Dashboard actions
    async sendDashboardNotificationEmbed(guildId, action, player, additionalInfo = {}) {
        try {
            // Get the helper functions from the main bot instance
            const getTargetChannelId = this.client.getTargetChannelId;
            const { EmbedBuilder } = require('discord.js');
            
            // Get target channel using the same logic as the main bot
            const targetChannelId = await this.getTargetChannelId(guildId, player?.textChannelId);
            const channel = this.client.channels.cache.get(targetChannelId);
            
            if (!channel) {
                console.warn(`⚠️ Could not find channel ${targetChannelId} for guild ${guildId}`);
                return;
            }

            let embed;
            const currentTrack = player?.queue?.current;
            
            switch (action) {
                case 'paused':
                    embed = new EmbedBuilder()
                        .setColor('#ffa500')
                        .setTitle('⏸️ Music Paused')
                        .setDescription(currentTrack ? `**${currentTrack.info.title}** by ${currentTrack.info.author}` : 'Music has been paused')
                        .addFields({ name: '🎛️ Source', value: 'Web Dashboard', inline: true })
                        .setTimestamp();
                    break;
                    
                case 'resumed':
                    embed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('▶️ Music Resumed')
                        .setDescription(currentTrack ? `**${currentTrack.info.title}** by ${currentTrack.info.author}` : 'Music has been resumed')
                        .addFields({ name: '🎛️ Source', value: 'Web Dashboard', inline: true })
                        .setTimestamp();
                    break;
                    
                case 'skipped':
                    const nextTrack = player?.queue?.tracks?.[0];
                    embed = new EmbedBuilder()
                        .setColor('#ff6b6b')
                        .setTitle('⏭️ Track Skipped')
                        .setDescription(currentTrack ? `Skipped: **${currentTrack.info.title}** by ${currentTrack.info.author}` : 'Track has been skipped')
                        .addFields(
                            { name: '🎛️ Source', value: 'Web Dashboard', inline: true },
                            { name: '📊 Queue', value: `${player?.queue?.tracks?.length || 0} tracks remaining`, inline: true }
                        )
                        .setTimestamp();
                    
                    if (nextTrack) {
                        embed.addFields({ name: '⏭️ Next Track', value: `**${nextTrack.info.title}** by ${nextTrack.info.author}`, inline: false });
                    }
                    break;
                    
                case 'volume':
                    const volume = additionalInfo.volume || player?.volume || 100;
                    let volumeIcon = '🔊';
                    if (volume === 0) volumeIcon = '🔇';
                    else if (volume < 30) volumeIcon = '🔈';
                    else if (volume < 70) volumeIcon = '🔉';
                    
                    embed = new EmbedBuilder()
                        .setColor('#00bfff')
                        .setTitle(`${volumeIcon} Volume Changed`)
                        .setDescription(currentTrack ? `**${currentTrack.info.title}** by ${currentTrack.info.author}` : 'Volume has been adjusted')
                        .addFields(
                            { name: '🔊 New Volume', value: `${volume}%`, inline: true },
                            { name: '🎛️ Source', value: 'Web Dashboard', inline: true }
                        )
                        .setTimestamp();
                    break;
                    
                default:
                    console.log(`Unknown action: ${action}`);
                    return;
            }

            await channel.send({ embeds: [embed] });
            console.log(`📢 Sent ${action} notification embed to channel ${targetChannelId} for guild ${guildId}`);
            
        } catch (error) {
            console.error('Error sending Dashboard notification embed:', error);
        }
    }
}

module.exports = WebServer;