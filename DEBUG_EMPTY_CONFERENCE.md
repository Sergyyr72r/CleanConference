# Debug: Empty Conference Issue

## Problem
When joining a conference via guest link, you see an empty conference (no other participants).

## Possible Causes & Solutions

### Issue 1: Socket.io Not Connecting to Backend (Most Likely)

**Check Frontend Environment Variables on Render:**

1. Go to Render Dashboard → Your Frontend Service
2. Click "Environment" tab
3. Verify these variables exist:
   ```
   REACT_APP_API_URL=https://your-backend-url.onrender.com/api
   REACT_APP_SOCKET_URL=https://your-backend-url.onrender.com
   ```

4. **IMPORTANT**: Make sure `REACT_APP_SOCKET_URL` points to your **backend** URL, NOT the frontend URL!

5. If variables are missing or wrong:
   - Add/update them
   - Save changes
   - Redeploy the frontend service

**Verify Connection in Browser:**

1. Open your deployed app
2. Open Browser DevTools (F12)
3. Go to "Console" tab
4. Join a conference
5. Look for:
   - ✅ `User connected: [socket-id]` - Connection successful
   - ❌ Connection errors, CORS errors, or no socket connection - Problem found!

### Issue 2: Backend CORS Not Configured

**Check Backend Environment Variables:**

1. Go to Render Dashboard → Your Backend Service
2. Click "Environment" tab
3. Verify:
   ```
   CLIENT_URL=https://your-frontend-url.onrender.com
   ```
   (Should be your **frontend** URL)

4. Check backend logs:
   - Go to "Logs" tab
   - Look for CORS errors or connection issues

### Issue 3: Both Users Not in Same Room

**Test This:**

1. Open the conference link in **two different browser windows** (or incognito)
2. Both should join the same room
3. If they can see each other, the issue is that the original creator left

**Solution**: The person who creates the conference must STAY in the conference for others to join them.

### Issue 4: Socket Events Not Firing

**Check Browser Console for Errors:**

Common issues:
- `Failed to connect to socket.io`
- `CORS policy error`
- `404 on socket.io endpoint`
- No socket connection at all

**Quick Fix - Test Socket Connection:**

1. Open browser console
2. Join a conference
3. Type this to test:
   ```javascript
   // Check if socket exists
   // The socket should be connected
   ```
   
4. Look for socket events in Network tab:
   - Open "Network" tab in DevTools
   - Filter by "WS" (WebSocket)
   - Should see socket.io connection

## Quick Diagnostic Steps

### Step 1: Check Environment Variables

**Frontend on Render:**
- [ ] `REACT_APP_SOCKET_URL` is set to backend URL
- [ ] `REACT_APP_API_URL` is set to backend URL + `/api`
- [ ] Frontend has been redeployed after setting variables

**Backend on Render:**
- [ ] `CLIENT_URL` is set to frontend URL
- [ ] Backend has been redeployed after setting variables

### Step 2: Test Socket Connection

1. Open deployed app in browser
2. Open DevTools → Console
3. Join a conference
4. Should see: `User connected: [id]` in backend logs
5. If not, socket isn't connecting

### Step 3: Test with Two Windows

1. Open conference in Window 1
2. Open same conference in Window 2 (incognito)
3. They should see each other
4. If yes → original creator probably left
5. If no → connection issue

## Most Common Fix

**90% of the time, it's this:**

Frontend's `REACT_APP_SOCKET_URL` is not set correctly on Render.

**Fix:**
1. Go to Frontend Service on Render
2. Environment → Add/Update:
   ```
   REACT_APP_SOCKET_URL=https://your-actual-backend-url.onrender.com
   ```
   (Replace with your REAL backend URL from Render)

3. Save and redeploy

## Still Not Working?

Check these:

1. **Backend logs** on Render - look for errors
2. **Frontend console** in browser - look for connection errors  
3. **Network tab** - check if socket.io is connecting
4. **Both URLs** - make sure frontend and backend are both deployed and accessible

## Expected Behavior

When working correctly:
1. Person A creates conference → joins room
2. Person B opens guest link → joins same room
3. Backend sends `existing-users` to Person B with Person A's info
4. WebRTC connection starts between them
5. Both see each other's video

If Person A leaves before Person B joins, Person B will see an empty room (this is normal - the room is empty).

