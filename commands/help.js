const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all available Rhythmix commands'),
    
    async execute(interaction) {
        // Create the main help embed
        const mainEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🎵 Rhythmix Help')
        .setDescription('Welcome to Rhythmix! Use the dropdown menu below to explore different command categories.')
            .addFields(
                {
                    name: '🎵 Music Commands',
                    value: 'Play, pause, skip, and control music playback',
                    inline: true
                },
                {
                    name: '⚙️ Admin Commands',
                    value: 'Server administration and bot configuration',
                    inline: true
                },
                {
                    name: '📋 Playlist Commands',
                    value: 'Create and manage custom playlists',
                    inline: true
                },
                {
                    name: '🔧 Utility Commands',
                    value: 'Additional helpful features and tools',
                    inline: true
                }
            )
            .setFooter({ 
                text: null, 
                iconURL: interaction.client.user.displayAvatarURL() 
            })
            .setTimestamp();

        // Create dropdown menu
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_category')
            .setPlaceholder('Select a category to view commands')
            .addOptions([
                {
                    label: 'Music Commands',
                    description: 'Play, pause, skip, and control music playback',
                    value: 'music',
                    emoji: '🎵'
                },
                {
                    label: 'Admin Commands',
                    description: 'Server administration and bot configuration',
                    value: 'admin',
                    emoji: '⚙️'
                },
                {
                    label: 'Playlist Commands',
                    description: 'Create and manage custom playlists',
                    value: 'playlist',
                    emoji: '📋'
                },
                {
                    label: 'Utility Commands',
                    description: 'Additional helpful features and tools',
                    value: 'utility',
                    emoji: '🔧'
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const response = await interaction.reply({ 
            embeds: [mainEmbed], 
            components: [row]
        });

        // Create collector for dropdown interactions
        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.customId === 'help_category') {
                let embed;
                
                if (i.values[0] === 'music') {
                    embed = new EmbedBuilder()
                        .setColor('#e74c3c')
                        .setTitle('🎵 Music Commands')
                        .setDescription('Control music playback and manage your listening experience.')
                        .addFields(
                            {
                                name: '🎶 Playback Controls',
                                value: '`/play` - Play music from YouTube, Spotify, or SoundCloud\n`/pause` - Pause or resume current track\n`/skip` - Skip to next track\n`/stop` - Stop playback and clear queue',
                                inline: false
                            },
                            {
                                name: '📋 Queue Management',
                                value: '`/queue` - View current queue\n`/nowplaying` - Show current track info\n`/clearqueue` - Remove all tracks from the queue\n`/remove` - Remove a track from the queue by position\n`/removedupes` - Remove duplicate tracks from the queue\n`/move` - Change the position of a track in the queue',
                                inline: false
                            },
                            {
                                name: '⏯️ Track Navigation',
                                value: '`/rewind` - Rewind the current track by a few seconds\n`/seek` - Jump to a specific time in the current track',
                                inline: false
                            },
                            {
                                name: '🔊 Audio Controls',
                                value: '`/volume` - Adjust playback volume\n`/join` - Join your voice channel\n`/leave` - Leave voice channel',
                                inline: false
                            }
                        )
                        .setFooter({ 
                            text: null, 
                            iconURL: interaction.client.user.displayAvatarURL() 
                        })
                        .setTimestamp();
                } else if (i.values[0] === 'playlist') {
                    embed = new EmbedBuilder()
                        .setColor('#9b59b6')
                        .setTitle('📋 Playlist Commands')
                        .setDescription('Create and manage your custom music playlists.')
                        .addFields(
                            {
                                name: '📝 Playlist Management',
                                value: '`/playlist create` - Create a new playlist\n`/playlist delete` - Delete a playlist\n`/playlist list` - View all your playlists',
                                inline: false
                            },
                            {
                                name: '🎵 Song Management',
                                value: '`/playlist add` - Add songs to playlist\n`/playlist remove` - Remove songs from playlist\n`/playlist play` - Play entire playlist',
                                inline: false
                            },
                            {
                                name: '💡 Tips',
                                value: 'Playlists are saved per user and can be accessed from any server where the bot is present.',
                                inline: false
                            }
                        )
                        .setFooter({ 
                            text: null, 
                            iconURL: interaction.client.user.displayAvatarURL() 
                        })
                        .setTimestamp();
                } else if (i.values[0] === 'utility') {
                    embed = new EmbedBuilder()
                        .setColor('#17a2b8')
                        .setTitle('🔧 Utility Commands')
                        .setDescription('Additional helpful features and tools for enhanced functionality.')
                        .addFields(
                            {
                                name: '⏰ Sleep Timer',
                                value: '`/sleeptimer` - Set a timer to automatically stop music after specified minutes',
                                inline: false
                            },
                            {
                                name: '💡 Tips',
                                value: 'Use utility commands to enhance your music listening experience with automated features.',
                                inline: false
                            }
                        )
                        .setFooter({ 
                            text: null, 
                            iconURL: interaction.client.user.displayAvatarURL() 
                        })
                        .setTimestamp();
                } else if (i.values[0] === 'admin') {
                    embed = new EmbedBuilder()
                        .setColor('#ff6b35')
                        .setTitle('⚙️ Admin Commands')
                        .setDescription('Server administration and bot configuration commands.')
                        .addFields(
                            {
                                name: '🔧 Bot Settings',
                                value: '`/247` - Enable/disable 24/7 mode\n`/defaultvolume` - Set default volume for new sessions',
                                inline: false
                            },
                            {
                                name: '📋 Requirements',
                                value: 'Admin commands require **Administrator** permission or **Manage Server** permission.',
                                inline: false
                            },
                            {
                                name: '💡 Tips',
                                value: 'Use admin commands to customize the bot behavior for your server.',
                                inline: false
                            }
                        )
                        .setFooter({ 
                            text: null, 
                            iconURL: interaction.client.user.displayAvatarURL() 
                        })
                        .setTimestamp();
                }

                await i.update({ embeds: [embed], components: [row] });
            }
        });

        collector.on('end', async () => {
            // Disable the dropdown when collector expires
            selectMenu.setDisabled(true);
            const disabledRow = new ActionRowBuilder().addComponents(selectMenu);
            
            try {
                await response.edit({ components: [disabledRow] });
            } catch (error) {
                // Ignore errors if message was already deleted
            }
        });
    },
};