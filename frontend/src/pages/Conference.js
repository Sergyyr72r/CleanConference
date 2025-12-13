import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { getCookie, setCookie } from '../utils/cookies';
import './Conference.css';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001';

function Conference() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [userName, setUserName] = useState('Caller');
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showNamePopup, setShowNamePopup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [popupNameInput, setPopupNameInput] = useState('');

  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideosRef = useRef({});
  const peerConnectionsRef = useRef({});
  const localStreamRef = useRef(null);
  const currentSocketIdRef = useRef(null);

  useEffect(() => {
    // Get user name from cookies, default to "Caller"
    const savedName = getCookie('userName');
    const finalUserName = savedName || 'Caller';
    setUserName(finalUserName);
    setNameInput(finalUserName);
    
    // Show name popup if name is "Caller" (default/not set)
    if (finalUserName === 'Caller') {
      setShowNamePopup(true);
      setPopupNameInput('');
    }

    // Initialize socket
    socketRef.current = io(SOCKET_URL);
    
    // Store current socket ID
    socketRef.current.on('connect', () => {
      currentSocketIdRef.current = socketRef.current.id;
    });

    // Get user media
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Join room with name from cookie (or "Caller" if not set)
        const nameToUse = getCookie('userName') || 'Caller';
        socketRef.current.emit('join-room', roomId, nameToUse);
      })
      .catch(err => {
        console.error('Error accessing media devices:', err);
        alert('Could not access camera/microphone. Please allow permissions.');
      });

    // Socket event handlers
    socketRef.current.on('user-joined', handleUserJoined);
    socketRef.current.on('existing-users', handleExistingUsers);
    socketRef.current.on('offer', handleOffer);
    socketRef.current.on('answer', handleAnswer);
    socketRef.current.on('ice-candidate', handleIceCandidate);
    socketRef.current.on('user-left', handleUserLeft);
    socketRef.current.on('user-list', handleUserList);
    socketRef.current.on('chat-message', handleChatMessage);

    return () => {
      // Cleanup
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [roomId]);

  const createPeerConnection = (socketId) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10
    });

    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track from:', socketId, event.streams, event.track);
      if (event.streams && event.streams[0]) {
        const setVideoStream = (videoElement) => {
          if (videoElement) {
            videoElement.srcObject = event.streams[0];
            // Ensure video plays
            videoElement.play().catch(err => {
              console.warn('Error playing remote video:', err);
            });
            console.log('Set remote stream on video element for:', socketId);
          }
        };

        // Try to get video element immediately
        let videoElement = remoteVideosRef.current[socketId];
        
        if (videoElement) {
          setVideoStream(videoElement);
        } else {
          // Video element might not be created yet, retry a few times
          let retries = 0;
          const maxRetries = 10;
          const retryInterval = setInterval(() => {
            videoElement = remoteVideosRef.current[socketId];
            if (videoElement) {
              setVideoStream(videoElement);
              clearInterval(retryInterval);
            } else if (retries >= maxRetries) {
              console.warn('Video element not found for socketId after retries:', socketId);
              clearInterval(retryInterval);
            }
            retries++;
          }, 100);
        }
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate to:', socketId, event.candidate);
        socketRef.current.emit('ice-candidate', {
          target: socketId,
          candidate: event.candidate
        });
      } else {
        console.log('ICE gathering complete for:', socketId);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state changed for', socketId, ':', pc.connectionState);
      if (pc.connectionState === 'failed') {
        console.error('WebRTC connection failed for:', socketId);
        // Optionally try to restart ICE
        pc.restartIce();
      } else if (pc.connectionState === 'connected') {
        console.log('WebRTC connected successfully with:', socketId);
      }
    };

    // Handle ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state for', socketId, ':', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        console.error('ICE connection failed for:', socketId);
        pc.restartIce();
      }
    };

    return pc;
  };

  const handleUserJoined = async ({ socketId, userName: name }) => {
    // Check if connection already exists (might have been created by handleOffer)
    let pc = peerConnectionsRef.current[socketId];
    
    if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
      pc = createPeerConnection(socketId);
      peerConnectionsRef.current[socketId] = pc;
    }

    // Only create offer if connection is in stable state (not already negotiating)
    if (pc.signalingState === 'stable') {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socketRef.current.emit('offer', {
          target: socketId,
          offer: offer
        });
      } catch (error) {
        console.error('Error creating offer for new user:', error);
      }
    }
  };

  const handleExistingUsers = async (users) => {
    for (const user of users) {
      // Check if connection already exists (might have been created by handleOffer)
      let pc = peerConnectionsRef.current[user.socketId];
      
      if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
        pc = createPeerConnection(user.socketId);
        peerConnectionsRef.current[user.socketId] = pc;
      }

      // Only create offer if connection is in stable state (not already negotiating)
      if (pc.signalingState === 'stable') {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          socketRef.current.emit('offer', {
            target: user.socketId,
            offer: offer
          });
        } catch (error) {
          console.error('Error creating offer for existing user:', error);
        }
      }
    }
  };

  const handleOffer = async ({ offer, sender }) => {
    let pc = peerConnectionsRef.current[sender];
    
    // Only create new connection if one doesn't exist or is closed
    if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
      pc = createPeerConnection(sender);
      peerConnectionsRef.current[sender] = pc;
    }

    // Check if connection is in correct state to set remote offer
    // Can only set remote offer if in 'stable' or 'have-local-offer' state
    if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socketRef.current.emit('answer', {
          target: sender,
          answer: answer
        });
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    } else {
      console.warn(`Cannot set remote offer in signaling state: ${pc.signalingState}`);
    }
  };

  const handleAnswer = async ({ answer, sender }) => {
    const pc = peerConnectionsRef.current[sender];
    if (pc) {
      // Can only set remote answer if in 'have-local-offer' state
      // If already stable, the answer was already set (race condition handled)
      if (pc.signalingState === 'have-local-offer') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
          console.error('Error setting remote answer:', error);
          // If error occurs, the connection might already be established
          // Check if connection is functional
          if (error.name === 'InvalidStateError' && pc.signalingState === 'stable') {
            console.log('Connection already established, ignoring duplicate answer');
          }
        }
      } else if (pc.signalingState === 'stable') {
        console.log('Connection already stable, ignoring answer');
      } else {
        console.warn(`Cannot set remote answer in signaling state: ${pc.signalingState}`);
      }
    }
  };

  const handleIceCandidate = async ({ candidate, sender }) => {
    const pc = peerConnectionsRef.current[sender];
    if (pc && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        // Ignore errors if candidate is null (end of candidates) or connection is closed
        if (error.name !== 'OperationError' && pc.connectionState !== 'closed') {
          console.error('Error adding ICE candidate:', error);
        }
      }
    }
  };

  const handleUserLeft = (socketId) => {
    if (peerConnectionsRef.current[socketId]) {
      peerConnectionsRef.current[socketId].close();
      delete peerConnectionsRef.current[socketId];
    }
    if (remoteVideosRef.current[socketId]) {
      remoteVideosRef.current[socketId].srcObject = null;
    }
  };

  const handleUserList = (userList) => {
    // Get current socket ID (use ref or directly from socket as fallback)
    const currentSocketId = currentSocketIdRef.current || socketRef.current?.id;
    
    // Filter out current user from the list
    const otherUsers = userList.filter(user => user.socketId !== currentSocketId);
    setUsers(otherUsers);
    
    // Create video elements for new users (excluding self)
    otherUsers.forEach(user => {
      if (!remoteVideosRef.current[user.socketId]) {
        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.className = 'remote-video';
        remoteVideosRef.current[user.socketId] = video;
      }
    });
  };

  const handleChatMessage = (data) => {
    setMessages(prev => [...prev, data]);
  };

  const sendMessage = () => {
    if (messageInput.trim() && socketRef.current) {
      socketRef.current.emit('chat-message', {
        roomId: roomId,
        message: messageInput
      });
      setMessageInput('');
    }
  };

  const startRecording = async () => {
    try {
      const stream = localStreamRef.current;
      if (!stream) return;

      // Combine local and remote streams for recording
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 1280;
      canvas.height = 720;

      const chunks = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8'
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `conference-${roomId}-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setRecordedChunks([]);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not start recording. Your browser may not support this feature.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const endConference = () => {
    if (window.confirm('Are you sure you want to end the conference?')) {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (mediaRecorder && isRecording) {
        stopRecording();
      }
      navigate('/');
    }
  };

  const copyConferenceLink = () => {
    const link = `${window.location.origin}/guest-join/${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      // Fallback: select text
      const textArea = document.createElement('textarea');
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const conferenceLink = `${window.location.origin}/guest-join/${roomId}`;

  const handleNamePopupConfirm = () => {
    const newName = popupNameInput.trim() || 'Caller';
    setUserName(newName);
    setCookie('userName', newName);
    setNameInput(newName);
    setShowNamePopup(false);
    
    // Update name in socket if connected
    if (socketRef.current) {
      socketRef.current.emit('update-name', newName);
    }
  };

  const handleNamePopupCancel = () => {
    // Keep default "Caller" name
    setShowNamePopup(false);
  };

  const handleSettingsSave = () => {
    const newName = nameInput.trim() || 'Caller';
    setUserName(newName);
    setCookie('userName', newName);
    setShowSettings(false);
    
    // Update name in socket if connected
    if (socketRef.current) {
      socketRef.current.emit('update-name', newName);
    }
  };

  return (
    <div className="conference-container">
      <div className="conference-main">
        <div className="video-section">
          <div className="video-grid">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="local-video"
            />
            {users.map(user => (
              <video
                key={user.socketId}
                ref={el => {
                  if (el) remoteVideosRef.current[user.socketId] = el;
                }}
                autoPlay
                playsInline
                className="remote-video"
              />
            ))}
          </div>
          <div className="conference-controls">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={isRecording ? 'record-btn recording' : 'record-btn'}
            >
              {isRecording ? 'Stop Recording' : 'Record Conference'}
            </button>
            <button onClick={endConference} className="end-btn">
              End Conference
            </button>
            <button
              onClick={copyConferenceLink}
              className="copy-link-btn-controls"
              title="Copy conference link"
            >
              {copySuccess ? '✓ Copied!' : 'Copy Link'}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="settings-btn-controls"
              title="Settings"
            >
              ⚙️ Settings
            </button>
          </div>
        </div>
        <div className="sidebar">
          <div className="users-section">
            <h3>Participants ({users.length + 1})</h3>
            <div className="users-list">
              <div className="user-item local">{userName} (You)</div>
              {users.map(user => (
                <div key={user.socketId} className="user-item">
                  {user.userName}
                </div>
              ))}
            </div>
          </div>
          <div className="chat-section">
            <h3>Chat</h3>
            <div className="messages-container">
              {messages.map((msg, idx) => (
                <div key={idx} className="message">
                  <strong>{msg.userName}:</strong> {msg.message}
                </div>
              ))}
            </div>
            <div className="chat-input-container">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                className="chat-input"
              />
              <button onClick={sendMessage} className="send-btn">Send</button>
            </div>
          </div>
        </div>
      </div>

      {/* Name Popup */}
      {showNamePopup && (
        <div className="popup-overlay">
          <div className="popup-box">
            <h3>Enter Your Name</h3>
            <p>Please enter your name to join the conference</p>
            <input
              type="text"
              value={popupNameInput}
              onChange={(e) => setPopupNameInput(e.target.value)}
              placeholder="Your name"
              className="popup-input"
              autoFocus
              onKeyPress={(e) => e.key === 'Enter' && handleNamePopupConfirm()}
            />
            <div className="popup-buttons">
              <button onClick={handleNamePopupConfirm} className="popup-confirm-btn">
                Confirm
              </button>
              <button onClick={handleNamePopupCancel} className="popup-cancel-btn">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Window */}
      {showSettings && (
        <div className="popup-overlay">
          <div className="settings-window">
            <div className="settings-header">
              <h3>Settings</h3>
              <button onClick={() => setShowSettings(false)} className="close-btn">×</button>
            </div>
            <div className="settings-content">
              <div className="settings-section">
                <label>Your Name</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter your name"
                  className="settings-input"
                />
              </div>
            </div>
            <div className="settings-footer">
              <button onClick={handleSettingsSave} className="settings-save-btn">
                Save
              </button>
              <button onClick={() => setShowSettings(false)} className="settings-cancel-btn">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Conference;

