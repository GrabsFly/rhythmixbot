# YouTube OAuth Setup Guide for Lavalink

This guide explains how to obtain OAuth tokens for YouTube authentication in Lavalink.

## Prerequisites

- Google account
- Access to Google Cloud Console
- Basic understanding of OAuth 2.0

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name (e.g., "Lavalink YouTube Bot")
4. Click "Create"

## Step 2: Enable YouTube Data API v3

1. In your project, go to "APIs & Services" → "Library"
2. Search for "YouTube Data API v3"
3. Click on it and press "Enable"

## Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" user type
3. Fill in required fields:
   - App name: "Lavalink YouTube Bot"
   - User support email: Your email
   - Developer contact: Your email
4. Click "Save and Continue"
5. Skip "Scopes" section (click "Save and Continue")
6. Add test users (your Google account email)
7. Click "Save and Continue"

## Step 4: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "+ Create Credentials" → "OAuth 2.0 Client IDs"
3. Choose "Desktop application"
4. Name it "Lavalink Client"
5. Click "Create"
6. **Save the Client ID and Client Secret** - you'll need these!

## Step 5: Get Authorization Code

1. Replace `YOUR_CLIENT_ID` in this URL with your actual Client ID:
```
https://accounts.google.com/o/oauth2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=https://www.googleapis.com/auth/youtube&response_type=code&access_type=offline&prompt=consent
```

2. Open the URL in your browser
3. Sign in with your Google account
4. Grant permissions to your app
5. Copy the authorization code from the page

## Step 6: Exchange Code for Tokens

Use this curl command (replace placeholders with your values):

```bash
curl -X POST https://oauth2.googleapis.com/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=YOUR_AUTHORIZATION_CODE" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=urn:ietf:wg:oauth:2.0:oob"
```

Or use PowerShell:

```powershell
$body = @{
    client_id = "YOUR_CLIENT_ID"
    client_secret = "YOUR_CLIENT_SECRET"
    code = "YOUR_AUTHORIZATION_CODE"
    grant_type = "authorization_code"
    redirect_uri = "urn:ietf:wg:oauth:2.0:oob"
}

$response = Invoke-RestMethod -Uri "https://oauth2.googleapis.com/token" -Method Post -Body $body
$response
```

## Step 7: Update application.yml

From the response, you'll get:
- `access_token`
- `refresh_token`
- `expires_in` (convert to timestamp)

Update your `application.yml`:

```yaml
oauth:
  enabled: true
  skipInitialization: false
  refreshToken: "YOUR_REFRESH_TOKEN"
  accessToken: "YOUR_ACCESS_TOKEN"
  tokenExpiry: 1234567890  # Current timestamp + expires_in
  persistTokens: true
  tokenFile: "./oauth-tokens.json"
```

## Step 8: Test the Setup

1. Start Lavalink
2. Check logs for OAuth initialization
3. Test YouTube playback

## Token Persistence

With `persistTokens: true`, Lavalink will:
- Save tokens to `oauth-tokens.json`
- Automatically refresh expired tokens
- Remember authentication across restarts

## Troubleshooting

### Common Issues:

1. **"invalid_grant" error**: Authorization code expired (valid for 10 minutes)
   - Get a new authorization code and try again

2. **"redirect_uri_mismatch"**: Make sure redirect URI is exactly `urn:ietf:wg:oauth:2.0:oob`

3. **"access_denied"**: Make sure you granted all permissions during OAuth flow

4. **Token refresh fails**: Check that refresh token is valid and hasn't been revoked

### Security Notes:

- Keep your Client Secret secure
- Don't share your tokens
- The `oauth-tokens.json` file is automatically added to `.gitignore`
- Tokens can be revoked at [Google Account Settings](https://myaccount.google.com/permissions)

## Alternative: Stick with poToken

If OAuth setup seems complex, your current `poToken` configuration is working well and is simpler to maintain. OAuth is mainly beneficial if you need:
- Higher rate limits
- Access to private playlists
- More robust long-term authentication

For most music bots, `poToken` is sufficient and easier to manage.