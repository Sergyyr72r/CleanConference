# Testing Guide - Video Conference App

Since the app runs on `localhost`, here are several ways to test it with multiple participants:

## Method 1: Use Browser Incognito/Private Window (Easiest)

This is the simplest way to test locally:

1. **Open first browser window** (regular mode):
   - Go to http://localhost:3000
   - Create a conference
   - Copy the conference link

2. **Open second browser window** (Incognito/Private mode):
   - Chrome: `Cmd+Shift+N` (Mac) or `Ctrl+Shift+N` (Windows)
   - Firefox: `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows)
   - Safari: `Cmd+Shift+N` (Mac)
   - Paste the conference link in the address bar
   - Enter a different name when prompted

3. **Test the conference**:
   - You should see both video feeds
   - Test chat functionality
   - Test recording

**Note**: Incognito windows have separate cookies, so they act as different users.

## Method 2: Use Different Browser

1. **Open Chrome** with one user
2. **Open Firefox/Safari** with another user
3. Both can join the same conference

## Method 3: Use ngrok (Expose to Internet)

This allows you to share the link with others or test from different devices on **different networks** (even over the internet).

**Note:** If you're just testing on another device on the **same Wi-Fi network**, Method 4 (Local Network IP) is much simpler and doesn't require signing up for any services.

### Step 1: Install ngrok:
```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

### Step 2: Set Up ngrok Authentication

ngrok requires a free account and authentication token:

