# Discord Music Bot 🎵

A feature-rich Discord music bot built with Discord.js v14 and Lavalink, offering seamless music playback from multiple platforms with an intuitive web dashboard.

## ✨ Features

### 🎵 **Multi-Platform Music Support**
- **YouTube** - Direct playback and search
- **Spotify** - Track and playlist support (converted to YouTube)
- **SoundCloud** - Full track and playlist support
- **Apple Music** - Basic support via search conversion

### 🎛️ **Advanced Audio Controls**
- Play, pause, skip, stop, and volume control
- Queue management with advanced features
- High-quality audio streaming via Lavalink
- Position seeking and track manipulation
- 24/7 mode for continuous presence

### 🌐 **Web Dashboard**
- Modern web interface for music control
- Real-time queue visualization
- Server settings management
- User permission system
- Mobile-responsive design

### ⚡ **Modern Discord Integration**
- Slash commands with autocomplete
- Rich embed messages with track information
- Voice channel auto-join and smart disconnect
- Multi-server support with isolated queues

### 🔧 **Advanced Features**
- Database integration for persistent settings
- Customizable bot behavior per server
- Comprehensive logging and error handling
- Auto-reconnection and failover support

## 🎮 Commands

### 🎵 Music Commands
| Command | Description | Usage |
|---------|-------------|-------|
| `/play <query>` | Play music from any supported platform | `/play Never Gonna Give You Up` |
| `/playtop <query>` | Add song to the top of the queue | `/playtop My Favorite Song` |
| `/pause` | Pause or resume current track | `/pause` |
| `/stop` | Stop playback and clear queue | `/stop` |
| `/skip [amount]` | Skip current track or multiple tracks | `/skip 3` |
| `/queue [page]` | Display current music queue | `/queue 2` |
| `/nowplaying` | Show current track information | `/nowplaying` |
| `/volume [level]` | Set or view current volume (0-100) | `/volume 75` |
| `/seek <position>` | Jump to specific time in current song | `/seek 1:30` |
| `/rewind <seconds>` | Rewind current song by specified seconds | `/rewind 30` |

### 🎛️ Queue Management
| Command | Description | Usage |
|---------|-------------|-------|
| `/clearqueue` | Clear the entire music queue | `/clearqueue` |
| `/remove <position>` | Remove a specific song from queue | `/remove 3` |
| `/removedupes` | Remove duplicate songs from queue | `/removedupes` |
| `/move <from> <to>` | Move a song to different position in queue | `/move 5 1` |

### 🔊 Voice Channel Commands
| Command | Description | Usage |
|---------|-------------|-------|
| `/join` | Make bot join your voice channel | `/join` |
| `/leave` | Make bot leave voice channel | `/leave` |
| `/summon` | Summon bot to your voice channel | `/summon` |
| `/disconnect` | Disconnect from voice channel | `/disconnect` |
| `/247` | Enable/disable 24/7 mode | `/247 enable` |

### 🎵 Playlist Commands
| Command | Description | Usage |
|---------|-------------|-------|
| `/playlist create <name>` | Create a new playlist | `/playlist create My Favorites` |
| `/playlist add <name> <query>` | Add song to playlist | `/playlist add My Favorites Never Gonna Give You Up` |
| `/playlist play <name>` | Play entire playlist | `/playlist play My Favorites` |
| `/playlist list` | Show all your playlists | `/playlist list` |

### ⚙️ Settings & Configuration
| Command | Description | Usage |
|---------|-------------|-------|
| `/settings` | View or modify server settings | `/settings` |
| `/defaultvolume [level]` | Set default volume for the server | `/defaultvolume 50` |
| `/sleeptimer <minutes>` | Set timer to stop music after specified time | `/sleeptimer 30` |
| `/help` | Display help information and commands | `/help` |

## 📋 Prerequisites

- **Node.js** 18.0.0 or higher
- **Java** 17 or higher (for Lavalink)
- **Discord Bot Token** and **Application ID**
- **Database** (SQLite included, PostgreSQL/MySQL optional)

## 🚀 Quick Start

### 1. Download and Setup

```bash
# Clone or download the project
git clone <repository-url>
cd discord-music-bot

# Install dependencies
npm install
```

