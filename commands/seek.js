const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('seek')
        .setDescription('Jump to a specific time in the current track')
        .addStringOption(option =>
            option.setName('time')
                .setDescription('Time to seek to (format: mm:ss or hh:mm:ss or seconds)')
                .setRequired(true)
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

            const timeInput = interaction.options.getString('time');
            const seekPosition = parseTimeToMs(timeInput);
            
            if (seekPosition === null) {
                return await interaction.reply({
                    content: '❌ Invalid time format! Use mm:ss, hh:mm:ss, or seconds (e.g., 1:30, 0:01:30, or 90)',
                    flags: MessageFlags.Ephemeral
                });
            }

            const trackDuration = player.queue.current.info.duration;
            
            if (seekPosition > trackDuration) {
                return await interaction.reply({
                    content: `❌ Seek position (${formatDuration(seekPosition)}) is beyond track duration (${formatDuration(trackDuration)})!`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // Seek to the position
            await player.seek(seekPosition);

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('⏭️ Track Position Changed')
                .setDescription(`Jumped to **${formatDuration(seekPosition)}**`)
                .addFields(
                    {
                        name: '🎵 Current Track',
                        value: `[${player.queue.current.info.title}](${player.queue.current.info.uri})`,
                        inline: false
                    },
                    {
                        name: '⏱️ New Position',
                        value: `${formatDuration(seekPosition)} / ${formatDuration(trackDuration)}`,
                        inline: true
                    },
                    {
                        name: '📊 Progress',
                        value: `${Math.round((seekPosition / trackDuration) * 100)}%`,
                        inline: true
                    }
                )
                .setFooter({ text: `Seeked by ${interaction.user.displayName}` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in seek command:', error);
            await interaction.reply({
                content: '❌ An error occurred while seeking in the track.',
                flags: MessageFlags.Ephemeral
            });
        }
    },
};

function parseTimeToMs(timeStr) {
    // Remove any whitespace
    timeStr = timeStr.trim();
    
    // Check if it's just a number (seconds)
    if (/^\d+$/.test(timeStr)) {
        const seconds = parseInt(timeStr);
        return seconds * 1000;
    }
    
    // Check for mm:ss or hh:mm:ss format
    const timeRegex = /^(?:(\d+):)?(\d+):(\d+)$/;
    const match = timeStr.match(timeRegex);
    
    if (!match) {
        return null;
    }
    
    let hours = 0;
    let minutes = 0;
    let seconds = 0;
    
    if (match[1] !== undefined) {
        // hh:mm:ss format
        hours = parseInt(match[1]);
        minutes = parseInt(match[2]);
        seconds = parseInt(match[3]);
    } else {
        // mm:ss format
        minutes = parseInt(match[2]);
        seconds = parseInt(match[3]);
    }
    
    // Validate ranges
    if (minutes >= 60 || seconds >= 60) {
        return null;
    }
    
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

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