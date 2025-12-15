const { getDb } = require('../database');
const emailService = require('./email');

function checkScheduledConferences() {
  const db = getDb();
  const now = new Date().toISOString();
  
  // Find conferences that should start soon (within next minute)
  const oneMinuteFromNow = new Date(Date.now() + 60000).toISOString();
  
  db.all(
    `SELECT * FROM scheduled_conferences 
     WHERE scheduled_time BETWEEN ? AND ? 
     AND email_sent = 0`,
    [now, oneMinuteFromNow],
    (err, conferences) => {
      if (err) {
        console.error('Error checking scheduled conferences:', err);
        return;
      }

      conferences.forEach(conference => {
        // Send reminder emails if needed
        console.log(`Conference ${conference.room_id} is starting soon`);
        // You could send reminder emails here if desired
      });
    }
  );
}

module.exports = {
  checkScheduledConferences
};



