# Deployment Guide - Meet Video Conference App

Deploying to the web is much easier than using ngrok! Here are the recommended options:

## 🚀 Option 1: Render (Recommended - Easiest)

**Render** offers free hosting with easy deployment from GitHub.

### Prerequisites:
1. GitHub account
2. Git repository for your code
3. Render account (free): https://render.com

### Step 1: Prepare Your Repository

1. **Make sure your code is on GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

### Step 2: Create Backend Service on Render

1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `meet-backend` (or any name)
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free

5. **Add Environment Variables:**
   ```
   CLIENT_URL=https://your-frontend-url.onrender.com
   PORT=10000
   JWT_SECRET=your-random-secret-key-here
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```
   
   **Note**: `CLIENT_URL` will be your frontend URL (create frontend service first, then update this)

6. Click "Create Web Service"
7. Copy the URL (e.g., `https://meet-backend.onrender.com`)

### Step 3: Create Frontend Service on Render

1. Click "New +" → "Static Site"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `meet-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build`

4. **Add Environment Variables:**
   ```
   REACT_APP_API_URL=https://meet-backend.onrender.com/api
   REACT_APP_SOCKET_URL=https://meet-backend.onrender.com
   ```
   
   Replace `meet-backend.onrender.com` with your actual backend URL from Step 2.

5. Click "Create Static Site"
6. Copy the frontend URL (e.g., `https://meet-frontend.onrender.com`)

### Step 4: Update Backend CLIENT_URL

1. Go back to your backend service on Render
2. Go to "Environment" tab
3. Update `CLIENT_URL` to your frontend URL:
   ```
   CLIENT_URL=https://meet-frontend.onrender.com
   ```
4. Save and redeploy

### Step 5: Update Frontend Build

1. Go to your frontend service on Render
2. Click "Manual Deploy" → "Deploy latest commit"

**That's it!** Your app should be live. 🎉

## 🚂 Option 2: Railway (Alternative)

**Railway** is another excellent option with a free tier.

### Step 1: Install Railway CLI (Optional)

```bash
npm i -g @railway/cli
railway login
```

### Step 2: Deploy Backend

1. Go to https://railway.app
2. Create new project → "Deploy from GitHub repo"
3. Select your repository
4. Add a service → "Backend" folder
5. Set environment variables (same as Render)
6. Deploy!

### Step 3: Deploy Frontend

1. Add another service → "Frontend" folder
2. Configure build settings:
   - Build command: `npm install && npm run build`
   - Start command: `npx serve -s build`
3. Set environment variables
4. Deploy!

## 📝 Important Notes

### SQLite Database
- SQLite files will persist on Render/Railway's file system
- Database resets if you redeploy (for persistent data, consider PostgreSQL)
- For production, consider migrating to PostgreSQL (free tier available on Render)

### WebRTC Considerations
- WebRTC works great on deployed apps!
- Make sure you're using HTTPS (Render/Railway provide this automatically)
- STUN servers (Google's) are already configured and work fine

### Email Configuration
- Gmail App Password is recommended
- Other SMTP providers work too
- Email is optional - app works without it

### Free Tier Limitations
- **Render**: Services may spin down after inactivity (first request takes ~30s)
- **Railway**: $5/month credit (usually enough for small apps)
- Both are great for testing and small projects!

## 🔧 Troubleshooting

### Backend not connecting:
- Check `CLIENT_URL` matches your frontend URL exactly
- Ensure CORS is configured correctly
- Check backend logs on Render/Railway dashboard

### Frontend can't reach backend:
- Verify `REACT_APP_API_URL` and `REACT_APP_SOCKET_URL` are correct
- Make sure backend service is running
- Check browser console for CORS errors

### Socket.IO connection issues:
- Ensure `REACT_APP_SOCKET_URL` uses HTTPS (not HTTP)
- Check that backend allows your frontend origin in CORS

## 🎯 Quick Start Checklist

- [ ] Code pushed to GitHub
- [ ] Render/Railway account created
- [ ] Backend service deployed
- [ ] Frontend service deployed
- [ ] Environment variables configured
- [ ] Backend CLIENT_URL updated with frontend URL
- [ ] Test the deployed app!

## Next Steps

After deployment:
1. Test creating a conference
2. Test joining from another device
3. Verify video connections work
4. Check that chat messages sync
5. Test on mobile devices

Your app is now accessible worldwide! 🌍
