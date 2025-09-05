const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a track from the queue by position')
        .addIntegerOption(option =>
            option.setName('position')
                .setDescription('Position of the track to remove (1 = first in queue)')
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

            const position = interaction.options.getInteger('position');
            const queue = player.queue.tracks;
            
            if (queue.length === 0) {
                return await interaction.reply({
                    content: '❌ The queue is empty!',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (position > queue.length) {
                return await interaction.reply({
                    content: `❌ Invalid position! The queue only has **${queue.length}** track${queue.length === 1 ? '' : 's'}.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // Remove the track (position is 1-indexed, array is 0-indexed)
            const removedTrack = queue.splice(position - 1, 1)[0];

            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('🗑️ Track Removed')
                .setDescription(`Removed track from position **${position}**`)
                .addFields(
                    {
                        name: '🎵 Removed Track',
                        value: `[${removedTrack.info.title}](${removedTrack.info.uri})`,
                        inline: false
                    },
                    {
                        name: '👤 Artist',
                        value: removedTrack.info.author || 'Unknown',
                        inline: true
                    },
                    {
                        name: '⏱️ Duration',
                        value: formatDuration(removedTrack.info.duration),
                        inline: true
                    },
                    {
                        name: '📋 Queue Length',
                        value: `${queue.length} track${queue.length === 1 ? '' : 's'} remaining`,
                        inline: true
                    }
                )
                .setFooter({ text: `Removed by ${interaction.user.displayName}` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in remove command:', error);
            await interaction.reply({
                content: '❌ An error occurred while removing the track.',
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