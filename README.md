# Discord Music Bot 🎵

A powerful Discord music bot built with Discord.js and Lavalink 4.1.1, supporting YouTube, Spotify, and SoundCloud playback.

## Features ✨

- 🎵 **Multi-Platform Support**: YouTube, Spotify, and SoundCloud
- 🎛️ **Advanced Controls**: Play, pause, skip, stop, volume control
- 📋 **Queue Management**: View queue, skip multiple tracks, shuffle
- 🔊 **High-Quality Audio**: Powered by Lavalink 4.1.1
- ⚡ **Slash Commands**: Modern Discord slash command interface
- 🎯 **Smart Search**: Automatic platform detection from URLs
- 📊 **Rich Embeds**: Beautiful and informative message displays
- 🔄 **Auto-Reconnect**: Robust connection handling

## Commands 🎮

| Command | Description | Options |
|---------|-------------|----------|
| `/play <query>` | Play music from YouTube, Spotify, or SoundCloud | `query`: Song name, URL, or search term |
| `/pause` | Pause or resume the current track | None |
| `/skip [amount]` | Skip the current track or multiple tracks | `amount`: Number of tracks to skip (1-10) |
| `/stop` | Stop music and clear the queue | None |
| `/queue [page]` | Display the current music queue | `page`: Page number to display |
| `/nowplaying [action]` | Show current track info or lyrics | `action`: 'info' or 'lyrics' |
| `/volume [level]` | Control or view the volume | `level`: Volume level (0-100) |
| `/disconnect` | Disconnect bot from voice channel | None |

## Prerequisites 📋

- **Node.js** 18.0.0 or higher
- **Java** 17 or higher (for Lavalink)
- **Discord Bot Token** and **Application ID**
- **Lavalink 4.1.1** server

## Installation 🚀

### 1. Clone or Download

Download this project to your local machine.

### 2. Install Dependencies

```bash
npm install
```

### 3. Quick Start Scripts

For easier bot management, use the included startup scripts:

#### JavaScript Scripts (Recommended - Cross-platform)
```bash
# Start both Lavalink and the bot
npm run start-all
# or
node start.js

# Start only the bot (if Lavalink is already running)
npm run start-bot
# or
node start-bot.js
```

#### Platform-specific Scripts

##### Windows
```bash
# Start both Lavalink and the bot
start.bat
# or
powershell -ExecutionPolicy Bypass -File start.ps1
```

### 4. Set Up Lavalink

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

### 4. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your configuration:
   ```env
   # Discord Bot Configuration
   DISCORD_TOKEN=your_discord_bot_token_here
   CLIENT_ID=your_bot_client_id_here
   
   # Lavalink Configuration (default values work with included config)
   LAVALINK_HOST=localhost
   LAVALINK_PORT=2333
   LAVALINK_PASSWORD=youshallnotpass
   LAVALINK_SECURE=false
   
   # Optional: Spotify API for better metadata
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   
   # Bot Settings
   PREFIX=!
   DEFAULT_VOLUME=50
   MAX_QUEUE_SIZE=100
   ```

### 5. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the bot token to your `.env` file
5. Copy the Application ID to your `.env` file
6. Enable the following bot permissions:
   - Send Messages
   - Use Slash Commands
   - Connect
   - Speak
   - Use Voice Activity

### 6. Invite Bot to Server

Use this URL template (replace `YOUR_CLIENT_ID`):
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=3148800&scope=bot%20applications.commands
```

### 7. Deploy Slash Commands

```bash
node deploy-commands.js
```

### 8. Start the Bot

#### Recommended: Use JavaScript Startup Scripts

```bash
# Start both Lavalink and bot automatically (cross-platform)
npm run start-all

# Start only the bot (if Lavalink is already running)
npm run start-bot
```

##### Alternative: Platform-specific Scripts

###### Windows
```bash
# Batch script
start.bat

