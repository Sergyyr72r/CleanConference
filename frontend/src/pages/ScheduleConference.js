import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ScheduleConference.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

function ScheduleConference() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    guestEmail: '',
    scheduledTime: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/conference/schedule`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      setSuccess(true);
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to schedule conference');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="schedule-conference-container">
        <div className="success-message">
          <h2>Conference Scheduled!</h2>
          <p>Invitations have been sent to you and the guest.</p>
          <p>Redirecting to home...</p>
        </div>
      </div>
    );
  }

  // Set minimum datetime to current time
  const now = new Date();
  const minDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return (
    <div className="schedule-conference-container">
      <div className="schedule-conference-box">
        <h2>Schedule Conference</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Guest Email"
            value={formData.guestEmail}
            onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
            required
          />
          <input
            type="datetime-local"
            placeholder="Scheduled Time"
            value={formData.scheduledTime}
            onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
            min={minDateTime}
            required
          />
          <textarea
            placeholder="Message (optional)"
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            rows="4"
          />
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? 'Scheduling...' : 'Schedule & Send Invitations'}
          </button>
          <button 
            type="button" 
            onClick={() => navigate('/')}
            className="cancel-btn"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}

export default ScheduleConference;

