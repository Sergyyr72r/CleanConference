# Quick Deploy Guide - 5 Minutes!

## Fastest Way: Render.com

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Ready to deploy"
git remote add origin YOUR_GITHUB_REPO
git push -u origin main
```

### 2. Deploy Backend
1. Go to https://render.com → Sign up/Login
2. "New +" → "Web Service"
3. Connect GitHub → Select repo
4. Settings:
   - **Root Directory**: `backend`
   - **Start Command**: `node server.js`
5. Add env vars (temporarily, we'll update later):
   - `CLIENT_URL`: Leave blank for now
   - `PORT`: `10000`
   - `JWT_SECRET`: Any random string
6. Deploy! Copy backend URL (e.g., `https://meet-backend-xyz.onrender.com`)

### 3. Deploy Frontend
1. "New +" → "Static Site"
2. Connect same GitHub repo
3. Settings:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build`
4. Add env vars:
   - `REACT_APP_API_URL`: `https://YOUR_BACKEND_URL.onrender.com/api`
   - `REACT_APP_SOCKET_URL`: `https://YOUR_BACKEND_URL.onrender.com`
   (Use the backend URL from step 2)
5. Deploy! Copy frontend URL (e.g., `https://meet-frontend-abc.onrender.com`)

### 4. Update Backend CLIENT_URL
1. Go back to backend service
2. Environment → Edit `CLIENT_URL`
3. Set to: `https://YOUR_FRONTEND_URL.onrender.com`
4. Save

### 5. Redeploy Frontend (if needed)
Frontend should auto-redeploy. Test your app!

**Done!** Your app is live at your frontend URL 🚀

## Need Help?
See `DEPLOYMENT_GUIDE.md` for detailed instructions.


