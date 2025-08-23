const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Store default volume settings in a JSON file
const settingsPath = path.join(__dirname, '..', 'default-volume-settings.json');

// Load existing settings or create default
function loadSettings() {
    try {
        if (fs.existsSync(settingsPath)) {
            return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading default volume settings:', error);
    }
    return {};
}

// Save settings to file
function saveSettings(settings) {
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('Error saving default volume settings:', error);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('defaultvolume')
        .setDescription('Set or view the default volume for new music sessions')
        .addIntegerOption(option =>
            option.setName('volume')
                .setDescription('The default volume to set (0-100)')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(100)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction, client) {
        try {
            // Check if user has administrator permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.reply({
                    content: 'You need administrator permissions to use this command.',
                    ephemeral: true
                });
            }

            const guildId = interaction.guildId;
            const settings = loadSettings();
            const volumeInput = interaction.options.getInteger('volume');
            
            // If no volume provided, show current setting
            if (volumeInput === null) {
                const currentVolume = settings[guildId] || parseInt(process.env.DEFAULT_VOLUME) || 50;
                
                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('Current Default Volume')
                    .setDescription(`The current default volume for new music sessions is **${currentVolume}%**.`)
                    .addFields(
                        { name: 'Current Setting', value: `${currentVolume}%`, inline: true },
                        { name: 'To Change', value: 'Use `/defaultvolume <volume>` with a value between 0-100', inline: true }
                    )
                    .setFooter({ text: 'This setting only applies to new music sessions' })
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed] });
            }
            
            // Set new default volume
            settings[guildId] = volumeInput;
            saveSettings(settings);
            
            // Create volume bar visualization
            const volumeBar = '█'.repeat(Math.floor(volumeInput / 5)) + '░'.repeat(20 - Math.floor(volumeInput / 5));
            
            // Determine volume level description
            let volumeLevel;
            if (volumeInput === 0) {
                volumeLevel = '🔇 Muted';
            } else if (volumeInput <= 25) {
                volumeLevel = '🔈 Low';
            } else if (volumeInput <= 75) {
                volumeLevel = '🔉 Medium';
            } else {
                volumeLevel = '🔊 High';
            }
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Default Volume Updated')
                .setDescription(`The default volume has been set to **${volumeInput}%** for new music sessions.`)
                .addFields(
                    { name: 'New Volume', value: `${volumeInput}% ${volumeLevel}`, inline: true },
                    { name: 'Set By', value: interaction.user.toString(), inline: true },
                    { name: 'Volume Bar', value: `\`${volumeBar}\` ${volumeInput}%`, inline: false }
                )
                .setFooter({ text: 'This setting will apply to new music sessions' })
                .setTimestamp();

            // Update current player volume if one exists
            const player = client.lavalink.getPlayer(guildId);
            if (player) {
                await player.setVolume(volumeInput);
                embed.addFields({ name: 'Current Session', value: `Volume updated to ${volumeInput}% for the current music session as well.`, inline: false });
            }

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in defaultvolume command:', error);
            
            const errorMessage = {
                content: 'An error occurred while processing the default volume command.',
                ephemeral: true
            };
            
            if (interaction.deferred) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    },

    // Helper function to get default volume for a guild
    getDefaultVolume(guildId) {
        const settings = loadSettings();
        return settings[guildId] || parseInt(process.env.DEFAULT_VOLUME) || 50;
    }
};