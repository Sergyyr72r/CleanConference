import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { getCookie, setCookie } from '../utils/cookies';
import './Conference.css';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001';

// Icons
const Icons = {
  Mic: () => <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 2.34 9 5v6c0 1.66 1.34 3 3 3z"/><path fill="currentColor" d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>,
  MicOff: () => <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02 5.01L7.75 8.78l1.22-1.23.03.01C9 7.55 9 7.55 9 7.56V5c0-1.66-1.34-3-3-3S3 3.34 3 5v.01l.01.02.01.03-.01-.06L3 5c0-1.1.9-2 2-2s2 .9 2 2v2.55l3.58 3.58c.21.6.32 1.25.32 1.93 0 2.76-2.24 5-5 5s-5-2.24-5-5H.82c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c1.37-.2 2.63-.78 3.68-1.58l3.15 3.15 1.41-1.41-5.08-5.07z"/></svg>,
  Video: () => <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M18 10.48V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4.48l4 3.98v-11l-4 3.98zm-2-.79V18H4V6h12v3.69z"/></svg>,
  VideoOff: () => <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M21 6.5l-4 4V6c0-1.1-.9-2-2-2H9.82L21 15.18V6.5zM3.27 2L2 3.27 4.73 6H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-1.27l2.73 2.73L22 19.73 3.27 2zM6 18V8h1.82l10 10H6z"/></svg>,
  ScreenShare: () => <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.11-.9-2-2-2H4c-1.11 0-2 .89-2 2v10c0 1.1.89 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/></svg>,
  ScreenShareActive: () => <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.11-.9-2-2-2H4c-1.11 0-2 .89-2 2v10c0 1.1.89 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6zm9-2h-2v-3l-2.5 2.5L7 2l5 5V4h2v4z"/></svg>,
  CallEnd: () => <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>,
  Info: () => <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>,
  People: () => <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>,
  Chat: () => <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>,
  Copy: () => <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
};

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
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false); // Added video toggle state
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // UI States
  const [currentTime, setCurrentTime] = useState('');
  const [activeSidebar, setActiveSidebar] = useState(null); // 'people', 'chat', 'info'

  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideosRef = useRef({});
  const peerConnectionsRef = useRef({});
  const localStreamRef = useRef(null);
  const screenShareStreamRef = useRef(null);
  const currentSocketIdRef = useRef(null);

  useEffect(() => {
    // Clock
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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

        // Initialize mute state based on audio track
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          setIsMuted(!audioTracks[0].enabled);
        }

        // Initialize video state
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0) {
          setIsVideoOff(!videoTracks[0].enabled);
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
      if (screenShareStreamRef.current) {
        screenShareStreamRef.current.getTracks().forEach(track => track.stop());
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
        // ... (Keep existing ICE servers)
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
      if (event.streams && event.streams[0]) {
        const setVideoStream = (videoElement) => {
          if (videoElement) {
            videoElement.srcObject = event.streams[0];
            videoElement.play().catch(err => console.warn('Error playing remote video:', err));
          }
        };

        let videoElement = remoteVideosRef.current[socketId];
        
        if (videoElement) {
          setVideoStream(videoElement);
        } else {
          let retries = 0;
          const retryInterval = setInterval(() => {
            videoElement = remoteVideosRef.current[socketId];
            if (videoElement) {
              setVideoStream(videoElement);
              clearInterval(retryInterval);
            } else if (retries >= 10) {
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
        socketRef.current.emit('ice-candidate', {
          target: socketId,
          candidate: event.candidate
        });
      }
    };

    return pc;
  };

  const handleUserJoined = async ({ socketId, userName: name }) => {
    let pc = peerConnectionsRef.current[socketId];
    if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
      pc = createPeerConnection(socketId);
      peerConnectionsRef.current[socketId] = pc;
    }
    if (pc.signalingState === 'stable') {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current.emit('offer', { target: socketId, offer: offer });
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    }
  };

  const handleExistingUsers = async (users) => {
    for (const user of users) {
      let pc = peerConnectionsRef.current[user.socketId];
      if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
        pc = createPeerConnection(user.socketId);
        peerConnectionsRef.current[user.socketId] = pc;
      }
      if (pc.signalingState === 'stable') {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current.emit('offer', { target: user.socketId, offer: offer });
        } catch (error) {
          console.error('Error creating offer:', error);
        }
      }
    }
  };

  const handleOffer = async ({ offer, sender }) => {
    let pc = peerConnectionsRef.current[sender];
    if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
      pc = createPeerConnection(sender);
      peerConnectionsRef.current[sender] = pc;
    }
    if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current.emit('answer', { target: sender, answer: answer });
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    }
  };

  const handleAnswer = async ({ answer, sender }) => {
    const pc = peerConnectionsRef.current[sender];
    if (pc && pc.signalingState === 'have-local-offer') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        console.error('Error setting remote answer:', error);
      }
    }
  };

  const handleIceCandidate = async ({ candidate, sender }) => {
    const pc = peerConnectionsRef.current[sender];
    if (pc && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        if (error.name !== 'OperationError') console.error('Error adding ICE candidate:', error);
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
    const currentSocketId = currentSocketIdRef.current || socketRef.current?.id;
    const otherUsers = userList.filter(user => user.socketId !== currentSocketId);
    setUsers(otherUsers);
    
    otherUsers.forEach(user => {
      if (!remoteVideosRef.current[user.socketId]) {
        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.className = 'meet-remote-video';
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

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const newMutedState = !isMuted;
        audioTracks.forEach(track => { track.enabled = !newMutedState; });
        setIsMuted(newMutedState);
        
        Object.values(peerConnectionsRef.current).forEach(pc => {
          pc.getSenders().forEach(sender => {
            if (sender.track && sender.track.kind === 'audio') {
              sender.track.enabled = !newMutedState;
            }
          });
        });
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const newVideoState = !isVideoOff;
        videoTracks.forEach(track => { track.enabled = !newVideoState; });
        setIsVideoOff(newVideoState);
        
        // We don't need to update peer connections for video track enabled/disabled, 
        // WebRTC handles black frames automatically, but we can if needed.
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        // Stop screen sharing
        if (screenShareStreamRef.current) {
          screenShareStreamRef.current.getTracks().forEach(track => track.stop());
          screenShareStreamRef.current = null;
        }

        // Switch back to camera
        const cameraStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: !isMuted
        });
        
        const videoTrack = cameraStream.getVideoTracks()[0];
        
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const videoSender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (videoSender) videoSender.replaceTrack(videoTrack);
        });

        if (localStreamRef.current) {
          const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldVideoTrack) {
            localStreamRef.current.removeTrack(oldVideoTrack);
            oldVideoTrack.stop();
          }
          localStreamRef.current.addTrack(videoTrack);
        } else {
          localStreamRef.current = cameraStream;
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        setIsScreenSharing(false);
      } else {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        
        screenStream.getVideoTracks()[0].addEventListener('ended', () => {
          if (isScreenSharing) toggleScreenShare();
        });

        screenShareStreamRef.current = screenStream;
        const videoTrack = screenStream.getVideoTracks()[0];
        
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) sender.replaceTrack(videoTrack);
        });

        if (localStreamRef.current) {
          const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldVideoTrack) {
            localStreamRef.current.removeTrack(oldVideoTrack);
            oldVideoTrack.stop();
          }
          localStreamRef.current.addTrack(videoTrack);
          if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current; // Self view shows screen
        }

        setIsScreenSharing(true);
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
    }
  };

  const endConference = () => {
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(track => track.stop());
    if (screenShareStreamRef.current) screenShareStreamRef.current.getTracks().forEach(track => track.stop());
    navigate('/');
  };

  const copyConferenceLink = () => {
    const link = `${window.location.origin}/guest-join/${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const handleNamePopupConfirm = () => {
    const newName = popupNameInput.trim() || 'Caller';
    setUserName(newName);
    setCookie('userName', newName);
    setNameInput(newName);
    setShowNamePopup(false);
    if (socketRef.current) socketRef.current.emit('update-name', newName);
  };

  return (
    <div className="meet-container">
      <div className="meet-main-area">
        <div className="meet-video-grid">
          {/* Local Video */}
          <div className="meet-video-container local">
             <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`meet-video ${isVideoOff ? 'hidden' : ''}`}
            />
            {isVideoOff && <div className="meet-avatar-placeholder">{userName.charAt(0)}</div>}
            <div className="meet-name-tag">You ({userName})</div>
          </div>

          {/* Remote Videos */}
          {users.map(user => (
            <div key={user.socketId} className="meet-video-container">
              <video
                ref={el => { if (el) remoteVideosRef.current[user.socketId] = el; }}
                autoPlay
                playsInline
                className="meet-video"
              />
              <div className="meet-name-tag">{user.userName}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="meet-bottom-bar">
        <div className="meet-bottom-left">
          <div className="meet-time">{currentTime}</div>
          <div className="meet-separator">|</div>
          <div className="meet-code">{roomId}</div>
        </div>

        <div className="meet-bottom-center">
          <button 
            className={`meet-control-btn ${isMuted ? 'active-red' : ''}`} 
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <Icons.Mic /> : <Icons.MicOff />}
          </button>
          
          <button 
            className={`meet-control-btn ${isVideoOff ? 'active-red' : ''}`} 
            onClick={toggleVideo}
            title={isVideoOff ? "Turn on camera" : "Turn off camera"}
          >
            {isVideoOff ? <Icons.Video /> : <Icons.VideoOff />}
          </button>

          <button 
            className={`meet-control-btn ${isScreenSharing ? 'active-blue' : ''}`} 
            onClick={toggleScreenShare}
            title="Present now"
          >
            {isScreenSharing ? <Icons.ScreenShareActive /> : <Icons.ScreenShare />}
          </button>

          <button 
            className="meet-control-btn end-call-btn" 
            onClick={endConference}
            title="Leave call"
          >
            <Icons.CallEnd />
          </button>
        </div>

        <div className="meet-bottom-right">
          <button 
            className="meet-action-btn copy-link-btn" 
            title="Copy link"
            onClick={copyConferenceLink}
            style={{ 
              borderRadius: '24px', 
              padding: '0 16px', 
              gap: '8px', 
              background: '#8ab4f8', 
              color: '#202124',
              width: 'auto',
              fontWeight: 500
            }}
          >
            <Icons.Copy />
            <span>{copySuccess ? 'Copied' : 'Copy link'}</span>
          </button>

          <button className="meet-action-btn" title="Meeting details" onClick={copyConferenceLink}>
            <Icons.Info />
          </button>
          
          <button 
            className={`meet-action-btn ${activeSidebar === 'people' ? 'active' : ''}`}
            onClick={() => setActiveSidebar(activeSidebar === 'people' ? null : 'people')}
            title="Show everyone"
          >
            <Icons.People />
          </button>
          
          <button 
            className={`meet-action-btn ${activeSidebar === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveSidebar(activeSidebar === 'chat' ? null : 'chat')}
            title="Chat with everyone"
          >
            <Icons.Chat />
          </button>
        </div>
      </div>

      {/* Sidebars */}
      {activeSidebar === 'chat' && (
        <div className="meet-sidebar">
          <div className="meet-sidebar-header">
            <h3>In-call messages</h3>
            <button className="close-btn" onClick={() => setActiveSidebar(null)}>×</button>
          </div>
          <div className="meet-chat-messages">
             {messages.map((msg, idx) => (
                <div key={idx} className="meet-message">
                  <strong>{msg.userName}</strong>
                  <span>{msg.currentTime}</span>
                  <p>{msg.message}</p>
                </div>
              ))}
          </div>
          <div className="meet-chat-input-area">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Send a message to everyone"
            />
            <button onClick={sendMessage}><Icons.Chat /></button>
          </div>
        </div>
      )}

      {activeSidebar === 'people' && (
        <div className="meet-sidebar">
          <div className="meet-sidebar-header">
            <h3>People</h3>
            <button className="close-btn" onClick={() => setActiveSidebar(null)}>×</button>
          </div>
          <div className="meet-people-list">
             <div className="meet-person">
               <div className="meet-person-avatar">{userName.charAt(0)}</div>
               <div className="meet-person-name">{userName} (You)</div>
             </div>
             {users.map(user => (
               <div key={user.socketId} className="meet-person">
                 <div className="meet-person-avatar">{user.userName.charAt(0)}</div>
                 <div className="meet-person-name">{user.userName}</div>
               </div>
             ))}
          </div>
        </div>
      )}

      {/* Name Popup */}
      {showNamePopup && (
        <div className="popup-overlay">
          <div className="popup-box">
            <h3>What's your name?</h3>
            <input
              type="text"
              value={popupNameInput}
              onChange={(e) => setPopupNameInput(e.target.value)}
              className="popup-input"
              autoFocus
              onKeyPress={(e) => e.key === 'Enter' && handleNamePopupConfirm()}
            />
            <button onClick={handleNamePopupConfirm} className="popup-confirm-btn">Ask to join</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Conference;
