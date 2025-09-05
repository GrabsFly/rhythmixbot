require('dotenv').config();
const { PermissionFlagsBits } = require('discord.js');

/**
 * Discord Music Bot Invite URL Generator
 * Generates a comprehensive invite URL with all necessary permissions
 */

class InviteGenerator {
    constructor() {
        this.clientId = process.env.CLIENT_ID;
        this.validateEnvironment();
    }

    validateEnvironment() {
        if (!this.clientId) {
            console.error('❌ Error: CLIENT_ID not found in .env file');
            console.log('💡 Please add CLIENT_ID=your_bot_client_id to your .env file');
            process.exit(1);
        }
    }

    /**
     * Calculate required permissions for the music bot
     */
    calculatePermissions() {
        const permissions = [
            // Basic bot permissions
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.AddReactions,
            PermissionFlagsBits.UseExternalEmojis,
            
            // Voice permissions
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.UseVAD,
            PermissionFlagsBits.PrioritySpeaker,
            
            // Slash command permissions
            PermissionFlagsBits.UseApplicationCommands,
            
            // Optional but recommended
            PermissionFlagsBits.ManageMessages, // For cleaning up bot messages
            PermissionFlagsBits.MentionEveryone, // For announcements
        ];

        // Calculate the total permission value
        return permissions.reduce((total, permission) => total | permission, 0n).toString();
    }

    /**
     * Generate the invite URL with proper scopes and permissions
     */
    generateInviteURL() {
        const permissions = this.calculatePermissions();
        const scopes = 'bot%20applications.commands'; // bot + applications.commands
        
        return `https://discord.com/api/oauth2/authorize?client_id=${this.clientId}&permissions=${permissions}&scope=${scopes}`;
    }

    /**
     * Generate a minimal invite URL with basic permissions only
     */
    generateMinimalInviteURL() {
        const basicPermissions = [
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.UseApplicationCommands
        ];
        
        const permissions = basicPermissions.reduce((total, permission) => total | permission, 0n).toString();
        const scopes = 'bot%20applications.commands';
        
        return `https://discord.com/api/oauth2/authorize?client_id=${this.clientId}&permissions=${permissions}&scope=${scopes}`;
    }

    /**
     * Display the invite URLs and information
     */
    displayInviteInfo() {
        const fullInviteURL = this.generateInviteURL();
        const minimalInviteURL = this.generateMinimalInviteURL();

        console.log('\n🎵 Discord Music Bot - Invite URL Generator');
        console.log('=' .repeat(60));
        
        console.log('\n🔗 RECOMMENDED INVITE URL (Full Permissions):');
        console.log('-'.repeat(50));
        console.log(fullInviteURL);
        
        console.log('\n🔗 MINIMAL INVITE URL (Basic Permissions):');
        console.log('-'.repeat(50));
        console.log(minimalInviteURL);
        
        console.log('\n📋 SCOPES INCLUDED:');
        console.log('  ✅ bot - Basic bot functionality');
        console.log('  ✅ applications.commands - Slash commands support');
        
        console.log('\n🔧 FULL PERMISSIONS BREAKDOWN:');
        console.log('  📝 Text Permissions:');
        console.log('     • Send Messages');
        console.log('     • Read Message History');
        console.log('     • View Channels');
        console.log('     • Embed Links');
        console.log('     • Attach Files');
        console.log('     • Add Reactions');
        console.log('     • Use External Emojis');
        console.log('     • Manage Messages (cleanup)');
        console.log('     • Mention Everyone (announcements)');
        
        console.log('  🎤 Voice Permissions:');
        console.log('     • Connect to Voice Channels');
        console.log('     • Speak in Voice Channels');
        console.log('     • Use Voice Activity Detection');
        console.log('     • Priority Speaker');
        
        console.log('  ⚡ Application Permissions:');
        console.log('     • Use Application Commands (Slash Commands)');
        
        console.log('\n💡 SETUP INSTRUCTIONS:');
        console.log('  1. Copy the RECOMMENDED invite URL above');
        console.log('  2. Paste it in your browser');
        console.log('  3. Select the server you want to add the bot to');
        console.log('  4. Review and confirm the permissions');
        console.log('  5. Click "Authorize"');
        
        console.log('\n⚠️  IMPORTANT NOTES:');
        console.log('  • If your bot is already in servers, use the invite URL to update permissions');
        console.log('  • Slash commands may take up to 1 hour to appear globally');
        console.log('  • The bot needs to be online for commands to work');
        console.log('  • For prefix commands, enable "Message Content Intent" in Discord Developer Portal');
        
        console.log('\n🔧 TROUBLESHOOTING:');
        console.log('  • Bot not responding? Check if it\'s online and has proper permissions');
        console.log('  • Slash commands not showing? Wait up to 1 hour or re-invite the bot');
        console.log('  • Voice issues? Ensure the bot has Connect and Speak permissions');
        console.log('  • Prefix commands not working? Enable Message Content Intent or use @bot mentions');
        
        console.log('\n🎯 QUICK LINKS:');
        console.log('  • Discord Developer Portal: https://discord.com/developers/applications');
        console.log('  • Bot Documentation: Check README.md and PREFIX_COMMANDS_GUIDE.md');
        console.log('  • Web Dashboard: http://localhost:3001/ (when bot is running)');
        
        console.log('\n' + '=' .repeat(60));
        console.log('✅ Invite URLs generated successfully!');
        console.log('🚀 Ready to add your Discord Music Bot to servers!');
    }

    /**
     * Generate invite URLs for different permission levels
     */
    generateCustomInvite(permissionLevel = 'full') {
        switch (permissionLevel.toLowerCase()) {
            case 'minimal':
            case 'basic':
                return this.generateMinimalInviteURL();
            case 'full':
            case 'recommended':
            default:
                return this.generateInviteURL();
        }
    }
}

// Main execution
if (require.main === module) {
    try {
        const inviteGenerator = new InviteGenerator();
        
        // Check for command line arguments
        const args = process.argv.slice(2);
        
        if (args.includes('--help') || args.includes('-h')) {
            console.log('\n🎵 Discord Music Bot Invite Generator');
            console.log('\nUsage:');
            console.log('  node generate-invite.js [options]');
            console.log('\nOptions:');
            console.log('  --minimal, -m    Generate minimal permissions invite');
            console.log('  --full, -f       Generate full permissions invite (default)');
            console.log('  --help, -h       Show this help message');
            console.log('\nExamples:');
            console.log('  node generate-invite.js');
            console.log('  node generate-invite.js --minimal');
            console.log('  node generate-invite.js --full');
            process.exit(0);
        }
        
        if (args.includes('--minimal') || args.includes('-m')) {
            console.log('\n🔗 Minimal Invite URL:');
            console.log(inviteGenerator.generateCustomInvite('minimal'));
        } else if (args.includes('--full') || args.includes('-f')) {
            console.log('\n🔗 Full Permissions Invite URL:');
            console.log(inviteGenerator.generateCustomInvite('full'));
        } else {
            // Default: show all information
            inviteGenerator.displayInviteInfo();
        }
        
    } catch (error) {
        console.error('❌ Error generating invite URL:', error.message);
        process.exit(1);
    }
}

// Export for use in other modules
module.exports = InviteGenerator;