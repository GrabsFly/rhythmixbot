require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { LavalinkManager } = require('lavalink-client');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const WebServer = require('./web-server');

// Auto-deploy commands on startup
console.log('🚀 Deploying slash commands...');
try {
    execSync('node deploy-commands.js', { stdio: 'inherit'     });
    console.log('✅ Commands deployed successfully!');
} catch (error) {
    console.error('❌ Failed to deploy commands:', error.message);
    console.log('⚠️ Bot will continue without command deployment...');
}
// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Initialize command collection
client.commands = new Collection();

// Initialize Web Server variable
let webServer;
let webServerInitialized = false;

// Load commands
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

// Initialize Lavalink Manager
const nodeConfig = {
    authorization: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
    host: process.env.LAVALINK_HOST || 'localhost',
    port: parseInt(process.env.LAVALINK_PORT) || 2333,
    id: 'main-node',
    secure: process.env.LAVALINK_SECURE === 'true',
    retryAmount: 5,
    retryDelay: 30000,
    requestTimeout: 10000
};
console.log(`🔧 Lavalink connecting to: ${nodeConfig.host}:${nodeConfig.port}`);

// Store original console.error for filtering Lavalink errors
const originalConsoleError = console.error;
console.error = function(...args) {
    const message = args.join(' ');
    if (message.includes('The node is not connected to the Lavalink Server') ||
        message.includes('/v4/info') ||
        message.includes('fetchInfo') ||
        message.includes('ON-OPEN-FETCH')) {
        // Silently ignore these Lavalink connection errors
        return;
    }
    // Call original console.error for other errors
    originalConsoleError.apply(console, args);
};

// Add global error handlers to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
    if (reason && reason.message && (
        reason.message.includes('/v4/info') || 
        reason.message.includes('The node is not connected to the Lavalink Server') ||
        reason.message.includes('fetchInfo') ||
        reason.message.includes('ON-OPEN-FETCH')
    )) {
        // Silently ignore these Lavalink connection errors
        return;
    }
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    if (error && error.message && (
        error.message.includes('/v4/info') || 
        error.message.includes('The node is not connected to the Lavalink Server') ||
        error.message.includes('fetchInfo') ||
        error.message.includes('ON-OPEN-FETCH')
    )) {
        // Silently ignore these Lavalink connection errors
        return;
    }
    
    // Handle Discord API interaction timeout errors
    if (error.code === 10062 || error.message?.includes('Unknown interaction')) {
        console.warn('⚠️ Discord interaction expired, continuing normally');
        return;
    }
    
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

// Initialize Lavalink Manager with error handling
client.lavalink = new LavalinkManager({
    nodes: [nodeConfig],
    sendToShard: (guildId, payload) => client.guilds.cache.get(guildId)?.shard?.send(payload),
    autoSkip: true,
    autoSkipOnResolveError: true,
    emitNewSongsOnly: false,
    client: {
        id: process.env.CLIENT_ID,
        username: "MusicBot"
    },
    playerOptions: {
            clientBasedPositionUpdateInterval: 50,
            defaultSearchPlatform: "ytsearch",
            volumeDecrementer: 0.75,
            useUnresolvedData: true,
            maxErrorsPerTime: {
                threshold: 10000,
                maxAmount: 3
            },
            applyVolumeAsFilter: false,
            requesterTransformer: (requester) => {
                return {
                    id: requester.id,
                    username: requester.username,
                    globalName: requester.globalName || requester.username,
                    avatar: requester.displayAvatarURL()
                };
            }
        },
    queueOptions: {
            maxPreviousTracks: 25
        }
});

