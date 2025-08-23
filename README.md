# Discord Music Bot 🎵

A feature-rich Discord music bot built with Discord.js v14 and Lavalink 4.1.1, offering seamless music playback from multiple platforms with an intuitive web dashboard.

## ✨ Features

### 🎵 **Multi-Platform Music Support**
- **YouTube** - Direct playback and search
- **Spotify** - Track and playlist support (converted to YouTube)
- **SoundCloud** - Full track and playlist support
- **Apple Music** - Basic support via search conversion

### 🎛️ **Advanced Audio Controls**
- Play, pause, skip, stop, and volume control
- Queue management with shuffle and repeat modes
- High-quality audio streaming via Lavalink
- Auto-skip on track errors
- Position seeking and track looping

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
- User permission levels (Owner, Admin, DJ, User)
- Customizable bot behavior per server
- Comprehensive logging and error handling
- Auto-reconnection and failover support

## 🎮 Commands

### Music Commands
| Command | Description | Usage |
|---------|-------------|-------|
| `/play <query>` | Play music from any supported platform | `/play Never Gonna Give You Up` |
| `/pause` | Pause or resume current track | `/pause` |
| `/skip [amount]` | Skip current track or multiple tracks | `/skip 3` |
| `/stop` | Stop playback and clear queue | `/stop` |
| `/queue [page]` | Display current music queue | `/queue 2` |
| `/nowplaying [action]` | Show current track info or lyrics | `/nowplaying lyrics` |
| `/volume [level]` | Set or view current volume (0-100) | `/volume 75` |
| `/shuffle` | Shuffle the current queue | `/shuffle` |
| `/repeat [mode]` | Set repeat mode (off/track/queue) | `/repeat track` |
| `/seek <position>` | Seek to specific position in track | `/seek 1:30` |
| `/disconnect` | Disconnect from voice channel | `/disconnect` |

### Utility Commands
| Command | Description | Usage |
|---------|-------------|-------|
| `/help` | Display help information | `/help` |
| `/ping` | Check bot latency | `/ping` |
| `/settings` | View or modify server settings | `/settings` |

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
   WEB_PORT=3000
   WEB_HOST=localhost
   
   # Database Configuration (SQLite by default)
   DB_TYPE=sqlite
   DB_PATH=./database.sqlite
   
   # Optional: External Database (PostgreSQL/MySQL)
   # DB_TYPE=postgres
   # DB_HOST=localhost
   # DB_PORT=5432
   # DB_NAME=musicbot
   # DB_USER=username
   # DB_PASS=password
   
   # Optional: Spotify API (for better metadata)
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   
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

### 5. Lavalink Setup