1. **Sign up for a free ngrok account:**
   - Go to https://dashboard.ngrok.com/signup
   - Create an account (it's free)

2. **Get your authtoken:**
   - After signing up, go to https://dashboard.ngrok.com/get-started/your-authtoken
   - Copy your authtoken (it looks like: `2abc123def456ghi789jkl012mno345pq_6r7s8t9u0v1w2x3y4z5a6b7c8d9e0f`)

3. **Configure ngrok with your authtoken:**
   ```bash
   ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
   ```
   
   Replace `YOUR_AUTHTOKEN_HERE` with the authtoken you copied.

   **Example:**
   ```bash
   ngrok config add-authtoken 2abc123def456ghi789jkl012mno345pq_6r7s8t9u0v1w2x3y4z5a6b7c8d9e0f
   ```

### Step 3: Expose Your Local Server

Once authenticated, expose your frontend:

```bash
# Expose frontend (port 3000)
ngrok http 3000
```

This will display a screen with:
- **Forwarding URL**: Something like `https://abc123.ngrok.io -> http://localhost:3000`
- **Web Interface**: `http://127.0.0.1:4040` (for inspecting requests)

**Important:** Keep this terminal window open! Closing it will stop the ngrok tunnel.

### Step 4: Update Backend CORS Settings

1. **Copy the ngrok HTTPS URL** (e.g., `https://abc123.ngrok.io`)
   - Use the HTTPS URL (not HTTP)

2. **Create or update `backend/.env`:**
   ```bash
   cd backend
   touch .env  # if it doesn't exist
   ```
   
   Add to `backend/.env`:
   ```env
   CLIENT_URL=https://abc123.ngrok.io
   PORT=5001
   ```
   
   Replace `https://abc123.ngrok.io` with your actual ngrok URL.

3. **Create or update `frontend/.env`:**
   ```bash
   cd frontend
   touch .env  # if it doesn't exist
   ```
   
   Add to `frontend/.env`:
   ```env
   REACT_APP_API_URL=https://abc123.ngrok.io/api
   REACT_APP_SOCKET_URL=https://abc123.ngrok.io
   ```
   
   **Note:** For ngrok, you need to expose both ports or use separate tunnels.
   
   **Option A: Expose both ports separately (Recommended):**
   
   Terminal 1 (frontend):
   ```bash
   ngrok http 3000
   ```
   Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
   
   Terminal 2 (backend):
   ```bash
   ngrok http 5001
   ```
   Copy the HTTPS URL (e.g., `https://xyz789.ngrok.io`)
   
   Then use:
   - `backend/.env`: `CLIENT_URL=https://abc123.ngrok.io`
   - `frontend/.env`: `REACT_APP_API_URL=https://xyz789.ngrok.io/api` and `REACT_APP_SOCKET_URL=https://xyz789.ngrok.io`

   **Option B: Use ngrok with path forwarding (Advanced):**
   - Configure ngrok to forward different paths to different ports
   - Requires ngrok configuration file

4. **Restart the backend server** after updating `.env` files:
   ```bash
   # Stop the current server (Ctrl+C)
   # Then restart
   npm run dev
   ```

### Step 5: Use the ngrok URL

- **Share the ngrok URL** with others: `https://abc123.ngrok.io`
- They can join conferences using this URL from anywhere
- The conference links will use the ngrok URL automatically

### Important Notes:

- **Keep ngrok running**: The tunnel closes when you close the terminal or stop ngrok
- **Free tier limitations**: Free ngrok accounts have limitations (session timeout, random URLs)
- **URL changes**: Each time you restart ngrok, you get a new URL (unless you have a paid plan)
- **HTTPS required**: Always use the HTTPS URL (not HTTP) for security
- **Both ports needed**: You need to expose both port 3000 (frontend) and port 5001 (backend), or configure path forwarding

## Method 4: Use Local Network IP (Testing on Another Device)

This method allows you to test the conference on a different device (phone, tablet, or another computer) connected to the same Wi-Fi network.

**Quick Summary:**
1. Find your local IP address
2. Create `backend/.env` with `CLIENT_URL=http://YOUR_IP:3000`
3. Create `frontend/.env` with API and Socket URLs using your IP
4. Restart servers
5. Access `http://YOUR_IP:3000` from both devices
6. Test conference connection

**Detailed steps below:**

### Step-by-Step Instructions:

#### Step 1: Find Your Local IP Address

**On macOS/Linux:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**On Windows:**
```bash
ipconfig
```

Look for the IP address under your active network adapter (usually Wi-Fi or Ethernet). It will look something like: `192.168.1.100` or `192.168.0.105`

**Alternative (macOS):**
- Go to System Settings → Network
- Click on your active connection (Wi-Fi or Ethernet)
- Find your IP address listed there

#### Step 2: Configure Backend Environment Variables

1. **Create or edit `backend/.env` file:**
   ```bash
   cd backend
   touch .env
   ```

2. **Add your local IP address to the `.env` file:**
   ```env
   CLIENT_URL=http://YOUR_LOCAL_IP:3000
   PORT=5001
   ```
   
   **Example:**
   ```env
   CLIENT_URL=http://192.168.1.100:3000
   PORT=5001
   ```

   Replace `YOUR_LOCAL_IP` with the IP address you found in Step 1.

#### Step 3: Configure Frontend Environment Variables

1. **Create or edit `frontend/.env` file:**
   ```bash
   cd frontend
   touch .env
   ```

2. **Add environment variables to the `.env` file:**
   ```env
   REACT_APP_API_URL=http://YOUR_LOCAL_IP:5001/api
   REACT_APP_SOCKET_URL=http://YOUR_LOCAL_IP:5001
   ```
   
   **Example:**
   ```env
   REACT_APP_API_URL=http://192.168.1.100:5001/api
   REACT_APP_SOCKET_URL=http://192.168.1.100:5001
   ```

   Replace `YOUR_LOCAL_IP` with the IP address from Step 1.

#### Step 4: Restart the Servers

1. **Stop any running servers** (press `Ctrl+C` if they're running)

2. **Restart the development servers:**
   ```bash
   # From the project root directory
   npm run dev
   ```

   This will start:
   - Backend on `http://YOUR_LOCAL_IP:5001`
   - Frontend on `http://YOUR_LOCAL_IP:3000`

#### Step 5: Configure Firewall (if needed)

**On macOS:**
- Go to System Settings → Network → Firewall
- Make sure the firewall allows incoming connections for Node.js
- Or temporarily disable firewall for testing

**On Windows:**
- Windows Defender Firewall may block connections
- Allow Node.js through the firewall when prompted
- Or temporarily disable firewall for testing

#### Step 6: Access from Another Device

1. **Make sure both devices are on the same Wi-Fi network**

2. **On your other device (phone, tablet, or another computer):**
   - Open a web browser (Chrome, Safari, Firefox, etc.)
   - Navigate to: `http://YOUR_LOCAL_IP:3000`
   - Example: `http://192.168.1.100:3000`

3. **On your main computer:**
   - Also access: `http://YOUR_LOCAL_IP:3000` (or continue using localhost)

#### Step 7: Test the Conference

1. **On Device 1 (Main Computer):**
   - Go to `http://YOUR_LOCAL_IP:3000`
   - Click "Create Conference"
   - Enter a guest email (optional)
   - Click "Create Conference"
   - Copy the conference link (or note the URL)

2. **On Device 2 (Other Device):**
   - Open the conference link you copied
   - Or navigate to the same conference URL
   - Enter your name when prompted
   - Click "Join Conference"

3. **Verify the Connection:**
   - ✅ Both devices should see each other's video
   - ✅ Check participant list - should show only one entry per person (no duplicates)
   - ✅ Test chat - messages should appear on both devices
   - ✅ Check browser console - should not see "Called in wrong state: stable" errors

#### Step 8: Verify Fixes

**Test for Duplicate Participant Fix:**
- ✅ Participant list should show only one entry per user
- ✅ Your name should appear once as "(You)"
- ✅ Other participants should appear once each

**Test for WebRTC Error Fix:**
- ✅ Open browser console (F12 or right-click → Inspect → Console)
- ✅ Should NOT see: "Failed to set remote answer sdp: Called in wrong state: stable"
- ✅ Video connection should establish smoothly

**Test Full Functionality:**
- ✅ Video should stream in both directions
- ✅ Audio should work (allow microphone permissions)
- ✅ Chat messages should sync between devices
- ✅ Recording should work (test on main device)

#### Troubleshooting

**Can't access from other device:**
- ✅ Verify both devices are on the same Wi-Fi network
- ✅ Double-check the IP address is correct
- ✅ Make sure firewall allows connections
- ✅ Try accessing `http://YOUR_LOCAL_IP:5001` first to verify backend is accessible

**Connection refused errors:**
- ✅ Ensure backend is running: `http://YOUR_LOCAL_IP:5001/api`
- ✅ Check that `.env` files are created in both `backend/` and `frontend/` directories
- ✅ Restart servers after creating `.env` files

**Video not connecting:**
- ✅ Allow camera/microphone permissions on both devices
- ✅ Check browser console for errors
- ✅ Ensure STUN servers are accessible (not blocked by firewall)
- ✅ Try refreshing both browser windows

**Environment variables not working:**
- ✅ Make sure `.env` files are in the correct directories (`backend/` and `frontend/`)
- ✅ Restart servers after changing `.env` files
- ✅ For React, environment variables must start with `REACT_APP_`

**IP Address changed:**
- If your router assigns dynamic IPs, the IP might change
- Run Step 1 again to get the new IP
- Update `.env` files with the new IP
- Restart servers

## Method 5: Use Docker/VM

Run the app in a container or VM to simulate different environments.

## Quick Test Checklist

### Testing Locally (Incognito Window):
- [ ] Create conference in regular browser
- [ ] Copy conference link
- [ ] Open incognito window
- [ ] Paste link and join
- [ ] Verify both video feeds appear
- [ ] Test chat messages
- [ ] Test recording
- [ ] Test copy link button
- [ ] Test settings (name change)

### Testing on Another Device:
- [ ] Find local IP address
- [ ] Configure `backend/.env` with CLIENT_URL
- [ ] Configure `frontend/.env` with API and Socket URLs
- [ ] Restart servers
- [ ] Access from another device on same Wi-Fi
- [ ] Verify no duplicate participants in participant list
- [ ] Check browser console - no "Called in wrong state: stable" errors
- [ ] Test video connection between devices
- [ ] Test chat between devices
- [ ] Verify participant count is correct (no duplicates)

## Troubleshooting

### "Connection refused" errors:
- Make sure backend is running on port 5001
- Check CORS settings if using ngrok or network IP

### Video not showing:
- Allow camera/microphone permissions in browser
- Check browser console for errors
- Try different browser

### Can't join conference:
- Make sure you're using the correct room ID
- Check that both browser windows are using the same URL (localhost or ngrok)
- Clear browser cache if needed

## Recommended Testing Flow

1. **Start with Method 1** (Incognito window) - easiest for quick testing
2. **Use Method 3** (ngrok) - if you need to test with real devices or share with others
3. **Use Method 4** (Local network) - if testing on multiple devices on same Wi-Fi