// Bot ready event
client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} is online!`);
    console.log(`🎵 Rhythmix is ready to serve ${client.guilds.cache.size} guilds!`);
    console.log(`🌐 Visit rhythmixbot.xyz for more information!`);
    
    // Set default bot activity status
    try {
        await client.user.setActivity('/help for all commands | rhythmixbot.xyz | rhythmixbot.xyz', {
            type: 2 // LISTENING activity type
        });
        console.log('🎵 Bot activity status set!');
    } catch (error) {
        console.error('Error setting bot activity:', error);
    }
    
    // Initialize Lavalink
    console.log('🔧 Initializing Lavalink with client:', {
        id: client.user.id,
        username: client.user.username
    });
    
    try {
        console.log('🔄 Starting Lavalink initialization...');
        console.log('🔍 NodeManager before init:', !!client.lavalink.nodeManager);
        console.log('🔍 Nodes before init:', client.lavalink.nodes?.size || 0);
        
        // Initialize Lavalink with comprehensive error handling
        try {
            // Set a flag to indicate Lavalink is not available initially
            client.lavalinkAvailable = false;
            
            // Set up a timeout for initialization
            const initPromise = client.lavalink.init({
                id: client.user.id,
                username: client.user.username
            });
            
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Lavalink initialization timeout')), 15000);
            });
            
            await Promise.race([initPromise, timeoutPromise]);
            console.log('✅ Lavalink initialized successfully');
            
            // Wait a bit for nodes to connect before marking as available
            setTimeout(() => {
                const connectedNodes = Array.from(client.lavalink.nodeManager.nodes.values()).filter(node => node.connected);
                if (connectedNodes.length > 0) {
                    client.lavalinkAvailable = true;
                    console.log('✅ Lavalink is now available with connected nodes');
                    
                    // Register Lavalink event listeners after connection is established
                    setupLavalinkEventListeners();
                } else {
                    console.log('⚠️ Lavalink initialized but no nodes connected - using HTTP fallback');
                }
            }, 3000);
            
        } catch (error) {
            console.warn('⚠️ Lavalink initialization failed, but bot will continue with direct HTTP fallback:', error.message);
            // Set a flag to indicate Lavalink is not available
            client.lavalinkAvailable = false;
        }
        
        console.log('🔗 Lavalink connection initialized!');
        console.log('🔍 Available nodes after init:', client.lavalink.nodes?.size || 0);
        console.log('🔍 Node manager exists:', !!client.lavalink.nodeManager);
        console.log('🔍 Nodes map exists:', !!client.lavalink.nodes);
        
        // Check if nodes are in the nodeManager
        if (client.lavalink.nodeManager) {
            console.log('🔍 NodeManager nodes count:', client.lavalink.nodeManager.nodes?.size || 0);
            console.log('🔍 NodeManager nodes map:', !!client.lavalink.nodeManager.nodes);
            
            // Try to access and connect nodes directly
            if (client.lavalink.nodeManager.nodes && client.lavalink.nodeManager.nodes.size > 0) {
                console.log('🔍 Attempting to connect nodes manually...');
                for (const [nodeId, node] of client.lavalink.nodeManager.nodes) {
                    console.log(`🔍 Node ${nodeId} status:`, {
                        connected: node.connected,
                        connecting: node.connecting,
                        destroyed: node.destroyed
                    });
                    
                    if (!node.connected && !node.connecting) {
                        console.log(`🔄 Manually connecting node ${nodeId}...`);
                        try {
                            await node.connect();
                            console.log(`✅ Node ${nodeId} connection initiated`);
                        } catch (error) {
                            console.error(`❌ Failed to connect node ${nodeId}:`, error);
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ Failed to initialize Lavalink:', error);
    }
    
    // Initialize and Start Web Server (only once)
    if (!webServerInitialized) {
        try {
            // Expose helper functions to the client for web server access
            client.getTargetChannelId = getTargetChannelId;
            
            webServer = new WebServer(client);
            console.log('🌐 Web server initialized!');
            webServer.start();
            console.log('🌐 Web dashboard is now available!');
            webServerInitialized = true;
        } catch (error) {
            console.error('❌ Failed to initialize/start web server:', error.message);
            console.log('⚠️ Bot will continue without web dashboard...');
        }
    }
});

// Handle interactions (slash commands and buttons)
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        
        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }
        
        try {
            await command.execute(interaction, client);
        } catch (error) {
            console.error('Error executing command:', error);
            
            // Skip responding to expired interactions
            if (error.code === 10062 || error.message?.includes('Unknown interaction')) {
                console.warn('⚠️ Interaction expired, skipping response');
                return;
            }
            
            const errorMessage = {
                content: '❌ There was an error while executing this command!',
                flags: 64
            };
            
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            } catch (replyError) {
                // If we can't reply, just log it
                console.warn('⚠️ Could not send error message to user:', replyError.message);
            }
        }
    } else if (interaction.isButton()) {
        // Handle button interactions for music controls
        await handleMusicButtons(interaction, client);
    }
});

// Music button handler function
async function handleMusicButtons(interaction, client) {
    try {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player) {
            return await interaction.reply({
                content: '❌ No music player found!',
                flags: 64
            });
        }

        const { customId } = interaction;
        
        switch (customId) {
            case 'music_pause':
                if (player.paused) {
                    await player.resume();
                    // Update the message with new button states
                    const currentTrack = player.queue.current;
                    if (currentTrack) {
                        const embed = createNowPlayingEmbed(player, currentTrack);
                        const buttons = createMusicControlButtons(player);
                        await interaction.update({ embeds: [embed], components: buttons });
                    } else {
                        await interaction.reply({ content: '▶️ Music resumed!', flags: 64 });
                    }
                } else {
                    await player.pause();
                    // Update the message with new button states
                    const currentTrack = player.queue.current;
                    if (currentTrack) {
                        const embed = createNowPlayingEmbed(player, currentTrack);
                        const buttons = createMusicControlButtons(player);
                        await interaction.update({ embeds: [embed], components: buttons });
                    } else {
                        await interaction.reply({ content: '⏸️ Music paused!', flags: 64 });
                    }
                }
                break;
                
            case 'music_stop':
                player.queue.splice(0, player.queue.tracks.length);
                
                // Set default bot activity status
                try {
                    await client.user.setActivity('/help for all commands | rhythmixbot.xyz | rhythmixbot.xyz', {
                        type: 2 // LISTENING activity type
                    });
                } catch (error) {
                    console.error('Error setting bot activity:', error);
                }
                
                // Clean up now playing message
                const nowPlayingMessage = nowPlayingMessages.get(interaction.guildId);
                if (nowPlayingMessage) {
                    try {
                        await nowPlayingMessage.delete();
                        nowPlayingMessages.delete(interaction.guildId);
                    } catch (error) {
                        // Message might already be deleted, ignore error
                    }
                }
                
                await player.destroy();
                await interaction.reply({ content: '⏹️ Music stopped and queue cleared!', flags: 64 });
                break;
                
            case 'music_skip':
                if (player.queue.tracks.length === 0) {
                    return await interaction.reply({ content: '❌ No tracks in queue to skip!', flags: 64 });
                }
                await player.skip();
                await interaction.reply({ content: '⏭️ Track skipped!', flags: 64 });
                break;
                
            case 'music_previous':
                if (player.queue.previous.length === 0) {
                    return await interaction.reply({ content: '❌ No previous tracks!', flags: 64 });
                }
                await player.skip(player.queue.previous.length - 1, true);
                await interaction.reply({ content: '⏮️ Playing previous track!', flags: 64 });
                break;
                
            case 'music_shuffle':
                const shuffleModesList = ['off', 'normal', 'smart'];
                const currentShuffleMode = shuffleModes.get(interaction.guildId) || 'off';
                const currentShuffleIndex = shuffleModesList.indexOf(currentShuffleMode);
                const nextShuffleMode = shuffleModesList[(currentShuffleIndex + 1) % shuffleModesList.length];
                
                shuffleModes.set(interaction.guildId, nextShuffleMode);
                
                if (nextShuffleMode === 'normal') {
                    await player.queue.shuffle();
                } else if (nextShuffleMode === 'smart') {
                    // Smart shuffle: group by artist and distribute evenly
                    const tracks = [...player.queue.tracks];
                    const artistGroups = {};
                    
                    // Group tracks by artist
                    tracks.forEach(track => {
                        const artist = track.info.author || 'Unknown';
                        if (!artistGroups[artist]) artistGroups[artist] = [];
                        artistGroups[artist].push(track);
                    });
                    
                    // Smart shuffle algorithm
                    const shuffledTracks = [];
                    const artists = Object.keys(artistGroups);
                    let artistIndex = 0;
                    
                    while (shuffledTracks.length < tracks.length) {
                        const currentArtist = artists[artistIndex % artists.length];
                        if (artistGroups[currentArtist].length > 0) {
                            shuffledTracks.push(artistGroups[currentArtist].shift());
                        }
                        artistIndex++;
                        
                        // Remove empty artist groups
                        if (artistGroups[currentArtist].length === 0) {
                            delete artistGroups[currentArtist];
                            artists.splice(artists.indexOf(currentArtist), 1);
                        }
                    }
                    
                    // Clear and re-add shuffled tracks
                    player.queue.splice(0, player.queue.tracks.length);
                    await player.queue.add(shuffledTracks);
                }
                
                // Update the message with new button states
                const currentTrack = player.queue.current;
                if (currentTrack) {
                    const embed = createNowPlayingEmbed(player, currentTrack);
                    const buttons = createMusicControlButtons(player);
                    const shuffleEmojis = { off: '❌', normal: '🔀', smart: '🧠' };
                    const shuffleMessages = { 
                        off: 'Shuffle: **Off**', 
                        normal: 'Shuffle: **Normal** - Random order', 
                        smart: 'Shuffle: **Smart** - Distributed by artist' 
                    };
                    await interaction.update({ 
                        embeds: [embed], 
                        components: buttons
                    });
                } else {
                    const shuffleEmojis = { off: '❌', normal: '🔀', smart: '🧠' };
                    const shuffleMessages = { 
                        off: 'Shuffle: **Off**', 
                        normal: 'Shuffle: **Normal** - Random order', 
                        smart: 'Shuffle: **Smart** - Distributed by artist' 
                    };
                    await interaction.reply({ 
                        content: `${shuffleEmojis[nextShuffleMode]} ${shuffleMessages[nextShuffleMode]}`, 
                        flags: 64 
                    });
                }
                break;
                
            case 'music_repeat':
                const modes = ['off', 'track', 'queue'];
                const currentIndex = modes.indexOf(player.repeatMode);
                const nextMode = modes[(currentIndex + 1) % modes.length];
                await player.setRepeatMode(nextMode);
                
                // Update the message with new button states
                const repeatCurrentTrack = player.queue.current;
                if (repeatCurrentTrack) {
                    const embed = createNowPlayingEmbed(player, repeatCurrentTrack);
                    const buttons = createMusicControlButtons(player);
                    const modeEmojis = { off: '❌', track: '🔂', queue: '🔁' };
                    await interaction.update({ 
                        embeds: [embed], 
                        components: buttons
                    });
                } else {
                    const modeEmojis = { off: '❌', track: '🔂', queue: '🔁' };
                    await interaction.reply({ 
                        content: `${modeEmojis[nextMode]} Repeat mode: **${nextMode.charAt(0).toUpperCase() + nextMode.slice(1)}**`, 
                        flags: 64 
                    });
                }
                break;
                
            case 'music_volume_up':
                const newVolumeUp = Math.min(player.volume + 10, 100);
                await player.setVolume(newVolumeUp);
                
                // Notify web server about volume change
                if (webServer) {
                    webServer.onMusicEvent();
                }
                
                await interaction.reply({ content: `🔊 Volume: ${newVolumeUp}%`, flags: 64 });
                break;
                
            case 'music_volume_down':
                const newVolumeDown = Math.max(player.volume - 10, 0);
                await player.setVolume(newVolumeDown);
                
                // Notify web server about volume change
                if (webServer) {
                    webServer.onMusicEvent();
                }
                
                await interaction.reply({ content: `🔉 Volume: ${newVolumeDown}%`, flags: 64 });
                break;
                
            case 'music_queue':
                const queueEmbed = {
                    color: 0x00ff00,
                    title: '📋 Current Queue',
                    description: player.queue.tracks.length === 0 ? 'Queue is empty' : 
                        player.queue.tracks.slice(0, 10).map((track, index) => 
                            `${index + 1}. **${track.info.title}** by ${track.info.author}`
                        ).join('\n') + (player.queue.tracks.length > 10 ? `\n... and ${player.queue.tracks.length - 10} more` : ''),
                    timestamp: new Date().toISOString()
                };
                await interaction.reply({ embeds: [queueEmbed], flags: 64 });
                break;
                
            case 'music_refresh':
                if (!player.queue.current) {
                    return await interaction.reply({ content: '❌ No track is currently playing!', flags: 64 });
                }
                
                try {
                    const updatedEmbed = createNowPlayingEmbed(player, player.queue.current);
                    const updatedButtons = createMusicControlButtons(player);
                    
                    await interaction.update({
                        embeds: [updatedEmbed],
                        components: updatedButtons
                    });
                } catch (error) {
                    console.error('Error refreshing now playing:', error);
                    await interaction.reply({ content: '❌ Failed to refresh!', flags: 64 });
                }
                break;
                
            default:
                await interaction.reply({ content: '❌ Unknown button action!', flags: 64 });
        }
    } catch (error) {
        console.error('Error handling music button:', error);
        await interaction.reply({
            content: '❌ An error occurred while processing the button!',
            flags: 64
        });
    }
}

// Helper function to create now playing embed
function createNowPlayingEmbed(player, track) {
    const duration = track.info.duration;
    const position = player.position;
    const progress = duration > 0 ? (position / duration) * 100 : 0;
    
    // Format repeat mode display
    let repeatDisplay = 'Off';
    if (player.repeatMode) {
        switch (player.repeatMode) {
            case 'track': repeatDisplay = 'Track'; break;
            case 'queue': repeatDisplay = 'Queue'; break;
            case 'off': 
            default: repeatDisplay = 'Off'; break;
        }
    }
    
    // Format shuffle mode display
    let shuffleDisplay = 'Off';
    if (player.guildId) {
        const currentShuffleMode = shuffleModes.get(player.guildId) || 'off';
        switch (currentShuffleMode) {
            case 'normal': shuffleDisplay = 'Normal'; break;
            case 'smart': shuffleDisplay = 'Smart'; break;
            case 'off':
            default: shuffleDisplay = 'Off'; break;
        }
    }
    
    const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🎵 Now Playing')
        .setDescription(`**[${track.info.title}](${track.info.uri})**`)
        .addFields(
            { name: '🎤 Artist', value: track.info.author || 'Unknown', inline: true },
            { name: '⏱️ Duration', value: formatDuration(duration), inline: true },
            { name: '🔊 Volume', value: `${player.volume}%`, inline: true },
            { name: '🔁 Repeat', value: repeatDisplay, inline: true },
            { name: '🔀 Shuffle', value: shuffleDisplay, inline: true },
            { name: '👤 Requested by', value: track.requester ? `<@${track.requester.id}>` : 'Unknown', inline: true }
        )
        .setTimestamp();
    
    if (track.info.artworkUrl) {
        embed.setThumbnail(track.info.artworkUrl);
    }
    
    return embed;
}

// Helper function to get target channel ID (configured, auto-detected, or default)
async function getTargetChannelId(guildId, defaultChannelId) {
    if (webServer) {
        try {
            const guildSettings = await webServer.getGuildSettings(guildId);
            if (guildSettings && guildSettings.nowPlayingChannelId) {
                console.log(`🎵 Using configured channel: ${guildSettings.nowPlayingChannelId} for guild ${guildId}`);
                return guildSettings.nowPlayingChannelId;
            }
        } catch (error) {
            console.error(`❌ 获取服务器 ${guildId} 设置失败:`, error.message);
        }
    }
    
    // Auto-detect music-related text channel if no configured channel
    const guild = client.guilds.cache.get(guildId);
    if (guild) {
        const musicKeywords = ['music', '音乐', 'song', '歌曲', 'audio', 'sound', 'bot'];
        const textChannels = guild.channels.cache.filter(channel => 
            channel.type === 0 && // Text channel
            channel.permissionsFor(guild.members.me).has(['SendMessages', 'EmbedLinks'])
        );
        
        for (const [channelId, channel] of textChannels) {
            const channelNameLower = channel.name.toLowerCase();
            for (const keyword of musicKeywords) {
                if (channelNameLower.includes(keyword)) {
                    console.log(`🎯 Auto-detected music channel for embeds: ${channel.name} (${channelId}) for guild ${guildId}`);
                    return channelId;
                }
            }
        }
    }
    
    console.log(`🎵 Using default channel: ${defaultChannelId} for guild ${guildId}`);
    return defaultChannelId;
}

// Helper function to create music control buttons
function createMusicControlButtons(player = null) {
    // Determine repeat mode display
    let repeatLabel = 'Repeat';
    let repeatEmoji = '🔁';
    let repeatStyle = ButtonStyle.Secondary;
    
    if (player && player.repeatMode) {
        switch (player.repeatMode) {
            case 'track':
                repeatLabel = 'Repeat: Track';
                repeatEmoji = '🔂';
                repeatStyle = ButtonStyle.Success;
                break;
            case 'queue':
                repeatLabel = 'Repeat: Queue';
                repeatEmoji = '🔁';
                repeatStyle = ButtonStyle.Success;
                break;
            case 'off':
            default:
                repeatLabel = 'Repeat: Off';
                repeatEmoji = '🔁';
                repeatStyle = ButtonStyle.Secondary;
                break;
        }
    }
    
    // Determine shuffle mode display
    let shuffleLabel = 'Shuffle';
    let shuffleEmoji = '🔀';
    let shuffleStyle = ButtonStyle.Secondary;
    
    if (player && player.guildId) {
        const currentShuffleMode = shuffleModes.get(player.guildId) || 'off';
        switch (currentShuffleMode) {
            case 'normal':
                shuffleLabel = 'Shuffle: Normal';
                shuffleEmoji = '🔀';
                shuffleStyle = ButtonStyle.Success;
                break;
            case 'smart':
                shuffleLabel = 'Shuffle: Smart';
                shuffleEmoji = '🧠';
                shuffleStyle = ButtonStyle.Success;
                break;
            case 'off':
            default:
                shuffleLabel = 'Shuffle: Off';
                shuffleEmoji = '🔀';
                shuffleStyle = ButtonStyle.Secondary;
                break;
        }
    }
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('music_previous')
                .setLabel('Previous')
                .setEmoji('⏮️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('music_pause')
                .setLabel(player && player.paused ? 'Resume' : 'Pause')
                .setEmoji(player && player.paused ? '▶️' : '⏸️')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('music_stop')
                .setLabel('Stop')
                .setEmoji('⏹️')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('music_skip')
                .setLabel('Skip')
                .setEmoji('⏭️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('music_shuffle')
                .setLabel(shuffleLabel)
                .setEmoji(shuffleEmoji)
                .setStyle(shuffleStyle)
        );
    
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('music_volume_down')
                .setLabel('Vol-')
                .setEmoji('🔉')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('music_repeat')
                .setLabel(repeatLabel)
                .setEmoji(repeatEmoji)
                .setStyle(repeatStyle),
            new ButtonBuilder()
                .setCustomId('music_queue')
                .setLabel('Queue')
                .setEmoji('📋')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('music_volume_up')
                .setLabel('Vol+')
                .setEmoji('🔊')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('music_refresh')
                .setLabel('Refresh')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return [row1, row2];
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

// Handle prefix commands (optional)
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    
    const prefix = process.env.PREFIX || '!';
    if (!message.content.startsWith(prefix)) return;
    
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    // Handle basic prefix commands here if needed
    if (commandName === 'ping') {
        await message.reply('🏓 Pong!');
    }
});

// NodeManager Events (more reliable)
client.lavalink.nodeManager.on('connect', (node) => {
    console.log(`🟢 NodeManager: Node ${node.id} connected`);
    console.log(`🔗 Node details:`, {
        host: node.options.host,
        port: node.options.port,
        secure: node.options.secure,
        connected: node.connected
    });
});

client.lavalink.nodeManager.on('create', (node) => {
    console.log(`🔧 NodeManager: Node ${node.id} created`);
    console.log(`🔗 Node config:`, {
        host: node.options.host,
        port: node.options.port,
        secure: node.options.secure,
        authorization: node.options.authorization ? '[REDACTED]' : 'Not set'
    });
});

client.lavalink.nodeManager.on('disconnect', (node, reason) => {
    console.log(`🔴 NodeManager: Node ${node.id} disconnected:`, reason);
});

client.lavalink.nodeManager.on('error', (node, error) => {
    console.warn(`⚠️ NodeManager: Node ${node.id} error (continuing with fallback):`, error.message);
});

// Legacy Lavalink Events (keeping for compatibility)
client.lavalink.on('nodeConnect', (node) => {
    console.log(`✅ Node ${node.id} connected`);
    console.log(`🔗 Node details:`, {
        host: node.options.host,
        port: node.options.port,
        secure: node.options.secure,
        connected: node.connected
    });
});

client.lavalink.on('nodeDisconnect', (node, reason) => {
    console.log(`❌ Node ${node.id} disconnected:`, reason);
    console.log(`🔗 Node was:`, {
        host: node.options.host,
        port: node.options.port,
        secure: node.options.secure
    });
});

client.lavalink.on('nodeError', (node, error) => {
    console.warn(`⚠️ Node ${node.id} error (continuing with fallback):`, error.message);
    console.log(`🔗 Node details:`, {
        host: node.options.host,
        port: node.options.port,
        secure: node.options.secure
    });
});

client.lavalink.on('nodeCreate', (node) => {
    console.log(`🔧 Node ${node.id} created`);
    console.log(`🔗 Node config:`, {
        host: node.options.host,
        port: node.options.port,
        secure: node.options.secure,
        authorization: node.options.authorization ? '[REDACTED]' : 'Not set'
    });
    
    // Override the node's open method to handle fetchInfo errors gracefully
    const originalOpen = node.open.bind(node);
    node.open = function() {
        try {
            return originalOpen();
        } catch (error) {
            console.warn(`⚠️ Node ${node.id} open failed, continuing with fallback:`, error.message);
            // Don't throw the error, just log it
            return;
        }
    };
    
    // Try to manually connect the node with better error handling
    console.log(`🔄 Attempting to connect node ${node.id}...`);
    node.connect().then(() => {
        console.log(`✅ Node ${node.id} connection attempt completed`);
    }).catch(error => {
        console.warn(`⚠️ Node ${node.id} connection failed, continuing with HTTP fallback:`, error.message);
        // Don't let this crash the bot
    });
});

client.lavalink.on('nodeDestroy', (node) => {
    console.log(`🗑️ Node ${node.id} destroyed`);
});

// Store now playing messages to manage them
const nowPlayingMessages = new Map();

// Store shuffle modes for each guild
const shuffleModes = new Map(); // 'off', 'normal', 'smart'
client.shuffleModes = shuffleModes; // Make it accessible from commands

// Expose nowPlayingMessages and helper functions to the client for WebServer access
client.nowPlayingMessages = nowPlayingMessages;
client.createNowPlayingEmbed = createNowPlayingEmbed;
client.createMusicControlButtons = createMusicControlButtons;

// Function to setup Lavalink event listeners after connection is established
function setupLavalinkEventListeners() {
    console.log('🎧 Setting up Lavalink event listeners...');
    
    // Add comprehensive debug logging for all events (excluding frequent playerUpdate)
    const originalEmit = client.lavalink.emit;
    client.lavalink.emit = function(event, ...args) {
        // Skip logging frequent playerUpdate events to reduce console noise
        if (event !== 'playerUpdate') {
            console.log(`🔍 DEBUG: Lavalink event emitted: ${event}`);
        }
        if (event.includes('track') || event.includes('Track')) {
            console.log(`🔍 DEBUG: Track-related event details:`, {
                event,
                argsCount: args.length,
                firstArg: args[0] ? (args[0].guildId || 'no guildId') : 'no args'
            });
        }
        return originalEmit.call(this, event, ...args);
    };
    
    // Also listen for raw events to see what's coming from Lavalink
    client.lavalink.on('raw', (data) => {
        if (data && data.type && data.type.toLowerCase().includes('track')) {
            console.log(`🔍 DEBUG: Raw Lavalink event received:`, {
                type: data.type,
                op: data.op,
                guildId: data.guildId
            });
        }
    });
    
    // Listen for trackStart event (primary event name)
    client.lavalink.on('trackStart', async (player, track) => {
        console.log(`🔥 DEBUG: trackStart event triggered!`);
        console.log(`🎵 Started playing: ${track.info.title} in guild ${player.guildId}`);
        
        await handleTrackStart(player, track);
    });
    
    // Listen for alternative event names just in case
    client.lavalink.on('TrackStartEvent', async (player, track) => {
        console.log(`🔥 DEBUG: TrackStartEvent event triggered!`);
        console.log(`🎵 Started playing: ${track.info.title} in guild ${player.guildId}`);
        
        await handleTrackStart(player, track);
    });
    
    // Function to handle track start logic
    async function handleTrackStart(player, track) {
        // Update web dashboard
        if (webServer) {
            webServer.onMusicEvent();
        }
        
        // Keep default bot activity status
        try {
            await client.user.setActivity('/help for all commands | rhythmixbot.xyz', {
                type: 2 // LISTENING activity type
            });
        } catch (error) {
            console.error('Error setting bot activity:', error);
        }
        
        // Send automatic now playing embed
        try {
            const targetChannelId = await getTargetChannelId(player.guildId, player.textChannelId);
            console.log(`🔍 DEBUG: Now Playing target channel ID: ${targetChannelId} for guild ${player.guildId}`);
            const channel = client.channels.cache.get(targetChannelId);
        if (channel) {
            // Check if bot has permissions to send messages in this channel
            if (!channel.permissionsFor(client.user).has(['SendMessages', 'EmbedLinks'])) {
                console.warn(`⚠️ Bot lacks permissions to send Now Playing message in channel ${targetChannelId} (${channel.name}) for guild ${player.guildId}`);
                return;
            }
            
            // Delete previous now playing message if it exists
            const previousMessage = nowPlayingMessages.get(player.guildId);
            if (previousMessage) {
                try {
                    await previousMessage.delete();
                } catch (error) {
                    // Message might already be deleted, ignore error
                }
            }
            
            const embed = createNowPlayingEmbed(player, track);
            const buttons = createMusicControlButtons(player);
            
            const message = await channel.send({
                embeds: [embed],
                components: buttons
            });
            
            // Store the message for later cleanup
            nowPlayingMessages.set(player.guildId, message);
            console.log(`📢 Sent Now Playing embed to channel ${targetChannelId} for guild ${player.guildId}`);
        } else {
            console.warn(`⚠️ Could not find channel ${targetChannelId} for guild ${player.guildId}`);
        }
    } catch (error) {
            console.error('Error sending now playing embed:', error);
        }
    }

    client.lavalink.on('trackEnd', async (player, track, payload) => {
        console.log(`⏹️ Finished playing: ${track.info.title} in guild ${player.guildId}`);
    
        // Remove the current Now Playing embed before next track starts
        const nowPlayingMessage = nowPlayingMessages.get(player.guildId);
        if (nowPlayingMessage) {
            try {
                await nowPlayingMessage.delete();
                nowPlayingMessages.delete(player.guildId);
                console.log(`🗑️ Removed Now Playing embed for guild ${player.guildId}`);
            } catch (error) {
                // Message might already be deleted, ignore error
                console.log(`⚠️ Could not delete Now Playing message: ${error.message}`);
            }
        }
        
        // Update web dashboard
        if (webServer) {
            webServer.onMusicEvent();
        }
    });

    client.lavalink.on('queueEnd', async (player) => {
        console.log(`📭 Queue ended in guild ${player.guildId}`);
    
        // Update web dashboard
        if (webServer) {
            webServer.onMusicEvent();
        }
        
        // Set default bot activity status when queue ends
        try {
            await client.user.setActivity('/help for all commands | rhythmixbot.xyz | rhythmixbot.xyz', {
                type: 2 // LISTENING activity type
            });
        } catch (error) {
            console.error('Error setting bot activity:', error);
        }
        
        // Clean up now playing message
        const nowPlayingMessage = nowPlayingMessages.get(player.guildId);
        if (nowPlayingMessage) {
            try {
                await nowPlayingMessage.delete();
                nowPlayingMessages.delete(player.guildId);
            } catch (error) {
                // Message might already be deleted, ignore error
            }
        }
        
        // Auto-disconnect after queue ends (optional)
        setTimeout(() => {
            if (player.queue.tracks.length === 0 && !player.playing) {
                // Check if 24/7 mode is enabled for this guild
                const command247 = client.commands.get('247');
                const is247Enabled = command247 && command247.is247Enabled(player.guildId);
                
                if (is247Enabled) {
                    console.log(`🔄 24/7 mode enabled for guild ${player.guildId} - staying connected after queue end`);
                    return;
                }
                
                player.destroy();
            }
        }, 30000); // 30 seconds
    });

    client.lavalink.on('playerError', (player, error) => {
        console.error(`🚨 Player error in guild ${player.guildId}:`, error);
    });
    
    console.log('✅ Lavalink event listeners setup complete');
}

// Store auto-disconnect timers and messages
const autoDisconnectTimers = new Map();
const autoDisconnectMessages = new Map();

// Handle voice state updates for Lavalink and auto-disconnect
client.on('voiceStateUpdate', async (oldState, newState) => {
    // Send voice state updates to Lavalink
    const player = client.lavalink.getPlayer(newState.guild.id);
    if (!player) return;

    // Check if bot is in a voice channel
    const botVoiceChannel = newState.guild.members.me?.voice?.channel;
    if (!botVoiceChannel) return;

    // Count non-bot members in the voice channel
    const membersInChannel = botVoiceChannel.members.filter(member => !member.user.bot).size;

    if (membersInChannel === 0) {
        // Check if 24/7 mode is enabled for this guild
        const command247 = client.commands.get('247');
        const is247Enabled = command247 && command247.is247Enabled(newState.guild.id);
        
        if (is247Enabled) {
            // 24/7 mode is enabled, don't start auto-disconnect
            console.log(`🔄 24/7 mode enabled for guild ${newState.guild.id} - skipping auto-disconnect`);
            return;
        }
        
        // No users left, start auto-disconnect countdown
        if (!autoDisconnectTimers.has(newState.guild.id)) {
            console.log(`⏰ Starting 5-minute auto-disconnect countdown for guild ${newState.guild.id}`);
            
            // Send initial countdown start embed
            try {
                const targetChannelId = await getTargetChannelId(newState.guild.id, player.textChannelId);
                const channel = client.channels.cache.get(targetChannelId);
                if (channel) {
                    const startEmbed = new EmbedBuilder()
                        .setColor('#ffa500')
                        .setTitle('⏰ Auto-Disconnect Countdown Started')
                        .setDescription('Bot will leave in **5 minutes** due to no users in voice channel')
                        .addFields(
                            { name: '⏱️ Total Time', value: '5 minutes', inline: true },
                            { name: '👥 To Cancel', value: 'Join the voice channel', inline: true }
                        )
                        .setFooter({ text: 'Countdown warnings will be sent at 1 minute and 30 seconds' })
                        .setTimestamp();
                    
                    const startMessage = await channel.send({ embeds: [startEmbed] });
                    
                    // Store the start message
                    if (!autoDisconnectMessages.has(newState.guild.id)) {
                        autoDisconnectMessages.set(newState.guild.id, []);
                    }
                    autoDisconnectMessages.get(newState.guild.id).push(startMessage);
                }
            } catch (error) {
                console.log('Could not send countdown start message:', error.message);
            }
            
            const startCountdown = async () => {
                const currentPlayer = client.lavalink.getPlayer(newState.guild.id);
                if (!currentPlayer) return;
                
                // 4 minutes - 1 minute warning
                const oneMinuteWarning = setTimeout(async () => {
                    const player = client.lavalink.getPlayer(newState.guild.id);
                    if (player) {
                        const botChannel = newState.guild.members.me?.voice?.channel;
                        if (botChannel && botChannel.members.filter(member => !member.user.bot).size === 0) {
                            try {
                                const targetChannelId = await getTargetChannelId(newState.guild.id, player.textChannelId);
                                const channel = client.channels.cache.get(targetChannelId);
                                if (channel) {
                                    const warningEmbed = new EmbedBuilder()
                                        .setColor('#ffaa00')
                                        .setTitle('⚠️ Auto-Disconnect Warning')
                                        .setDescription('Bot will leave in **1 minute** due to inactivity')
                                        .addFields(
                                            { name: '⏰ Time Remaining', value: '60 seconds', inline: true },
                                            { name: '👥 Action Needed', value: 'Join voice channel to cancel', inline: true }
                                        )
                                        .setFooter({ text: 'Auto-disconnect countdown' })
                                        .setTimestamp();
                                    
                                    const warningMessage = await channel.send({ embeds: [warningEmbed] });
                                    
                                    // Store the warning message
                                    if (autoDisconnectMessages.has(newState.guild.id)) {
                                        autoDisconnectMessages.get(newState.guild.id).push(warningMessage);
                                    }
                                }
                            } catch (error) {
                                console.log('Could not send 1-minute warning:', error.message);
                            }
                        }
                    }
                }, 4 * 60 * 1000); // 4 minutes
                
                // 4.5 minutes - 30 seconds warning
                const thirtySecondWarning = setTimeout(async () => {
                    const player = client.lavalink.getPlayer(newState.guild.id);
                    if (player) {
                        const botChannel = newState.guild.members.me?.voice?.channel;
                        if (botChannel && botChannel.members.filter(member => !member.user.bot).size === 0) {
                            try {
                                const targetChannelId = await getTargetChannelId(newState.guild.id, player.textChannelId);
                                const channel = client.channels.cache.get(targetChannelId);
                                if (channel) {
                                    const warningEmbed = new EmbedBuilder()
                                        .setColor('#ff4444')
                                        .setTitle('🚨 Final Warning')
                                        .setDescription('Bot will leave in **30 seconds** due to inactivity')
                                        .addFields(
                                            { name: '⏰ Time Remaining', value: '30 seconds', inline: true },
                                            { name: '🏃 Last Chance', value: 'Join now to prevent disconnect!', inline: true }
                                        )
                                        .setFooter({ text: 'Auto-disconnect imminent' })
                                        .setTimestamp();
                                    
                                    const finalWarningMessage = await channel.send({ embeds: [warningEmbed] });
                                    
                                    // Store the final warning message
                                    if (autoDisconnectMessages.has(newState.guild.id)) {
                                        autoDisconnectMessages.get(newState.guild.id).push(finalWarningMessage);
                                    }
                                }
                            } catch (error) {
                                console.log('Could not send 30-second warning:', error.message);
                            }
                        }
                    }
                }, 4.5 * 60 * 1000); // 4.5 minutes
                
                // 5 minutes - final disconnect
                const finalDisconnect = setTimeout(async () => {
                    const currentPlayer = client.lavalink.getPlayer(newState.guild.id);
                    if (currentPlayer) {
                        const currentBotChannel = newState.guild.members.me?.voice?.channel;
                        if (currentBotChannel) {
                            const currentMembers = currentBotChannel.members.filter(member => !member.user.bot).size;
                            if (currentMembers === 0) {
                                console.log(`🚪 Auto-disconnecting from guild ${newState.guild.id} - no users for 5 minutes`);
                                
                                // Clean up now playing message
                                const nowPlayingMessage = nowPlayingMessages.get(newState.guild.id);
                                if (nowPlayingMessage) {
                                    try {
                                        await nowPlayingMessage.delete();
                                        nowPlayingMessages.delete(newState.guild.id);
                                    } catch (error) {
                                        // Message might already be deleted, ignore error
                                    }
                                }
                                
                                // Send disconnect embed message to text channel
                                try {
                                    const targetChannelId = await getTargetChannelId(newState.guild.id, currentPlayer.textChannelId);
                                    const channel = client.channels.cache.get(targetChannelId);
                                    if (channel) {
                                        const disconnectEmbed = new EmbedBuilder()
                                            .setColor('#ff6b6b')
                                            .setTitle('👋 Auto-Disconnect')
                                            .setDescription('Left the voice channel due to inactivity')
                                            .addFields(
                                                { name: '⏰ Reason', value: 'No users in voice channel for 5 minutes', inline: true },
                                                { name: '🔄 Reconnect', value: 'Use `/play` or `/join` to reconnect', inline: true }
                                            )
                                            .setFooter({ text: 'Music session ended' })
                                            .setTimestamp();
                                        
                                        await channel.send({ embeds: [disconnectEmbed] });
                                    }
                                } catch (error) {
                                    console.log('Could not send disconnect message:', error.message);
                                }
                                
                                currentPlayer.destroy();
                            }
                        }
                    }
                    // Clean up timers and messages
                    autoDisconnectTimers.delete(newState.guild.id);
                    autoDisconnectMessages.delete(newState.guild.id);
                }, 5 * 60 * 1000); // 5 minutes
                
                // Store all timers for cleanup
                autoDisconnectTimers.set(newState.guild.id, {
                    oneMinute: oneMinuteWarning,
                    thirtySeconds: thirtySecondWarning,
                    final: finalDisconnect
                });
            };
            
            startCountdown();
        }
    } else {
        // Users are present, clear auto-disconnect timers and messages
        const timers = autoDisconnectTimers.get(newState.guild.id);
        const messages = autoDisconnectMessages.get(newState.guild.id);
        
        if (timers) {
            console.log(`✅ Cancelling auto-disconnect countdown for guild ${newState.guild.id} - users rejoined`);
            clearTimeout(timers.oneMinute);
            clearTimeout(timers.thirtySeconds);
            clearTimeout(timers.final);
            autoDisconnectTimers.delete(newState.guild.id);
        }
        
        // Delete all countdown messages
        if (messages && messages.length > 0) {
            for (const message of messages) {
                try {
                    await message.delete();
                } catch (error) {
                    // Message might already be deleted, ignore error
                }
            }
            autoDisconnectMessages.delete(newState.guild.id);
        }
    }
});

// Handle voice state updates for Lavalink
client.on('raw', (data) => {
    client.lavalink.sendRawData(data);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    try {
        // Clear all auto-disconnect timers
        for (const [guildId, timers] of autoDisconnectTimers) {
            clearTimeout(timers.oneMinute);
            clearTimeout(timers.thirtySeconds);
            clearTimeout(timers.final);
        }
        autoDisconnectTimers.clear();
        
        // Clear all countdown messages
        autoDisconnectMessages.clear();
        
        // Clear all shuffle modes
        shuffleModes.clear();
        
        // Destroy all active players
        for (const [guildId, player] of client.lavalink.players) {
            player.destroy();
        }
    } catch (error) {
        console.log('⚠️ Error during Lavalink cleanup:', error.message);
    }
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down gracefully...');
    try {
        // Clear all auto-disconnect timers
        for (const [guildId, timers] of autoDisconnectTimers) {
            clearTimeout(timers.oneMinute);
            clearTimeout(timers.thirtySeconds);
            clearTimeout(timers.final);
        }
        autoDisconnectTimers.clear();
        
        // Clear all countdown messages
        autoDisconnectMessages.clear();
        
        // Clear all shuffle modes
        shuffleModes.clear();
        
        // Destroy all active players
        for (const [guildId, player] of client.lavalink.players) {
            player.destroy();
        }
    } catch (error) {
        console.log('⚠️ Error during Lavalink cleanup:', error.message);
    }
    client.destroy();
    process.exit(0);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);
