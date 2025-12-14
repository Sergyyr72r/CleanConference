import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

function Home() {
  const navigate = useNavigate();
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [roomIdInput, setRoomIdInput] = useState('');

  const handleCreateConference = () => {
    navigate('/create-conference');
  };

  const handleJoinClick = () => {
    setShowJoinInput(true);
  };

  const handleJoinConference = () => {
    const roomId = roomIdInput.trim();
    if (roomId) {
      // Extract room ID from URL if full URL is provided
      const match = roomId.match(/\/guest-join\/([^\/\s]+)/) || roomId.match(/([a-f0-9-]{36})/i);
      if (match) {
        navigate(`/guest-join/${match[1]}`);
      } else {
        navigate(`/guest-join/${roomId}`);
      }
    }
  };

  const handleCancelJoin = () => {
    setShowJoinInput(false);
    setRoomIdInput('');
  };

  return (
    <div className="home-container">
      <div className="home-header">
        <h1>Meet — Video Conferences by Link</h1>
      </div>
      
      <div className="home-content">
        {!showJoinInput ? (
          <div className="main-actions">
            <button 
              onClick={handleCreateConference} 
              className="action-button create-btn large"
            >
              <div className="button-icon">📹</div>
              <div className="button-text">Create Conference</div>
            </button>
            <button 
              onClick={handleJoinClick} 
              className="action-button join-btn large"
            >
              <div className="button-icon">👥</div>
              <div className="button-text">Join</div>
            </button>
          </div>
        ) : (
          <div className="join-input-container">
            <h2 className="join-title">Enter Room ID</h2>
            <input
              type="text"
              className="room-id-input"
              placeholder="Enter conference room ID or link"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleJoinConference();
                }
              }}
              autoFocus
            />
            <div className="join-buttons">
              <button 
                onClick={handleJoinConference} 
                className="join-confirm-btn"
              >
                Join Conference
              </button>
              <button 
                onClick={handleCancelJoin} 
                className="join-cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;