### 2. Environment Configuration

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your configuration:
   ```env
   # Discord Bot Configuration
   DISCORD_TOKEN=your_discord_bot_token_here
   CLIENT_ID=your_bot_client_id_here
   
   # Lavalink Configuration
   LAVALINK_HOST=localhost
   LAVALINK_PORT=2333
   LAVALINK_PASSWORD=youshallnotpass
   LAVALINK_SECURE=false
   
   # Web Dashboard Configuration
   WEB_PORT=3001
   WEB_HOST=localhost
   
   # Database Configuration (SQLite by default)
   DB_TYPE=sqlite
   DB_PATH=./database.sqlite
   
   # Bot Settings
   DEFAULT_VOLUME=50
   MAX_QUEUE_SIZE=100
   AUTO_LEAVE_TIMEOUT=300000
   ```

### 3. Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Navigate to "Bot" section and create a bot
4. Copy the bot token to your `.env` file
5. Copy the Application ID to your `.env` file
6. Enable the following bot permissions:
   - Send Messages
   - Use Slash Commands
   - Connect
   - Speak
   - Use Voice Activity
   - Embed Links
   - Read Message History

### 4. Invite Bot to Server

Use this URL (replace `YOUR_CLIENT_ID`):
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=3148800&scope=bot%20applications.commands
```

### 5. Deploy Commands and Start

```bash
# Deploy slash commands
node deploy-commands.js

# Start the bot
node index.js
```

### 6. Access Web Dashboard

Once the bot is running, access the web dashboard at:
```
http://localhost:3001
```

## 🌐 Web Dashboard

The bot includes a comprehensive web dashboard featuring:

### 🎵 **Music Control Panel**
- Real-time queue management
- Play, pause, skip, and volume controls
- Search and add tracks directly from the web
- Current track information with progress bar

### ⚙️ **Server Settings**
- Configure bot behavior per server
- Set default volume and auto-leave timeout
- Manage user permissions and roles
- View server statistics and usage

### 📊 **Commands Reference**
- Complete list of all available commands
- Usage examples and descriptions
- Category-based organization

## 🎯 Usage Examples

### Basic Music Playback
```
/play Never Gonna Give You Up
/play https://youtube.com/watch?v=dQw4w9WgXcQ
/play https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8
/playtop My Favorite Song
```

### Advanced Queue Management
```
/clearqueue
/remove 3
/removedupes
/move 5 1
/seek 2:15
/rewind 30
```

### Voice Channel Control
```
/join
/summon
/247 enable
/sleeptimer 30
/leave
```

### Playlist Management
```
/playlist create My Favorites
/playlist add My Favorites Never Gonna Give You Up
/playlist play My Favorites
/playlist list
```

## 🔧 Configuration

### Server Settings

Use `/settings` to configure:
- Default volume level
- Auto-leave timeout
- 24/7 mode preferences
- User permissions

### Database Configuration

Supported database types:
- **SQLite** (default) - No additional setup required
- **PostgreSQL** - For production deployments
- **MySQL/MariaDB** - Alternative production option

## 🛠️ Development

### Project Structure
```
discord-music-bot/
├── commands/              # Slash command implementations
├── public/               # Web dashboard static files
├── models/               # Database models
├── web-server.js         # Express web server
├── database.js           # Database connection and setup
├── index.js              # Main bot entry point
├── deploy-commands.js    # Command deployment script
└── package.json          # Dependencies and scripts
```

### Available Scripts
```bash
node index.js          # Start the bot
node deploy-commands.js # Deploy slash commands
```

## 🔍 Troubleshooting

### Common Issues

**Bot doesn't respond to commands:**
- Deploy slash commands: `node deploy-commands.js`
- Check bot permissions in Discord server
- Verify bot token in `.env`
- Ensure bot is online and connected

**No audio playback:**
- Verify Lavalink is running
- Check Lavalink password in `.env`
- Ensure bot has voice permissions
- Check voice channel region compatibility

**Web dashboard not accessible:**
- Verify web server is running on port 3001
- Check firewall settings
- Ensure no port conflicts
- Check console for web server errors

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

Need help? Here's how to get support:

1. **Check Documentation**: Review this README
2. **Search Issues**: Look through existing GitHub issues
3. **Create Issue**: Submit a detailed bug report or feature request

### When Reporting Issues

Please include:
- Bot version and Node.js version
- Operating system
- Detailed error messages
- Steps to reproduce the issue

## 🎵 Enjoy Your Music Bot!

Thank you for using Discord Music Bot! We hope you enjoy seamless music playback in your Discord servers.

---

**Made with ❤️ for the Discord community**
