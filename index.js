require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
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
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages
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
        
        // Set a flag to indicate Lavalink is not available initially
        client.lavalinkAvailable = false;
        
        // Initialize Lavalink with safe ASCII username
        await client.lavalink.init({
            id: client.user.id,
            username: "MusicBot" // Use safe ASCII name instead of actual username
        });
        
        console.log('✅ Lavalink initialized successfully');
        
        // Wait for nodes to connect with retry logic
        let retryCount = 0;
        const maxRetries = 10;
        const checkInterval = 2000;
        
        const waitForConnection = () => {
            return new Promise((resolve) => {
                const checkConnection = () => {
                    const connectedNodes = Array.from(client.lavalink.nodeManager.nodes.values()).filter(node => node.connected);
                    
                    if (connectedNodes.length > 0) {
                        client.lavalinkAvailable = true;
                        console.log('✅ Lavalink is now available with connected nodes');
                        setupLavalinkEventListeners();
                        resolve(true);
                    } else if (retryCount < maxRetries) {
                        retryCount++;
                        console.log(`🔄 Waiting for Lavalink nodes to connect... (${retryCount}/${maxRetries})`);
                        setTimeout(checkConnection, checkInterval);
                    } else {
                        console.log('⚠️ Lavalink nodes failed to connect after maximum retries - using HTTP fallback');
                        client.lavalinkAvailable = false;
                        resolve(false);
                    }
                };
                checkConnection();
            });
        };
        
        await waitForConnection();
        
    } catch (error) {
        console.error('❌ Failed to initialize Lavalink:', error);
        client.lavalinkAvailable = false;
    }
    
    // Initialize and Start Web Server (only once)
    if (!webServerInitialized) {
        try {
            // Expose helper functions to the client for web server access
            client.getTargetChannelId = getTargetChannelId;
            
            webServer = new WebServer(client);
            client.webServer = webServer; // Attach to client for command access
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
        
        // Check permissions for admin commands
        const adminCommands = ['247', 'defaultvolume', 'settings'];
        if (adminCommands.includes(interaction.commandName)) {
            // Check if user has administrator permissions or manage guild permissions
            const hasAdminPerms = interaction.member.permissions.has('Administrator') || 
                                interaction.member.permissions.has('ManageGuild');
            
            if (!hasAdminPerms) {
                return await interaction.reply({
                    content: '❌ You need Administrator or Manage Server permissions to use this command.',
                    flags: MessageFlags.Ephemeral
                });
            }
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
        // Handle settings back button first
        if (interaction.customId === 'settings_back_to_main') {
            // Check permissions
            if (!interaction.member.permissions.has('Administrator') && 
                !interaction.member.permissions.has('ManageGuild')) {
                return await interaction.reply({
                    content: '❌ You need Administrator or Manage Server permissions to access settings.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Recreate the main settings embed (same as in commands/settings.js)
            const { StringSelectMenuBuilder } = require('discord.js');
            const webServer = client.webServer;
            const guildSettings = await webServer.getGuildSettings(interaction.guildId);
            
            const currentChannelId = guildSettings?.nowPlayingChannelId;
            const defaultVolume = guildSettings?.defaultVolume || 50;
            const is247Mode = guildSettings?.is247Mode || false;
            const autoLeave = guildSettings?.autoLeave !== false;

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('⚙️ Bot Settings')
                .setDescription(`Configure bot settings for **${interaction.guild.name}**`)
                .addFields(
                    { 
                        name: '📺 Dashboard Channel', 
                        value: currentChannelId ? 
                            `<#${currentChannelId}>` : 
                            '🔍 Auto-detection enabled', 
                        inline: true 
                    },
                    { 
                        name: '🔊 Default Volume', 
                        value: `${defaultVolume}%`, 
                        inline: true 
                    },
                    { 
                        name: '🔄 24/7 Mode', 
                        value: is247Mode ? '✅ Enabled' : '❌ Disabled', 
                        inline: true 
                    },
                    { 
                        name: '⏰ Auto-leave', 
                        value: autoLeave ? '✅ Enabled' : '❌ Disabled', 
                        inline: true 
                    }
                )
                .addFields({
                    name: '📝 Instructions',
                    value: 'Use the dropdown menu below to configure specific settings.',
                    inline: false
                });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('settings_main_selector')
                .setPlaceholder('Choose a setting to configure')
                .addOptions(
                    {
                        label: '📺 Dashboard Channel',
                        description: 'Set the channel for music notifications',
                        value: 'dashboard_channel',
                        emoji: '📺'
                    },
                    {
                        label: '🔊 Default Volume',
                        description: 'Set the default volume for new sessions',
                        value: 'default_volume',
                        emoji: '🔊'
                    },
                    {
                        label: '🔄 24/7 Mode',
                        description: 'Toggle 24/7 mode on/off',
                        value: '247_mode',
                        emoji: '🔄'
                    }
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.update({ embeds: [embed], components: [row] });
            return;
        }
        
        // Handle button interactions for music controls
        await handleMusicButtons(interaction, client);
    } else if (interaction.isStringSelectMenu()) {
        // Handle dropdown menu interactions
        await handleSelectMenuInteractions(interaction, client);
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
        
        // Handle settings buttons
        if (customId === 'settings_247_enable' || customId === 'settings_247_disable') {
            // Check permissions
            if (!interaction.member.permissions.has('Administrator') && 
                !interaction.member.permissions.has('ManageGuild')) {
                return await interaction.reply({
                    content: '❌ You need Administrator or Manage Server permissions to change settings.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const isEnabled = customId === 'settings_247_enable';
            const fs = require('fs');
            const path = require('path');
            const settingsPath = path.join(__dirname, '247-settings.json');

            try {
                // Load existing settings
                let settings = {};
                if (fs.existsSync(settingsPath)) {
                    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                }

                // Update 24/7 setting
                settings[interaction.guildId] = isEnabled;
                fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

                // Update current player if exists
                const currentPlayer = client.lavalink.getPlayer(interaction.guildId);
                if (currentPlayer) {
                    if (isEnabled) {
                        currentPlayer.set('247', true);
                    } else {
                        currentPlayer.delete('247');
                    }
                }

                const embed = new EmbedBuilder()
                    .setColor(isEnabled ? '#00ff00' : '#ff0000')
                    .setTitle(`${isEnabled ? '🔄 24/7 Mode Enabled' : '⏹️ 24/7 Mode Disabled'}`)
                    .setDescription(isEnabled ? 
                        'The bot will now stay in the voice channel 24/7 and won\'t leave when the queue is empty.' :
                        'The bot will now leave the voice channel when the queue is empty or when everyone leaves.')
                    .addFields(
                        { name: 'Status', value: isEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                        { name: 'Changed By', value: interaction.user.toString(), inline: true }
                    )
                    .setTimestamp();

                await interaction.update({ embeds: [embed], components: [] });
                return;
            } catch (error) {
                console.error('Error saving 24/7 setting:', error);
                return await interaction.reply({
                    content: '❌ Failed to save the 24/7 setting. Please try again.',
                    flags: MessageFlags.Ephemeral
                });
            }
        }
        
        // Handle back to main settings button
        if (customId === 'settings_back_to_main') {
            // Check permissions
            if (!interaction.member.permissions.has('Administrator') && 
                !interaction.member.permissions.has('ManageGuild')) {
                return await interaction.reply({
                    content: '❌ You need Administrator or Manage Server permissions to access settings.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Recreate the main settings embed (same as in commands/settings.js)
            const { StringSelectMenuBuilder } = require('discord.js');
            const webServer = client.webServer;
            const guildSettings = await webServer.getGuildSettings(interaction.guildId);
            
            const currentChannelId = guildSettings?.nowPlayingChannelId;
            const defaultVolume = guildSettings?.defaultVolume || 50;
            const is247Mode = guildSettings?.is247Mode || false;
            const autoLeave = guildSettings?.autoLeave !== false;

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('⚙️ Bot Settings')
                .setDescription(`Configure bot settings for **${interaction.guild.name}**`)
                .addFields(
                    { 
                        name: '📺 Dashboard Channel', 
                        value: currentChannelId ? 
                            `<#${currentChannelId}>` : 
                            '🔍 Auto-detection enabled', 
                        inline: true 
                    },
                    { 
                        name: '🔊 Default Volume', 
                        value: `${defaultVolume}%`, 
                        inline: true 
                    },
                    { 
                        name: '🔄 24/7 Mode', 
                        value: is247Mode ? '✅ Enabled' : '❌ Disabled', 
                        inline: true 
                    },
                    { 
                        name: '⏰ Auto-leave', 
                        value: autoLeave ? '✅ Enabled' : '❌ Disabled', 
                        inline: true 
                    }
                )
                .addFields({
                    name: '📝 Instructions',
                    value: 'Use the dropdown menu below to configure specific settings.',
                    inline: false
                });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('settings_main_selector')
                .setPlaceholder('Choose a setting to configure')
                .addOptions(
                    {
                        label: '📺 Dashboard Channel',
                        description: 'Set the channel for music notifications',
                        value: 'dashboard_channel',
                        emoji: '📺'
                    },
                    {
                        label: '🔊 Default Volume',
                        description: 'Set the default volume for new sessions',
                        value: 'default_volume',
                        emoji: '🔊'
                    },
                    {
                        label: '🔄 24/7 Mode',
                        description: 'Toggle 24/7 mode on/off',
                        value: '247_mode',
                        emoji: '🔄'
                    }
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.update({ embeds: [embed], components: [row] });
            return;
        }
        
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
    
    // Without MessageContent intent, we can only read content from:
    // 1. Messages that mention the bot
    // 2. DMs (which we're not handling here)
    // 3. Messages from the bot itself
    
    // Check if the message mentions the bot or if we can read the content
    const botMentioned = message.mentions.has(client.user);
    const canReadContent = message.content && message.content.length > 0;
    
    if (!canReadContent && !botMentioned) {
        // If we can't read the content and the bot isn't mentioned, 
        // send a helpful message about using slash commands
        if (botMentioned) {
            await message.reply('👋 Hi! I use slash commands now. Type `/` and you\'ll see all my commands! You can also enable the Message Content Intent in the Discord Developer Portal to use prefix commands.');
        }
        return;
    }
    
    const prefix = process.env.PREFIX || '!';
    let content = message.content;
    
    // If bot is mentioned, remove the mention from the content
    if (botMentioned) {
        content = content.replace(/<@!?\d+>/g, '').trim();
        // If there's no content after removing mentions, show help
        if (!content) {
            await message.reply('👋 Hi! I use slash commands now. Type `/` and you\'ll see all my commands!');
            return;
        }
        // If the content doesn't start with prefix, add it
        if (!content.startsWith(prefix)) {
            content = prefix + content;
        }
    }
    
    if (!content.startsWith(prefix)) return;
    
    const args = content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    // Find the command
    const command = client.commands.get(commandName);
    if (!command) {
        // Handle basic commands that don't have slash command equivalents
        if (commandName === 'ping') {
            await message.reply('🏓 Pong!');
        } else {
            await message.reply(`❌ Command \`${commandName}\` not found. Use \`/help\` to see available commands.`);
        }
        return;
    }
    
    try {
        // Create a mock interaction object for prefix commands
        const mockInteraction = {
            member: message.member,
            guild: message.guild,
            channel: message.channel,
            user: message.author,
            guildId: message.guild.id,
            channelId: message.channel.id,
            reply: async (content) => {
                if (typeof content === 'string') {
                    return await message.reply(content);
                } else {
                    return await message.reply(content);
                }
            },
            deferReply: async () => {
                // For prefix commands, we'll just send a typing indicator
                await message.channel.sendTyping();
            },
            editReply: async (content) => {
                // For prefix commands, just send a new message
                if (typeof content === 'string') {
                    return await message.reply(content);
                } else {
                    return await message.reply(content);
                }
            },
            followUp: async (content) => {
                if (typeof content === 'string') {
                    return await message.reply(content);
                } else {
                    return await message.reply(content);
                }
            },
            options: {
                getString: (name) => {
                    // Map common option names to arguments
                    if (name === 'query' || name === 'song' || name === 'search') {
                        return args.join(' ');
                    }
                    if (name === 'volume') {
                        return args[0];
                    }
                    if (name === 'position' || name === 'index') {
                        return args[0];
                    }
                    if (name === 'time') {
                        return args[0];
                    }
                    return args[0];
                },
                getInteger: (name) => {
                    const value = parseInt(args[0]);
                    return isNaN(value) ? null : value;
                },
                getNumber: (name) => {
                    const value = parseFloat(args[0]);
                    return isNaN(value) ? null : value;
                }
            }
        };
        
        // Execute the command
        await command.execute(mockInteraction, client);
    } catch (error) {
        console.error('Error executing prefix command:', error);
        await message.reply('❌ There was an error executing that command!');
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
                                    
                                    // Delete any existing 5-minute warning messages before sending 1-minute warning
                                    const existingMessages = autoDisconnectMessages.get(newState.guild.id);
                                    if (existingMessages && existingMessages.length > 0) {
                                        for (const message of existingMessages) {
                                            try {
                                                await message.delete();
                                            } catch (error) {
                                                // Message might already be deleted, ignore error
                                            }
                                        }
                                        // Clear the array but keep the reference
                                        existingMessages.length = 0;
                                    }
                                    
                                    const warningMessage = await channel.send({ embeds: [warningEmbed] });
                                    
                                    // Store the 1-minute warning message
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
                                    
                                    // Delete the 1-minute warning message before sending 30-second warning
                                    const existingMessages = autoDisconnectMessages.get(newState.guild.id);
                                    if (existingMessages && existingMessages.length > 0) {
                                        for (const message of existingMessages) {
                                            try {
                                                await message.delete();
                                            } catch (error) {
                                                // Message might already be deleted, ignore error
                                            }
                                        }
                                        // Clear the array but keep the reference
                                        existingMessages.length = 0;
                                    }
                                    
                                    const finalWarningMessage = await channel.send({ embeds: [warningEmbed] });
                                    
                                    // Store the 30-second warning message
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
                                
                                // Delete the 30-second warning message before disconnecting
                                const existingMessages = autoDisconnectMessages.get(newState.guild.id);
                                if (existingMessages && existingMessages.length > 0) {
                                    for (const message of existingMessages) {
                                        try {
                                            await message.delete();
                                        } catch (error) {
                                            // Message might already be deleted, ignore error
                                        }
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
                                        
                                        const disconnectMessage = await channel.send({ embeds: [disconnectEmbed] });
                                        
                                        // Auto-delete disconnect message after 30 seconds
                                        setTimeout(async () => {
                                            try {
                                                await disconnectMessage.delete();
                                            } catch (error) {
                                                // Message might already be deleted, ignore error
                                            }
                                        }, 30 * 1000); // 30 seconds
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

// Handle select menu interactions
async function handleSelectMenuInteractions(interaction, client) {
    try {
        if (interaction.customId === 'settings_dashboard_channel') {
            // Check permissions
            if (!interaction.member.permissions.has('Administrator') && 
                !interaction.member.permissions.has('ManageGuild')) {
                return await interaction.reply({
                    content: '❌ You need Administrator or Manage Server permissions to change settings.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const selectedValue = interaction.values[0];
            const webServer = client.webServer;
            
            if (!webServer) {
                return await interaction.reply({
                    content: '❌ Web server is not available. Please contact the bot administrator.',
                    flags: MessageFlags.Ephemeral
                });
            }

            try {
                if (selectedValue === 'auto-detect') {
                    // Remove the specific channel setting to enable auto-detection
                    await webServer.saveGuildSettings(interaction.guildId, {
                        nowPlayingChannelId: null
                    });

                    const embed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('✅ Dashboard Channel Updated')
                        .setDescription('Dashboard notifications will now use **auto-detection** to find music-related channels.')
                        .addFields(
                            { name: '🔍 Auto-detection', value: 'Enabled', inline: true },
                            { name: '📝 Keywords', value: 'music, song, audio, sound, bot', inline: true }
                        )
                        .setTimestamp();

                    await interaction.update({ embeds: [embed], components: [] });
                } else {
                    // Set specific channel
                    const channel = interaction.guild.channels.cache.get(selectedValue);
                    
                    if (!channel) {
                        return await interaction.reply({
                            content: '❌ Selected channel not found. Please try again.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    // Check if bot has permissions in the selected channel
                    if (!channel.permissionsFor(interaction.guild.members.me).has(['SendMessages', 'EmbedLinks'])) {
                        return await interaction.reply({
                            content: `❌ I don't have permission to send messages in ${channel}. Please ensure I have 'Send Messages' and 'Embed Links' permissions.`,
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    // Save the setting
                    await webServer.saveGuildSettings(interaction.guildId, {
                        nowPlayingChannelId: channel.id
                    });

                    const embed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('✅ Dashboard Channel Updated')
                        .setDescription(`Web dashboard notifications will now be sent to ${channel}`)
                        .addFields(
                            { name: '📺 Channel', value: `${channel}`, inline: true },
                            { name: '🆔 Channel ID', value: channel.id, inline: true }
                        )
                        .setTimestamp();

                    await interaction.update({ embeds: [embed], components: [] });
                }
            } catch (error) {
                console.error('Error saving dashboard channel setting:', error);
                await interaction.reply({
                    content: '❌ Failed to save the dashboard channel setting. Please try again.',
                    flags: MessageFlags.Ephemeral
                });
            }
        } else if (interaction.customId === 'settings_main_selector') {
            // Check permissions
            if (!interaction.member.permissions.has('Administrator') && 
                !interaction.member.permissions.has('ManageGuild')) {
                return await interaction.reply({
                    content: '❌ You need Administrator or Manage Server permissions to change settings.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const selectedSetting = interaction.values[0];
            const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder } = require('discord.js');
            
            // Create back button
            const backButton = new ButtonBuilder()
                .setCustomId('settings_back_to_main')
                .setLabel(' Back to Settings')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️');
            
            if (selectedSetting === 'dashboard_channel') {
                // Get all text channels that the bot can send messages to
                const allTextChannels = interaction.guild.channels.cache
                    .filter(channel => 
                        channel.type === ChannelType.GuildText && 
                        channel.permissionsFor(interaction.guild.members.me).has(['SendMessages', 'EmbedLinks'])
                    )
                    .sort((a, b) => a.name.localeCompare(b.name));
                
                const textChannels = allTextChannels.first(25); // Discord limit for select menu options
                const webServer = client.webServer;
                const guildSettings = await webServer.getGuildSettings(interaction.guildId);
                const currentChannelId = guildSettings?.nowPlayingChannelId;

                // Create dropdown menu options
                const channelOptions = [
                    {
                        label: '🔍 Auto-detect (Default)',
                        description: 'Automatically detect music-related channels',
                        value: 'auto-detect',
                        emoji: '🔍',
                        default: !currentChannelId || !allTextChannels.get(currentChannelId)
                    }
                ];

                // Add text channels to options
                textChannels.forEach(channel => {
                    channelOptions.push({
                        label: `# ${channel.name}`,
                        description: `Set ${channel.name} as dashboard channel`,
                        value: channel.id,
                        emoji: '📺',
                        default: currentChannelId === channel.id
                    });
                });

                const channelSelectMenu = new StringSelectMenuBuilder()
                    .setCustomId('settings_dashboard_channel')
                    .setPlaceholder('Choose a channel for dashboard notifications')
                    .addOptions(channelOptions);

                // Create new embed for dashboard channel setting
                const channelEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('📺 Dashboard Channel Settings')
                    .setDescription(`Configure the channel where music notifications will be sent for **${interaction.guild.name}**.`);

                // Show current setting
                if (currentChannelId) {
                    const currentChannel = interaction.guild.channels.cache.get(currentChannelId);
                    channelEmbed.addFields({
                        name: '📺 Current Dashboard Channel',
                        value: currentChannel ? `${currentChannel}` : `⚠️ Channel not found (ID: ${currentChannelId})`,
                        inline: false
                    });
                } else {
                    channelEmbed.addFields({
                        name: '📺 Current Dashboard Channel',
                        value: '🔍 Auto-detection enabled',
                        inline: false
                    });
                }

                channelEmbed.addFields({
                    name: '📝 Instructions',
                    value: 'Select a channel from the dropdown below to set as your music dashboard channel.',
                    inline: false
                });

                const row1 = new ActionRowBuilder().addComponents(channelSelectMenu);
                const row2 = new ActionRowBuilder().addComponents(backButton);

                await interaction.update({ embeds: [channelEmbed], components: [row1, row2] });
            } else if (selectedSetting === 'default_volume') {
                const webServer = client.webServer;
                const guildSettings = await webServer.getGuildSettings(interaction.guildId);
                const defaultVolume = guildSettings?.defaultVolume || 50;

                // Create volume dropdown menu
                const volumeOptions = [
                    { label: '🔇 0% (Muted)', value: '0', default: defaultVolume === 0 },
                    { label: '🔈 25% (Low)', value: '25', default: defaultVolume === 25 },
                    { label: '🔉 50% (Medium)', value: '50', default: defaultVolume === 50 },
                    { label: '🔊 75% (High)', value: '75', default: defaultVolume === 75 },
                    { label: '🔊 100% (Maximum)', value: '100', default: defaultVolume === 100 }
                ];

                const volumeSelectMenu = new StringSelectMenuBuilder()
                    .setCustomId('settings_default_volume')
                    .setPlaceholder('Choose default volume for new sessions')
                    .addOptions(volumeOptions);

                // Create new embed for volume setting
                const volumeEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('🔊 Default Volume Settings')
                    .setDescription(`Configure the default volume for new music sessions in **${interaction.guild.name}**.`)
                    .addFields(
                        { name: '🔊 Current Default Volume', value: `${defaultVolume}%`, inline: true },
                        { name: '📝 Note', value: 'This applies to new sessions only', inline: true }
                    )
                    .addFields({
                        name: '📝 Instructions',
                        value: 'Select a new default volume from the dropdown below.',
                        inline: false
                    });

                const row1 = new ActionRowBuilder().addComponents(volumeSelectMenu);
                const row2 = new ActionRowBuilder().addComponents(backButton);

                await interaction.update({ embeds: [volumeEmbed], components: [row1, row2] });
            } else if (selectedSetting === '247_mode') {
                const webServer = client.webServer;
                const guildSettings = await webServer.getGuildSettings(interaction.guildId);
                const is247Mode = guildSettings?.is247Mode || false;

                // Create 24/7 mode buttons
                const enable247Button = new ButtonBuilder()
                    .setCustomId('settings_247_enable')
                    .setLabel('Enable 24/7 Mode')
                    .setStyle(is247Mode ? ButtonStyle.Success : ButtonStyle.Secondary)
                    .setEmoji('✅');

                const disable247Button = new ButtonBuilder()
                    .setCustomId('settings_247_disable')
                    .setLabel('Disable 24/7 Mode')
                    .setStyle(!is247Mode ? ButtonStyle.Danger : ButtonStyle.Secondary)
                    .setEmoji('❌');

                // Create new embed for 24/7 mode setting
                const mode247Embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('🔄 24/7 Mode Settings')
                    .setDescription(`Configure 24/7 mode for **${interaction.guild.name}**.`)
                    .addFields(
                        { name: '🔄 Current 24/7 Mode', value: is247Mode ? '✅ Enabled' : '❌ Disabled', inline: true },
                        { name: '📝 Description', value: is247Mode ? 'Bot stays in voice channel 24/7' : 'Bot leaves when queue is empty', inline: true }
                    )
                    .addFields({
                        name: '📝 Instructions',
                        value: 'Use the buttons below to enable or disable 24/7 mode.',
                        inline: false
                    });

                const row1 = new ActionRowBuilder().addComponents(enable247Button, disable247Button);
                const row2 = new ActionRowBuilder().addComponents(backButton);

                await interaction.update({ embeds: [mode247Embed], components: [row1, row2] });
            }
        } else if (interaction.customId === 'settings_default_volume') {
            // Check permissions
            if (!interaction.member.permissions.has('Administrator') && 
                !interaction.member.permissions.has('ManageGuild')) {
                return await interaction.reply({
                    content: '❌ You need Administrator or Manage Server permissions to change settings.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const selectedVolume = parseInt(interaction.values[0]);
            const fs = require('fs');
            const path = require('path');
            const settingsPath = path.join(__dirname, 'default-volume-settings.json');

            try {
                // Load existing settings
                let settings = {};
                if (fs.existsSync(settingsPath)) {
                    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                }

                // Update volume setting
                settings[interaction.guildId] = selectedVolume;
                fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('✅ Default Volume Updated')
                    .setDescription(`Default volume has been set to **${selectedVolume}%** for new music sessions.`)
                    .addFields(
                        { name: '🔊 New Volume', value: `${selectedVolume}%`, inline: true },
                        { name: '📝 Note', value: 'This applies to new sessions only', inline: true }
                    )
                    .setTimestamp();

                await interaction.update({ embeds: [embed], components: [] });
            } catch (error) {
                console.error('Error saving volume setting:', error);
                await interaction.reply({
                    content: '❌ Failed to save the volume setting. Please try again.',
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    } catch (error) {
        console.error('Error handling select menu interaction:', error);
        
        const errorMessage = {
            content: '❌ An error occurred while processing your selection.',
            flags: MessageFlags.Ephemeral
        };
        
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        } catch (replyError) {
            console.warn('⚠️ Could not send error message to user:', replyError.message);
        }
    }
}

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