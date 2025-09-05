const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearqueue')
        .setDescription('Remove all tracks from the queue'),
    
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

            const queueLength = player.queue.tracks.length;
            
            if (queueLength === 0) {
                return await interaction.reply({
                    content: '❌ The queue is already empty!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Clear the queue
            player.queue.clear();

            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('🗑️ Queue Cleared')
                .setDescription(`Successfully removed **${queueLength}** track${queueLength === 1 ? '' : 's'} from the queue.`)
                .addFields({
                    name: '🎵 Current Track',
                    value: player.queue.current ? `${player.queue.current.info.title}` : 'None',
                    inline: false
                })
                .setFooter({ text: `Cleared by ${interaction.user.displayName}` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in clearqueue command:', error);
            await interaction.reply({
                content: '❌ An error occurred while clearing the queue.',
                flags: MessageFlags.Ephemeral
            });
        }
    },
};