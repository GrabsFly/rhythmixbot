require('dotenv').config();

// Generate bot invite URL with proper scopes
const generateInviteURL = () => {
    const clientId = process.env.CLIENT_ID;
    
    if (!clientId) {
        console.log('❌ CLIENT_ID not found in .env file');
        return;
    }
    
    // Permissions breakdown:
    // 3148800 = Send Messages + Use Slash Commands + Connect + Speak + Use Voice Activity
    const permissions = '3148800';
    const scopes = 'bot%20applications.commands'; // bot + applications.commands
    
    const inviteURL = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=${scopes}`;
    
    console.log('🔗 Bot Invite URL:');
    console.log('=' .repeat(50));
    console.log(inviteURL);
    console.log('=' .repeat(50));
    console.log('');
    console.log('📋 Required Scopes:');
    console.log('  ✅ bot - Basic bot functionality');
    console.log('  ✅ applications.commands - Slash commands support');
    console.log('');
    console.log('🔧 Permissions Included:');
    console.log('  ✅ Send Messages');
    console.log('  ✅ Use Slash Commands');
    console.log('  ✅ Connect to Voice');
    console.log('  ✅ Speak in Voice');
    console.log('  ✅ Use Voice Activity');
    console.log('');
    console.log('⚠️  IMPORTANT:');
    console.log('   If your bot is already in servers, you need to:');
    console.log('   1. Use this URL to re-invite the bot to existing servers');
    console.log('   2. This will update the bot\'s permissions and scopes');
    console.log('   3. Slash commands should appear immediately after re-invite');
};

generateInviteURL();