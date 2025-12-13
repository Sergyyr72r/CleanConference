const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const emailService = require('../services/email');

const router = express.Router();

// Create conference (instant) - no auth required
router.post('/create', (req, res) => {
  try {
    const { guestEmail } = req.body;
    const roomId = uuidv4();

    // Send invitation email if provided (optional)
    if (guestEmail && guestEmail.trim() !== '') {
      emailService.sendInvitation({
        to: guestEmail,
        roomId: roomId,
        hostEmail: guestEmail, // Use guest email as sender identifier
        isScheduled: false
      }).then(() => {
        res.json({ roomId, message: 'Conference created and invitation sent' });
      }).catch((error) => {
        console.error('Error sending email:', error);
        // Still return roomId even if email fails
        res.json({ roomId, message: 'Conference created, but email may not have been sent' });
      });
    } else {
      // No email provided, just create the conference
      res.json({ roomId, message: 'Conference created successfully' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Schedule conference (disabled - not implemented)
router.post('/schedule', (req, res) => {
  try {
    const { guestEmail, scheduledTime, message } = req.body;
    const roomId = uuidv4();
    const hostEmail = req.userEmail;

    if (!guestEmail || !scheduledTime) {
      return res.status(400).json({ error: 'Guest email and scheduled time are required' });
    }

    const db = getDb();
    db.run(
      'INSERT INTO scheduled_conferences (room_id, host_email, guest_email, scheduled_time, message) VALUES (?, ?, ?, ?, ?)',
      [roomId, hostEmail, guestEmail, scheduledTime, message || ''],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        // Send invitation email (non-blocking)
        emailService.sendInvitation({
          to: guestEmail,
          roomId: roomId,
          hostEmail: hostEmail,
          scheduledTime: scheduledTime,
          message: message,
          isScheduled: true
        }).then(() => {
          // Send copy to host
          return emailService.sendInvitation({
            to: hostEmail,
            roomId: roomId,
            hostEmail: hostEmail,
            scheduledTime: scheduledTime,
            message: message,
            isScheduled: true,
            isHostCopy: true
          });
        }).then(() => {
          db.run(
            'UPDATE scheduled_conferences SET email_sent = 1 WHERE id = ?',
            [this.lastID]
          );
          res.json({ roomId, message: 'Conference scheduled and invitations sent' });
        }).catch((error) => {
          console.error('Error sending email:', error);
          // Still return success - conference is scheduled even if email fails
          res.json({ roomId, message: 'Conference scheduled. Email may not have been sent - check email configuration.' });
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get scheduled conferences for user (disabled - not implemented)
router.get('/scheduled', (req, res) => {
  try {
    const db = getDb();
    db.all(
      'SELECT * FROM scheduled_conferences WHERE host_email = ? OR guest_email = ? ORDER BY scheduled_time',
      [req.userEmail, req.userEmail],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