# PowerShell script (more reliable)
powershell -ExecutionPolicy Bypass -File start.ps1
```

#### Manual Startup (Alternative)

##### Start Lavalink Server First
```bash
java -jar Lavalink.jar
```

##### Then Start the Bot
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

## Usage 🎯

### Basic Usage

1. Join a voice channel
2. Use `/play <song name>` to start playing music
3. Use other commands to control playback

### Supported URL Formats

- **YouTube**: `https://youtube.com/watch?v=...` or `https://youtu.be/...`
- **Spotify**: `https://open.spotify.com/track/...` or `https://open.spotify.com/playlist/...`
- **SoundCloud**: `https://soundcloud.com/...`

### Search Examples

```
/play Never Gonna Give You Up
/play https://youtube.com/watch?v=dQw4w9WgXcQ
/play https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8
/play https://soundcloud.com/rickastleyofficial/never-gonna-give-you-up-4
```

## Configuration ⚙️

### Lavalink Settings

The `application.yml` file includes optimized settings for:
- YouTube plugin with multiple client types
- SoundCloud support
- Spotify metadata (requires API keys)
- Performance optimizations
- Logging configuration

### Bot Settings

Customize bot behavior in `.env`:
- `DEFAULT_VOLUME`: Starting volume (0-100)
- `MAX_QUEUE_SIZE`: Maximum tracks in queue
- `PREFIX`: Prefix for text commands (if implemented)

## Troubleshooting 🔧

### Common Issues

**Bot doesn't respond to commands:**
- Ensure slash commands are deployed: `node deploy-commands.js`
- Check bot permissions in Discord server
- Verify bot token in `.env`

**No audio playback:**
- Ensure Lavalink is running and accessible
- Check Lavalink password in `.env`
- Verify bot has voice permissions

**YouTube playback issues:**
- YouTube may block requests; try using different client types
- Check Lavalink logs for specific errors
- Consider using YouTube API key (optional)

**Spotify tracks not playing:**
- Spotify URLs are converted to YouTube searches
- Add Spotify API credentials for better metadata
- Some tracks may not be available on YouTube

### Logs

Check logs for debugging:
- **Bot logs**: Console output when running the bot
- **Lavalink logs**: `./logs/` directory (if configured)

## Development 🛠️

### Project Structure

```
discord-music-bot/
├── commands/           # Slash command files
│   ├── play.js
│   ├── pause.js
│   ├── skip.js
│   └── ...
├── index.js           # Main bot file
├── deploy-commands.js # Command deployment script
├── application.yml    # Lavalink configuration
├── package.json       # Dependencies and scripts
├── .env.example       # Environment template
└── README.md         # This file
```

### Adding New Commands

1. Create a new file in `commands/` directory
2. Follow the existing command structure
3. Run `node deploy-commands.js` to update slash commands
4. Restart the bot

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_TOKEN` | Discord bot token | ✅ |
| `CLIENT_ID` | Discord application ID | ✅ |
| `LAVALINK_HOST` | Lavalink server host | ✅ |
| `LAVALINK_PORT` | Lavalink server port | ✅ |
| `LAVALINK_PASSWORD` | Lavalink server password | ✅ |
| `LAVALINK_SECURE` | Use HTTPS for Lavalink | ❌ |
| `SPOTIFY_CLIENT_ID` | Spotify API client ID | ❌ |
| `SPOTIFY_CLIENT_SECRET` | Spotify API client secret | ❌ |
| `PREFIX` | Text command prefix | ❌ |
| `DEFAULT_VOLUME` | Default playback volume | ❌ |
| `MAX_QUEUE_SIZE` | Maximum queue size | ❌ |

## Contributing 🤝

Contributions are welcome! Please feel free to submit issues and pull requests.

## License 📄

This project is licensed under the MIT License.

## Support 💬

If you need help:
1. Check this README for common solutions
2. Review the troubleshooting section
3. Check Discord.js and Lavalink documentation
4. Create an issue with detailed information

---

**Enjoy your music bot! 🎵**