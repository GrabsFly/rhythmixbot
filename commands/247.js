const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Store 24/7 mode settings in a JSON file
const settingsPath = path.join(__dirname, '..', '247-settings.json');

// Load existing settings or create default
function loadSettings() {
    try {
        if (fs.existsSync(settingsPath)) {
            return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading 24/7 settings:', error);
    }
    return {};
}

// Save settings to file
function saveSettings(settings) {
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('Error saving 24/7 settings:', error);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('247')
        .setDescription('Toggle 24/7 mode to keep the bot in voice channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction, client) {
        try {
            // Check if user has administrator or manage guild permissions
            const hasAdminPerms = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || 
                                interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
            
            if (!hasAdminPerms) {
                return await interaction.reply({
                    content: '❌ You need Administrator or Manage Server permissions to use this command.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const guildId = interaction.guildId;
            const settings = loadSettings();
            
            // Toggle 24/7 mode for this guild
            const current247Status = settings[guildId] || false;
            const new247Status = !current247Status;
            settings[guildId] = new247Status;
            saveSettings(settings);

            // Get current player
            const player = client.lavalink.getPlayer(guildId);
            
            if (new247Status) {
                // Enable 24/7 mode
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🔄 24/7 Mode Enabled')
                    .setDescription('The bot will now stay in the voice channel 24/7 and won\'t leave when the queue is empty or when everyone leaves.')
                    .addFields(
                        { name: 'Status', value: '✅ Enabled', inline: true },
                        { name: 'Enabled By', value: interaction.user.toString(), inline: true }
                    )
                    .setTimestamp();

                // If there's a player, mark it as 24/7
                if (player) {
                    player.set('247', true);
                    embed.addFields({ name: '🎵 Current Session', value: 'Updated to 24/7 mode', inline: false });
                }

                await interaction.reply({ embeds: [embed] });
            } else {
                // Disable 24/7 mode
                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('⏹️ 24/7 Mode Disabled')
                    .setDescription('The bot will now leave the voice channel when the queue is empty or when everyone leaves.')
                    .addFields(
                        { name: 'Status', value: '❌ Disabled', inline: true },
                        { name: 'Disabled By', value: interaction.user.toString(), inline: true }
                    )
                    .setTimestamp();

                // If there's a player, remove 24/7 flag
                if (player) {
                    player.delete('247');
                    embed.addFields({ name: '🎵 Current Session', value: 'Reverted to normal mode', inline: false });
                    
                    // If player is idle (not playing and queue is empty), disconnect
                    if (!player.playing && !player.paused && player.queue.tracks.length === 0) {
                        setTimeout(async () => {
                            const currentPlayer = client.lavalink.getPlayer(guildId);
                            if (currentPlayer && !currentPlayer.playing && !currentPlayer.paused && currentPlayer.queue.tracks.length === 0) {
                                await currentPlayer.destroy();
                            }
                        }, 5000); // 5 second delay to allow for immediate new songs
                        
                        embed.addFields({ name: '⏰ Auto-disconnect', value: 'Will disconnect in 5 seconds if no music is played', inline: false });
                    }
                }

                await interaction.reply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Error in 247 command:', error);
            
            const errorMessage = {
                content: 'An error occurred while processing the 24/7 command.',
                flags: MessageFlags.Ephemeral
            };
            
            if (interaction.deferred) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    },

    // Helper function to check if 24/7 mode is enabled for a guild
    is247Enabled(guildId) {
        const settings = loadSettings();
        return settings[guildId] || false;
    }
};