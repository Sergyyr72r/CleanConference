import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

function Home() {
  const navigate = useNavigate();

  const handleCreateConference = () => {
    navigate('/create-conference');
  };

  const handleJoinConference = () => {
    const roomId = prompt('Enter conference room ID or link:');
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

  return (
    <div className="home-container">
      <div className="home-header">
        <h1>Meet — Video Conferences by Link</h1>
      </div>
      
      <div className="home-content">
        <div className="main-actions">
          <button 
            onClick={handleCreateConference} 
            className="action-button create-btn large"
          >
            <div className="button-icon">📹</div>
            <div className="button-text">Create Conference</div>
          </button>
          <div className="secondary-actions">
            <button 
              onClick={handleJoinConference} 
              className="action-button join-btn"
            >
              <div className="button-icon">👥</div>
              <div className="button-text">Join</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;

