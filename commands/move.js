const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('move')
        .setDescription('Change the position of a track in the queue')
        .addIntegerOption(option =>
            option.setName('from')
                .setDescription('Current position of the track to move (1 = first in queue)')
                .setRequired(true)
                .setMinValue(1)
        )
        .addIntegerOption(option =>
            option.setName('to')
                .setDescription('New position for the track (1 = first in queue)')
                .setRequired(true)
                .setMinValue(1)
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

            const fromPosition = interaction.options.getInteger('from');
            const toPosition = interaction.options.getInteger('to');
            const queue = player.queue.tracks;
            
            if (queue.length === 0) {
                return await interaction.reply({
                    content: '❌ The queue is empty!',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (fromPosition > queue.length || toPosition > queue.length) {
                return await interaction.reply({
                    content: `❌ Invalid position! The queue only has **${queue.length}** track${queue.length === 1 ? '' : 's'}.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            if (fromPosition === toPosition) {
                return await interaction.reply({
                    content: '❌ The track is already at that position!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Convert to 0-indexed positions
            const fromIndex = fromPosition - 1;
            const toIndex = toPosition - 1;
            
            // Remove the track from its current position
            const [movedTrack] = queue.splice(fromIndex, 1);
            
            // Insert it at the new position
            queue.splice(toIndex, 0, movedTrack);

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🔄 Track Moved')
                .setDescription(`Moved track from position **${fromPosition}** to position **${toPosition}**`)
                .addFields(
                    {
                        name: '🎵 Moved Track',
                        value: `[${movedTrack.info.title}](${movedTrack.info.uri})`,
                        inline: false
                    },
                    {
                        name: '👤 Artist',
                        value: movedTrack.info.author || 'Unknown',
                        inline: true
                    },
                    {
                        name: '⏱️ Duration',
                        value: formatDuration(movedTrack.info.duration),
                        inline: true
                    },
                    {
                        name: '📋 Queue Position',
                        value: `${fromPosition} → ${toPosition}`,
                        inline: true
                    },
                    {
                        name: '📊 Queue Length',
                        value: `${queue.length} track${queue.length === 1 ? '' : 's'}`,
                        inline: true
                    }
                )
                .setFooter({ text: `Moved by ${interaction.user.displayName}` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in move command:', error);
            await interaction.reply({
                content: '❌ An error occurred while moving the track.',
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