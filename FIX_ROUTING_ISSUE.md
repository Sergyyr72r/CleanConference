# Fix: "Not Found" Error on Deployed App

## Problem
When accessing routes like `/guest-join/...` on your deployed Render app, you get a "Not Found" error. This is because Render's static site hosting needs to be configured to handle React Router's client-side routing.

## Solution

I've created a `_redirects` file, but Render might need additional configuration. Here are the steps to fix it:

### Step 1: Commit and Push the _redirects File

1. **Make sure the `_redirects` file exists:**
   ```bash
   # Check if it exists
   cat frontend/public/_redirects
   ```
   
   It should contain:
   ```
   /*    /index.html   200
   ```

2. **Commit and push to GitHub:**
   ```bash
   git add frontend/public/_redirects
   git commit -m "Add _redirects for React Router SPA routing"
   git push
   ```

### Step 2: Rebuild Frontend on Render

1. Go to your Render dashboard
2. Click on your frontend service (`cleanconference-1`)
3. Go to "Manual Deploy" → "Clear build cache & deploy"

OR

4. Push a new commit to trigger automatic deployment:
   ```bash
   git commit --allow-empty -m "Trigger rebuild"
   git push
   ```

### Step 3: Alternative - Configure Render Headers (If _redirects doesn't work)

If the `_redirects` file doesn't work, Render might need custom headers:

1. Go to your Render dashboard
2. Select your frontend Static Site
3. Go to "Settings" → "Headers"
4. Add a custom header:
   - **Name**: `X-Render-Spa`
   - **Value**: `true`
   
   OR

5. Add redirects in Render settings:
   - Go to "Settings" → "Redirects/Rewrites"
   - Add: `/* → /index.html` (200 status)

### Step 4: Verify the Fix

After redeploying, test:
1. Go to: `https://cleanconference-1.onrender.com`
2. Try creating a conference
3. Access a guest-join link
4. The route should work now!

## Why This Happens

React Router uses client-side routing. When you visit `/guest-join/...`:
- **Without fix**: Server looks for a file at that path → 404 Not Found
- **With fix**: Server serves `index.html` → React Router handles the route on the client side

## Alternative Solution: Deploy as Web Service

If Static Site deployment continues to have issues, you can deploy the frontend as a Web Service:

1. In Render, delete the current Static Site
2. Create a new "Web Service"
3. Use these settings:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npx serve -s build -l 3000`
   - **Environment**: Node

This uses a Node server that automatically handles SPA routing.

## Quick Fix Checklist

- [ ] `_redirects` file exists in `frontend/public/`
- [ ] Committed and pushed to GitHub
- [ ] Frontend service redeployed on Render
- [ ] Tested the guest-join link
- [ ] Verified routes work correctly

## Still Having Issues?

If the problem persists:

1. **Check Render logs**: Look for any errors in the deployment logs
2. **Verify build**: Make sure the build completed successfully
3. **Clear cache**: Try "Clear build cache & deploy" in Render
4. **Check URL**: Ensure you're using the correct frontend URL

The fix should work after redeploying! 🚀
