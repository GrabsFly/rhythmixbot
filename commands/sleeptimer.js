const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sleeptimer')
        .setDescription('Set a sleep timer to automatically stop music after specified minutes')
        .addIntegerOption(option =>
            option.setName('minutes')
                .setDescription('Number of minutes until music stops (1-480)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(480) // 8 hours max
        ),
    
    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        
        if (!player || !player.queue.current) {
            return interaction.reply({
                content: 'There is no music currently playing.',
                ephemeral: true
            });
        }
        
        const minutes = interaction.options.getInteger('minutes');
        const milliseconds = minutes * 60 * 1000;
        
        // Clear any existing sleep timer
        if (player.sleepTimer) {
            clearTimeout(player.sleepTimer);
        }
        
        // Set new sleep timer
        player.sleepTimer = setTimeout(() => {
            if (player && player.queue.current) {
                player.destroy();
                
                // Try to send a message to the channel where the timer was set
                const channel = interaction.channel;
                if (channel) {
                    channel.send('⏰ Sleep timer expired! Music has been stopped.');
                }
            }
        }, milliseconds);
        
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        let timeString;
        if (hours > 0) {
            const hourText = hours > 1 ? 'hours' : 'hour';
            timeString = `${hours} ${hourText}`;
            if (remainingMinutes > 0) {
                const minuteText = remainingMinutes > 1 ? 'minutes' : 'minute';
                timeString += ` and ${remainingMinutes} ${minuteText}`;
            }
        } else {
            const minuteText = minutes > 1 ? 'minutes' : 'minute';
            timeString = `${minutes} ${minuteText}`;
        }
        
        await interaction.reply({
            content: `⏰ Sleep timer set for **${timeString}**. Music will automatically stop after this time.`,
            ephemeral: false
        });
    },
};