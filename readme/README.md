# Meet - Video Conference App

An alternative to Google Meet built with WebRTC, React, and Node.js. Works in Russia without restrictions.

## Features

- **Create Conference**: Instant video conference with email invitation
- **Schedule Conference**: Schedule conferences for specific date/time
- **Video Conferencing**: WebRTC-based peer-to-peer video calls
- **Chat**: Real-time text chat during conferences
- **User List**: See all participants in the conference
- **Recording**: Record conferences and save to local drive
- **Authentication**: Sign up/login for hosts, guest access via link

## Tech Stack

- **Frontend**: React, Socket.io-client, WebRTC
- **Backend**: Node.js, Express, Socket.io
- **Database**: SQLite
- **Email**: Nodemailer (configurable SMTP)

## Installation

1) Install dependencies:
```bash
npm run install-all
```

2) Environment files:
- Copy `backend/env.example` to `backend/.env` and fill the values (ports, client URL, JWT secret, SMTP settings).
- Copy `frontend/env.example` to `frontend/.env` and fill the values (API URL, socket URL, Agora App ID).

3) Start the application:
```bash
npm run dev
```

This will start:
- Backend server on http://localhost:5001
- Frontend app on http://localhost:3000

**Note**: Port 5000 is often used by macOS AirPlay. If you encounter port conflicts, you can change the backend port by setting the `PORT` environment variable.

## New machine setup

- Clone the repo and install Node matching `.nvmrc` (`nvm use` will pick it up).
- Run `npm ci` in `backend` and `frontend` (or `npm run install-all`).
- Copy the example env files to `.env` (backend/front) and provide secrets.
- Run `npm run dev` or individual `npm start`/`npm run server`/`npm run client`.
- Keep SMTP and Agora keys in your password manager; do not commit real secrets.

## Usage

1. **Sign Up/Login**: Create an account to host conferences
2. **Create Conference**: Click "Create Conference", enter guest email, and join
3. **Schedule Conference**: Click "Schedule Conference", set date/time, and send invitation
4. **Join as Guest**: Click the link in the invitation email, enter your name, and join
5. **During Conference**:
   - Use "Record Conference" to record the session
   - Use "End Conference" to leave
   - Chat with participants
   - See all participants in the sidebar

## Notes

- WebRTC uses STUN servers (Google's public STUN servers)
- For production, consider using TURN servers for better connectivity
- Email configuration is required for sending invitations
- Recordings are saved as WebM files to your local drive

## License

MIT

