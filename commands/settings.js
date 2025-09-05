const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Configure server settings with interactive menu')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        try {
            // Check permissions (double check even though we have setDefaultMemberPermissions)
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && 
                !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return await interaction.reply({
                    content: '❌ You need Administrator or Manage Server permissions to use this command.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Get web server instance from client
            const webServer = client.webServer;
            if (!webServer) {
                return await interaction.reply({
                    content: '❌ Web server is not available. Please contact the bot administrator.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Get current settings
            const guildSettings = await webServer.getGuildSettings(interaction.guildId);
            const currentChannelId = guildSettings?.nowPlayingChannelId;
            const defaultVolume = guildSettings?.defaultVolume || 50;
            const is247Mode = guildSettings?.is247Mode || false;
            
            // Get all text channels that the bot can send messages to
            const allTextChannels = interaction.guild.channels.cache
                .filter(channel => 
                    channel.type === ChannelType.GuildText && 
                    channel.permissionsFor(interaction.guild.members.me).has(['SendMessages', 'EmbedLinks'])
                )
                .sort((a, b) => a.name.localeCompare(b.name));
            
            const textChannels = allTextChannels.first(25); // Discord limit for select menu options

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

            // Create main settings selector
            const mainSettingsOptions = [
                { label: '📺 Dashboard Channel', description: 'Configure notification channel', value: 'dashboard_channel', emoji: '📺' },
                { label: '🔊 Default Volume', description: 'Set default volume for new sessions', value: 'default_volume', emoji: '🔊' },
                { label: '🔄 24/7 Mode', description: 'Toggle always-on mode', value: '247_mode', emoji: '🔄' }
            ];

            const mainSettingsMenu = new StringSelectMenuBuilder()
                .setCustomId('settings_main_selector')
                .setPlaceholder('Choose a setting to configure')
                .addOptions(mainSettingsOptions);

            // Create action rows for components
            const row1 = new ActionRowBuilder().addComponents(mainSettingsMenu);

            // Create settings embed
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('⚙️ Server Settings')
                .setDescription(`Configure settings for **${interaction.guild.name}**`)
                .setTimestamp();

            // Current Dashboard Channel
            if (currentChannelId) {
                const currentChannel = interaction.guild.channels.cache.get(currentChannelId);
                embed.addFields({
                    name: '📺 Current Dashboard Channel',
                    value: currentChannel ? `${currentChannel}` : `⚠️ Channel not found (ID: ${currentChannelId})`,
                    inline: false
                });
            } else {
                embed.addFields({
                    name: '📺 Current Dashboard Channel',
                    value: '🔍 Auto-detection enabled',
                    inline: false
                });
            }

            // Other settings display
            const command247 = client.commands.get('247');
            const is247Enabled = command247 ? command247.is247Enabled(interaction.guildId) : false;
            const autoLeave = guildSettings?.autoLeave !== undefined ? guildSettings.autoLeave : true;

            embed.addFields(
                { name: '🔊 Default Volume', value: `${defaultVolume}%`, inline: true },
                { name: '🔄 24/7 Mode', value: is247Mode ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: '🚪 Auto Leave', value: autoLeave ? '✅ Enabled' : '❌ Disabled', inline: true }
            );

            embed.addFields({
                name: '📝 Instructions',
                value: 'Use the dropdown menu below to configure server settings. Select a setting type to see available options.',
                inline: false
            });

            await interaction.reply({
                embeds: [embed],
                components: [row1],
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Error in settings command:', error);
            
            const errorMessage = {
                content: '❌ An error occurred while processing the settings command.',
                flags: MessageFlags.Ephemeral
            };
            
            if (interaction.deferred) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    }
};