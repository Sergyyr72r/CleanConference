import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { setCookie } from '../utils/cookies';
import './GuestJoin.css';

function GuestJoin() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');

  const handleJoin = (e) => {
    e.preventDefault();
    const nameToUse = userName.trim() || 'Caller';
    // Save name to cookie
    setCookie('userName', nameToUse);
    // Navigate to conference
    navigate(`/conference/${roomId}`);
  };

  return (
    <div className="guest-join-container">
      <div className="guest-join-box">
        <h2>Join Conference</h2>
        <p>Enter your name to join the conference</p>
        <form onSubmit={handleJoin}>
          <input
            type="text"
            placeholder="Your Name (optional, default: Caller)"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            autoFocus
          />
          <button type="submit">Join Conference</button>
        </form>
      </div>
    </div>
  );
}

export default GuestJoin;

