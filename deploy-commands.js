require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];

// Load all command files
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`✅ Loaded command: ${command.data.name}`);
    } else {
        console.log(`⚠️ [WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Deploy commands
(async () => {
    try {
        console.log(`🚀 Started refreshing ${commands.length} application (/) commands.`);

        // Check if CLIENT_ID is provided for global commands
        if (process.env.CLIENT_ID) {
            // Deploy global commands (takes up to 1 hour to update)
            const data = await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );
            
            console.log(`✅ Successfully reloaded ${data.length} global application (/) commands.`);
            console.log('ℹ️ Global commands may take up to 1 hour to appear in all servers.');
        } else {
            console.log('⚠️ CLIENT_ID not found in environment variables.');
            console.log('ℹ️ Add CLIENT_ID to your .env file to deploy global commands.');
        }
        
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
        
        if (error.code === 50001) {
            console.log('💡 Make sure your bot has the "applications.commands" scope enabled.');
        } else if (error.code === 401) {
            console.log('💡 Check if your DISCORD_TOKEN is correct and valid.');
        } else if (error.code === 403) {
            console.log('💡 Make sure your bot has permission to create slash commands in the target guild.');
        }
    }
})();

// Export commands for other uses
module.exports = { commands };