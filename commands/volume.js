const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Control the music volume')
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('Volume level (0-100)')
                .setMinValue(0)
                .setMaxValue(100)
        ),
    
    async execute(interaction, client) {
        try {
            // Check if user is in a voice channel
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                return await interaction.reply({
                    content: '❌ You need to be in a voice channel to use this command!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Get player
            const player = client.lavalink.getPlayer(interaction.guildId);
            if (!player) {
                return await interaction.reply({
                    content: '❌ No music is currently playing!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Check if user is in the same voice channel as bot
            if (player.voiceChannelId !== voiceChannel.id) {
                return await interaction.reply({
                    content: '❌ You need to be in the same voice channel as the bot!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const volumeLevel = interaction.options.getInteger('level');
            const currentVolume = player.volume;

            // If no volume level provided, show current volume
            if (volumeLevel === null) {
                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('🔊 Current Volume')
                    .setDescription(`Volume is currently set to **${currentVolume}%**`)
                    .addFields({
                        name: '📊 Volume Bar',
                        value: createVolumeBar(currentVolume),
                        inline: false
                    })
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed] });
                return;
            }

            // Set new volume
            await player.setVolume(volumeLevel);
            
            // Notify web server about volume change
            if (client.webServer) {
                client.webServer.onMusicEvent();
            }
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🔊 Volume Changed')
                .setDescription(`Volume changed from **${currentVolume}%** to **${volumeLevel}%**`)
                .addFields(
                    { name: '👤 Changed by', value: interaction.user.toString(), inline: true },
                    { name: '📊 New Volume Bar', value: createVolumeBar(volumeLevel), inline: false }
                )
                .setTimestamp();
            
            // Add volume level indicator
            if (volumeLevel === 0) {
                embed.addFields({ name: '🔇', value: 'Muted', inline: true });
            } else if (volumeLevel <= 25) {
                embed.addFields({ name: '🔈', value: 'Low', inline: true });
            } else if (volumeLevel <= 75) {
                embed.addFields({ name: '🔉', value: 'Medium', inline: true });
            } else {
                embed.addFields({ name: '🔊', value: 'High', inline: true });
            }
            
            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in volume command:', error);
            await interaction.reply({
                content: '❌ An error occurred while changing the volume!',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};

// Helper function to create volume bar
function createVolumeBar(volume, length = 20) {
    const filledLength = Math.round((volume / 100) * length);
    const emptyLength = length - filledLength;
    
    const filledBar = '█'.repeat(filledLength);
    const emptyBar = '░'.repeat(emptyLength);
    
    return `\`${filledBar}${emptyBar}\` ${volume}%`;
}