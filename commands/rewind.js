const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rewind')
        .setDescription('Rewind the current track by a few seconds')
        .addIntegerOption(option =>
            option.setName('seconds')
                .setDescription('Number of seconds to rewind (default: 10)')
                .setMinValue(1)
                .setMaxValue(300) // 5 minutes max
        ),
    
    async execute(interaction, client) {
        try {
            // Get player
            const player = client.lavalink.getPlayer(interaction.guildId);
            if (!player) {
                return await interaction.reply({
                    content: '❌ There is no music playing!',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (!player.queue.current) {
                return await interaction.reply({
                    content: '❌ No track is currently playing!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const seconds = interaction.options.getInteger('seconds') || 10;
            const currentPosition = player.position;
            const newPosition = Math.max(0, currentPosition - (seconds * 1000));
            
            // Seek to the new position
            await player.seek(newPosition);

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('⏪ Track Rewound')
                .setDescription(`Rewound **${seconds}** second${seconds === 1 ? '' : 's'}`)
                .addFields(
                    {
                        name: '🎵 Current Track',
                        value: `[${player.queue.current.info.title}](${player.queue.current.info.uri})`,
                        inline: false
                    },
                    {
                        name: '⏱️ Position',
                        value: `${formatDuration(newPosition)} / ${formatDuration(player.queue.current.info.duration)}`,
                        inline: true
                    },
                    {
                        name: '⏪ Rewound',
                        value: `${seconds} second${seconds === 1 ? '' : 's'}`,
                        inline: true
                    }
                )
                .setFooter({ text: `Rewound by ${interaction.user.displayName}` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in rewind command:', error);
            await interaction.reply({
                content: '❌ An error occurred while rewinding the track.',
                flags: MessageFlags.Ephemeral
            });
        }
    },
};

function formatDuration(ms) {
    if (!ms || ms === 0) return '00:00';
    
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}