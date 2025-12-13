# Email Configuration Guide

To enable email sending for conference invitations, you need to configure SMTP settings.

## Quick Setup

1. Create a `.env` file in the `backend` directory:

```bash
cd backend
touch .env
```

2. Add your SMTP credentials to the `.env` file:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
CLIENT_URL=http://localhost:3000
JWT_SECRET=your-secret-key
```

## Gmail Setup

1. Go to your Google Account settings
2. Enable 2-Step Verification
3. Go to "App Passwords" (search for it)
4. Generate a new app password for "Mail"
5. Use this app password (not your regular password) as `SMTP_PASS`

## Other Email Providers

### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

### Yahoo
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_USER=your-email@yahoo.com
SMTP_PASS=your-app-password
```

### Custom SMTP
```env
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_USER=your-username
SMTP_PASS=your-password
```

## Testing

After configuring, restart the backend server. You should see:
- `Email server is ready to send messages` - Email is configured correctly
- `Email not configured...` - Check your .env file and credentials

## Troubleshooting

- **"Invalid login"**: Check your username and password
- **"Connection timeout"**: Check SMTP_HOST and SMTP_PORT
- **"Email not sent"**: Check server logs for detailed error messages

## Note

If email is not configured, conferences will still work. The conference link will be shown in the console and can be copied from the conference window.

