const nodemailer = require('nodemailer');

// Configure email transporter
// For production, use real SMTP settings
// For development, you can use Gmail, Outlook, or any SMTP service
let transporter = null;

// Try to create transporter with environment variables
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = parseInt(process.env.SMTP_PORT) || 587;

if (smtpUser && smtpPass && 
    smtpUser.trim() !== '' && 
    smtpPass.trim() !== '' &&
    smtpUser !== 'your-email@gmail.com' && 
    smtpPass !== 'your-app-password') {
  try {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      tls: {
        rejectUnauthorized: false // For self-signed certificates
      }
    });
    
    // Verify connection
    transporter.verify((error, success) => {
      if (error) {
        console.error('Email configuration error:', error.message);
        console.log('Email will not be sent. Please check your SMTP settings.');
        transporter = null;
      } else {
        console.log('Email server is ready to send messages');
      }
    });
  } catch (error) {
    console.error('Failed to create email transporter:', error.message);
    transporter = null;
  }
} else {
  console.log('Email not configured. Set SMTP_USER and SMTP_PASS environment variables to enable email.');
  console.log('Create a .env file in the backend directory with:');
  console.log('  SMTP_HOST=smtp.gmail.com');
  console.log('  SMTP_PORT=587');
  console.log('  SMTP_USER=your-email@gmail.com');
  console.log('  SMTP_PASS=your-app-password');
}

// Alternative: Use Ethereal Email for testing (no real email needed)
// Uncomment below and comment above for testing without real email
/*
const nodemailer = require('nodemailer');

let transporter;
nodemailer.createTestAccount().then((account) => {
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: account.user,
      pass: account.pass
    }
  });
});
*/

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

async function sendInvitation({ to, roomId, hostEmail, scheduledTime, message, isScheduled, isHostCopy }) {
  // If email is not configured, return a resolved promise (don't fail)
  if (!transporter) {
    console.log(`Email not configured. Would send invitation to ${to} for room ${roomId}`);
    console.log(`Conference link: ${CLIENT_URL}/guest-join/${roomId}`);
    return Promise.resolve({ message: 'Email not configured', skipped: true });
  }

  // Guests go to guest-join page, hosts go directly to conference
  const guestUrl = `${CLIENT_URL}/guest-join/${roomId}`;
  const hostUrl = `${CLIENT_URL}/conference/${roomId}`;
  
  let subject, html;
  
  if (isScheduled) {
    const scheduledDate = new Date(scheduledTime).toLocaleString();
    if (isHostCopy) {
      subject = 'Conference Scheduled - Your Copy';
      html = `
        <h2>Conference Scheduled</h2>
        <p>You have scheduled a video conference.</p>
        <p><strong>Guest Email:</strong> ${to}</p>
        <p><strong>Scheduled Time:</strong> ${scheduledDate}</p>
        ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
        <p>Join the conference at the scheduled time:</p>
        <p><a href="${hostUrl}">${hostUrl}</a></p>
      `;
    } else {
      subject = 'Video Conference Invitation';
      html = `
        <h2>You're Invited to a Video Conference</h2>
        <p>${hostEmail} has invited you to a video conference.</p>
        <p><strong>Scheduled Time:</strong> ${scheduledDate}</p>
        ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
        <p>Join the conference at the scheduled time:</p>
        <p><a href="${guestUrl}">${guestUrl}</a></p>
      `;
    }
  } else {
    subject = 'Video Conference Invitation';
    html = `
      <h2>You're Invited to a Video Conference</h2>
      <p>${hostEmail} has invited you to join a video conference now.</p>
      <p>Click the link below to join:</p>
      <p><a href="${guestUrl}">${guestUrl}</a></p>
    `;
  }

  const mailOptions = {
    from: process.env.SMTP_USER || 'noreply@meet.com',
    to: to,
    subject: subject,
    html: html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✓ Email sent successfully to', to);
    console.log('  Message ID:', info.messageId);
    console.log('  Response:', info.response);
    return info;
  } catch (error) {
    console.error('✗ Error sending email to', to);
    console.error('  Error code:', error.code);
    console.error('  Error message:', error.message);
    if (error.response) {
      console.error('  SMTP response:', error.response);
    }
    // Re-throw so caller can handle it
    throw error;
  }
}

module.exports = {
  sendInvitation
};

