# Verify Your Deployment

## Your Frontend URL
`https://cleanconference-front.onrender.com`

## Quick Verification Checklist

### 1. Check if the App Loads
- ✅ Open: https://cleanconference-front.onrender.com
- ✅ Should see the home page
- ✅ No "Not Found" errors

### 2. Test Conference Creation
1. Click "Create Conference"
2. Enter guest email (optional)
3. Should navigate to conference page
4. Should see your own video

### 3. Test Guest Join Link
1. Copy the guest join link (like the one you shared)
2. Open in incognito window or different browser
3. Enter name and join
4. Should see both participants in the list

### 4. Check WebRTC Connection

**Open Browser Console (F12) on both windows:**
- Join conference in Window 1
- Join same conference in Window 2
- Check console logs for:
  - `User connected: [socket-id]`
  - `Received remote track from: [socket-id]`
  - `Connection state changed: connected`
  - `ICE connection state: connected`

### 5. Verify Environment Variables

**Frontend on Render:**
- `REACT_APP_API_URL` → Should point to your backend URL + `/api`
- `REACT_APP_SOCKET_URL` → Should point to your backend URL

**Backend on Render:**
- `CLIENT_URL` → Should point to `https://cleanconference-front.onrender.com`

## Common Issues

### Issue: Routing doesn't work
**Solution:** Make sure you deployed as Web Service (not Static Site) with `npx serve -s build`

### Issue: Empty conference
**Solution:** Check that `REACT_APP_SOCKET_URL` points to backend URL

### Issue: No video/audio
**Solution:** 
1. Check console logs for WebRTC errors
2. Make sure camera/mic permissions are granted
3. Look for ICE connection failures
4. May need TURN servers if behind strict firewall

## Testing Your Specific Link

To test: `https://cleanconference-front.onrender.com/guest-join/33fee760-631c-4841-98f4-2c79e0f35e98`

1. **Open the link** in a browser
2. **Enter your name** and join
3. **Check if:**
   - ✅ You can see your own video
   - ✅ Participant list shows you
   - ✅ You can see other participants (if someone else is in the room)

4. **If video/audio doesn't work:**
   - Open console (F12)
   - Look for error messages
   - Check connection state logs
   - Verify camera/mic permissions

## Next Steps

After deploying the WebRTC improvements I made:

1. **Commit and push:**
   ```bash
   git add frontend/src/pages/Conference.js
   git commit -m "Improve WebRTC connection handling"
   git push
   ```

2. **Wait for auto-deploy** on Render (or manually deploy)

3. **Test again** with two windows and check console logs

4. **Share console logs** if video/audio still doesn't work - the logs will show exactly what's failing


