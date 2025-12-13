import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './CreateConference.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

function CreateConference() {
  const navigate = useNavigate();
  const [guestEmail, setGuestEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roomId, setRoomId] = useState(null);

  // No authentication required

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/conference/create`,
        { guestEmail }
      );
      const newRoomId = response.data.roomId;
      setRoomId(newRoomId);
      
      // Automatically copy the conference link
      const conferenceLink = `${window.location.origin}/guest-join/${newRoomId}`;
      navigator.clipboard.writeText(conferenceLink).then(() => {
        console.log('Conference link copied to clipboard:', conferenceLink);
      }).catch(err => {
        console.error('Failed to copy link:', err);
      });
      
      // Navigate to conference immediately
      navigate(`/conference/${newRoomId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create conference');
      setLoading(false);
    }
  };

  if (roomId) {
    return (
      <div className="create-conference-container">
        <div className="success-message">
          <h2>Invitation sent!</h2>
          <p>Redirecting to conference...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="create-conference-container">
      <div className="create-conference-box">
        <h2>Create Conference</h2>
        <p className="subtitle">Enter guest email to send invitation (optional)</p>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Guest Email (optional)"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
          />
          {error && <div className="error">{error}</div>}
          <div className="button-group">
            <button type="submit" disabled={loading} className="primary-btn">
              {loading ? 'Creating...' : 'Create & Join'}
            </button>
            <button 
              type="button" 
              onClick={() => navigate('/')}
              className="cancel-btn"
            >
              Cancel
            </button>
          </div>
          <p className="info-text">The conference link will be automatically copied to your clipboard</p>
        </form>
      </div>
    </div>
  );
}

export default CreateConference;