#### Option A: Download Lavalink JAR
1. Download Lavalink 4.1.1 from [GitHub Releases](https://github.com/lavalink-devs/Lavalink/releases)
2. Place the JAR file in your project directory
3. The `application.yml` file is already configured

#### Option B: Use Docker
```bash
docker run -d --name lavalink \
  -p 2333:2333 \
  -v $(pwd)/application.yml:/opt/Lavalink/application.yml \
  ghcr.io/lavalink-devs/lavalink:4.1.1
```

### 6. Deploy Commands and Start

```bash
# Deploy slash commands
node deploy-commands.js

# Start the bot (recommended - starts both Lavalink and bot)
npm run start-all

# Alternative: Start components separately
# Terminal 1: Start Lavalink
java -jar Lavalink.jar

# Terminal 2: Start the bot
npm start
```

### 7. Access Web Dashboard

Once the bot is running, access the web dashboard at:
```
http://localhost:3000
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

### 👥 **User Management**
- Permission-based access control
- Role assignments (Owner, Admin, DJ, User)
- Activity logging and user statistics

### 📊 **Analytics Dashboard**
- Track playback statistics
- Popular songs and artists
- Server usage metrics
- Performance monitoring

## 🔧 Configuration

### Lavalink Configuration

The `application.yml` includes optimized settings:
- Multiple YouTube client types for reliability
- SoundCloud and Spotify plugin support
- Performance optimizations for high-load scenarios
- Comprehensive logging configuration

### Database Configuration

Supported database types:
- **SQLite** (default) - No additional setup required
- **PostgreSQL** - For production deployments
- **MySQL/MariaDB** - Alternative production option

### Permission System

The bot includes a flexible permission system:
- **Owner** - Full access to all features
- **Admin** - Server management and advanced controls
- **DJ** - Music control and queue management
- **User** - Basic music commands

## 🎯 Usage Examples

### Basic Music Playback
```
/play Never Gonna Give You Up
/play https://youtube.com/watch?v=dQw4w9WgXcQ
/play https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8
/play https://soundcloud.com/rickastleyofficial/never-gonna-give-you-up-4
```

### Advanced Queue Management
```
/play playlist https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
/shuffle
/repeat queue
/skip 3
/seek 2:15
```

### Web Dashboard Usage
1. Navigate to `http://localhost:3000`
2. Select your Discord server
3. Join a voice channel in Discord
4. Use the web interface to control music playback

## 🛠️ Development

### Project Structure
```
discord-music-bot/
├── commands/              # Slash command implementations
│   ├── music/            # Music-related commands
│   ├── utility/          # Utility commands
│   └── admin/            # Administrative commands
├── events/               # Discord.js event handlers
├── models/               # Database models
├── public/               # Web dashboard static files
├── routes/               # Web API routes
├── utils/                # Utility functions
├── web-server.js         # Express web server
├── database.js           # Database connection and setup
├── index.js              # Main bot entry point
├── deploy-commands.js    # Command deployment script
├── application.yml       # Lavalink configuration
└── package.json          # Dependencies and scripts
```

### Available Scripts
```bash
npm start              # Start the bot
npm run dev            # Start with auto-restart (nodemon)
npm run start-all      # Start both Lavalink and bot
npm run start-bot      # Start only the bot
npm run deploy         # Deploy slash commands
npm run lint           # Run ESLint
npm run test           # Run tests
```

### Adding New Features

1. **New Commands**: Add files to `commands/` directory
2. **Web Features**: Modify `public/` files and add routes in `routes/`
3. **Database Models**: Add new models in `models/` directory
4. **Event Handlers**: Add new events in `events/` directory

## 🔍 Troubleshooting

### Common Issues

**Bot doesn't respond to commands:**
- Deploy slash commands: `node deploy-commands.js`
- Check bot permissions in Discord server
- Verify bot token in `.env`
- Ensure bot is online and connected

**No audio playback:**
- Verify Lavalink is running: `http://localhost:2333`
- Check Lavalink password in `.env`
- Ensure bot has voice permissions
- Check voice channel region compatibility

**Web dashboard not accessible:**
- Verify web server is running on correct port
- Check firewall settings
- Ensure no port conflicts
- Check console for web server errors

**Database connection issues:**
- Verify database credentials in `.env`
- Ensure database server is running (for external DBs)
- Check file permissions for SQLite
- Review database logs for specific errors

**YouTube playback issues:**
- YouTube may block requests; try different client types
- Check Lavalink logs for specific errors
- Consider using YouTube API key (optional)
- Try alternative search terms

**Spotify tracks not playing:**
- Spotify URLs are converted to YouTube searches
- Add Spotify API credentials for better metadata
- Some tracks may not be available on YouTube
- Check track availability in your region

### Debug Mode

Enable debug logging by setting in `.env`:
```env
DEBUG=true
LOG_LEVEL=debug
```

### Log Files

Check logs for debugging:
- **Bot logs**: Console output and `./logs/bot.log`
- **Lavalink logs**: `./logs/lavalink.log`
- **Web server logs**: `./logs/web.log`
- **Database logs**: `./logs/database.log`

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Development Guidelines

- Follow existing code style and conventions
- Add JSDoc comments for new functions
- Update documentation for new features
- Test thoroughly before submitting

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🆘 Support

Need help? Here's how to get support:

1. **Check Documentation**: Review this README and inline code comments
2. **Search Issues**: Look through existing GitHub issues
3. **Create Issue**: Submit a detailed bug report or feature request
4. **Community**: Join our Discord server for community support

### When Reporting Issues

Please include:
- Bot version and Node.js version
- Operating system
- Detailed error messages
- Steps to reproduce the issue
- Relevant log files

## 🎵 Enjoy Your Music Bot!

Thank you for using Discord Music Bot! We hope you enjoy seamless music playback in your Discord servers.

---

**Made with ❤️ for the Discord community**
