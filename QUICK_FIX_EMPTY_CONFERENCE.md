# Quick Fix: Empty Conference

## Most Likely Issue: Socket.io Not Connecting

The frontend probably can't connect to the backend because `REACT_APP_SOCKET_URL` isn't set correctly on Render.

## Quick Fix Steps:

### Step 1: Check Frontend Environment Variables

1. Go to Render Dashboard
2. Click your **Frontend Service** (`cleanconference-1`)
3. Go to "Environment" tab
4. **Check if these exist:**
   ```
   REACT_APP_API_URL=https://your-backend-url.onrender.com/api
   REACT_APP_SOCKET_URL=https://your-backend-url.onrender.com
   ```

5. **If they're missing or wrong:**
   - Click "Add Environment Variable" (or edit existing)
   - Set `REACT_APP_SOCKET_URL` to your **backend URL** (not frontend!)
   - Example: `https://meet-backend-xyz.onrender.com`
   - Set `REACT_APP_API_URL` to backend URL + `/api`
   - Example: `https://meet-backend-xyz.onrender.com/api`
   - Save changes

6. **Redeploy** the frontend service:
   - Go to "Manual Deploy" → "Deploy latest commit"
   - Or just save - it may auto-redeploy

### Step 2: Check Backend CORS

1. Go to your **Backend Service** on Render
2. "Environment" tab
3. Verify `CLIENT_URL` is set to your **frontend URL**:
   ```
   CLIENT_URL=https://cleanconference-1.onrender.com
   ```
4. If wrong, update and redeploy backend

### Step 3: Test the Connection

1. Open your deployed app: `https://cleanconference-1.onrender.com`
2. Open Browser DevTools (F12)
3. Go to "Console" tab
4. Create or join a conference
5. **Look for:**
   - ✅ No errors = Good!
   - ❌ `Failed to connect` or `CORS error` = Connection problem

### Step 4: Test with Two Windows

**This will tell you if it's a connection issue or just empty room:**

1. **Window 1**: Create a conference (stay in it!)
2. **Window 2** (incognito): Open the guest-join link
3. **Result:**
   - ✅ They see each other = Working! (original creator probably left)
   - ❌ Still empty = Connection issue (needs fix)

## Common Mistake

People often set:
```
REACT_APP_SOCKET_URL=https://cleanconference-1.onrender.com  ❌ WRONG
```

Should be:
```
REACT_APP_SOCKET_URL=https://your-backend-url.onrender.com  ✅ CORRECT
```

## Quick Checklist

- [ ] Frontend has `REACT_APP_SOCKET_URL` set to **backend** URL
- [ ] Frontend has `REACT_APP_API_URL` set to **backend** URL + `/api`
- [ ] Backend has `CLIENT_URL` set to **frontend** URL
- [ ] Both services redeployed after setting variables
- [ ] Tested with two browser windows simultaneously

## Still Empty?

If you test with two windows and they still don't see each other:

1. **Check backend logs** on Render - look for connection errors
2. **Check browser console** - look for socket.io connection errors
3. **Verify backend URL** - make sure it's actually running and accessible

The issue is almost always environment variables not being set correctly on Render! 🔧


