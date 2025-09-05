const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removedupes')
        .setDescription('Remove duplicate tracks from the queue'),
    
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

            const queue = player.queue.tracks;
            
            if (queue.length === 0) {
                return await interaction.reply({
                    content: '❌ The queue is empty!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const originalLength = queue.length;
            const seen = new Set();
            const duplicates = [];
            
            // Find duplicates by comparing track URIs
            for (let i = queue.length - 1; i >= 0; i--) {
                const track = queue[i];
                const trackId = track.info.uri || track.info.title;
                
                if (seen.has(trackId)) {
                    // This is a duplicate, remove it
                    duplicates.push(queue.splice(i, 1)[0]);
                } else {
                    seen.add(trackId);
                }
            }

            if (duplicates.length === 0) {
                return await interaction.reply({
                    content: '✅ No duplicate tracks found in the queue!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const embed = new EmbedBuilder()
                .setColor('#ffa500')
                .setTitle('🧹 Duplicates Removed')
                .setDescription(`Successfully removed **${duplicates.length}** duplicate track${duplicates.length === 1 ? '' : 's'} from the queue.`)
                .addFields(
                    {
                        name: '📊 Queue Statistics',
                        value: `**Before:** ${originalLength} tracks\n**After:** ${queue.length} tracks\n**Removed:** ${duplicates.length} duplicates`,
                        inline: false
                    }
                )
                .setFooter({ text: `Cleaned by ${interaction.user.displayName}` })
                .setTimestamp();

            // Show some of the removed duplicates if there are any
            if (duplicates.length > 0) {
                const sampleDuplicates = duplicates.slice(0, 3).map(track => 
                    `• ${track.info.title}`
                ).join('\n');
                
                const duplicatesList = duplicates.length > 3 
                    ? `${sampleDuplicates}\n• ... and ${duplicates.length - 3} more`
                    : sampleDuplicates;

                embed.addFields({
                    name: '🗑️ Removed Duplicates',
                    value: duplicatesList,
                    inline: false
                });
            }

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in removedupes command:', error);
            await interaction.reply({
                content: '❌ An error occurred while removing duplicates.',
                flags: MessageFlags.Ephemeral
            });
        }
    },
};