# Agora SDK Setup Guide

This application now uses Agora SDK for video conferencing instead of native WebRTC or PeerJS.

## Prerequisites

1. **Create an Agora Account**
   - Go to [https://www.agora.io/en/](https://www.agora.io/en/)
   - Sign up for a free account
   - Create a new project
   - Get your **App ID** from the project dashboard

2. **Install Dependencies**
   ```bash
   cd frontend
   npm install agora-rtc-react agora-rtc-sdk-ng
   ```
   (Already done ✅)

## Configuration

### Step 1: Get Your Agora App ID

1. Log in to [Agora Console](https://console.agora.io/)
2. Navigate to **Projects** → **Create** (or select existing project)
3. Copy your **App ID**

### Step 2: Set Environment Variable

#### For Local Development:

Create a `.env` file in the `frontend` directory:

```bash
REACT_APP_AGORA_APP_ID=your_app_id_here
```

#### For Production (Render):

1. Go to your Render dashboard
2. Select your frontend service
3. Go to **Environment** tab
4. Add environment variable:
   - **Key**: ^
   - **Value**: Your Agora App ID

### Step 3: Restart Development Server

After setting the environment variable:

```bash
cd frontend
npm start
```

## How It Works

- **Channel-based**: All users join the same Agora channel (using `roomId`)
- **Automatic**: Agora handles all peer connections, signaling, and media routing
- **Reliable**: Uses Agora's global infrastructure for better connectivity
- **No TURN servers needed**: Agora provides built-in relay servers

## Features

✅ Video/Audio calling  
✅ Screen sharing  
✅ Mute/Unmute  
✅ Video on/off  
✅ Screen recording (local)  
✅ Chat (via Socket.io)  
✅ User list (via Socket.io)  

## Troubleshooting

### Error: "AGORA_APP_ID is not set"

Make sure you've set the `REACT_APP_AGORA_APP_ID` environment variable.

### Video not showing

1. Check browser console for errors
2. Verify camera/microphone permissions are granted
3. Check that Agora App ID is correct
4. Ensure you're using HTTPS in production (required by Agora)

### Connection issues

- Agora requires HTTPS in production
- Check firewall settings
- Verify App ID is correct

## Free Tier Limits

Agora's free tier includes:
- 10,000 minutes per month
- Up to 2 concurrent channels
- Standard video quality

For production use, consider upgrading to a paid plan.

## Migration Notes

- Removed: PeerJS, native WebRTC peer connections
- Kept: Socket.io for chat and user list management
- Changed: Video/audio now handled entirely by Agora




