import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { getCookie, setCookie } from '../utils/cookies';
import './Conference.css';

// Icon paths - using public folder
// For React apps, files in public folder are served from root
const iconPaths = {
  micOn: '/icons/mic-on.png',
  micOff: '/icons/video-off.png', // video-off.png actually contains the crossed mic icon
  videoOn: '/icons/video-on.png',
  videoOff: '/icons/copy-link.png', // copy-link.png actually contains the crossed camera icon
  screenShare: '/icons/screen-share.png',
  screenRecord: '/icons/screen-record.png',
  endCall: '/icons/mic-off.png', // mic-off.png actually contains the Decline/End Call icon
  copyLink: '/icons/end-call.png', // end-call.png actually contains the Link icon
};

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001';
const AGORA_APP_ID = process.env.REACT_APP_AGORA_APP_ID || '';

// Icons Component Wrappers with error handling
const IconImg = ({ src, alt, className }) => {
  const [imgError, setImgError] = useState(false);
  
  useEffect(() => {
    console.log(`Loading icon: ${src}`);
  }, [src]);
  
  if (imgError) {
    // Fallback: show text if image fails
    return <span className={className} style={{ fontSize: '12px', color: 'white' }}>{alt}</span>;
  }
  
  return (
    <img 
      src={src} 
      alt={alt} 
      className={className}
      style={{ pointerEvents: 'none' }} // Prevent icon from blocking button clicks
      onError={(e) => {
        console.error(`Failed to load icon: ${src}`);
        setImgError(true);
      }}
      onLoad={() => {
        console.log(`Successfully loaded icon: ${src}`);
      }}
    />
  );
};

const Icons = {
  Mic: () => <IconImg src={iconPaths.micOn} alt="Mic On" className="control-icon" />,
  MicOff: () => <IconImg src={iconPaths.micOff} alt="Mic Off" className="control-icon" />,
  Video: () => <IconImg src={iconPaths.videoOn} alt="Video On" className="control-icon" />,
  VideoOff: () => <IconImg src={iconPaths.videoOff} alt="Video Off" className="control-icon" />,
  ScreenShare: () => <IconImg src={iconPaths.screenShare} alt="Screen Share" className="control-icon" />,
  ScreenShareActive: () => <IconImg src={iconPaths.screenShare} alt="Screen Share Active" className="control-icon active" />,
  Record: () => <IconImg src={iconPaths.screenRecord} alt="Screen Record" className="control-icon" />,
  RecordActive: () => <IconImg src={iconPaths.screenRecord} alt="Screen Record Active" className="control-icon active" />,
  CallEnd: () => <IconImg src={iconPaths.endCall} alt="End Call" className="control-icon end-call" />,
  Copy: () => <IconImg src={iconPaths.copyLink} alt="Copy Link" className="control-icon copy-link" />,
  
  // Keep standard SVGs for sidebar toggles as images weren't provided for them, or use placeholders if preferred. 
  // User only provided icons for bottom center controls and copy link.
  Info: () => <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>,
  People: () => <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>,
  Chat: () => <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>,
};

function Conference() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [userName, setUserName] = useState('Caller');
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showNamePopup, setShowNamePopup] = useState(false);
  const [popupNameInput, setPopupNameInput] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false); // Added video toggle state
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // UI States
  const [currentTime, setCurrentTime] = useState('');
  const [activeSidebar, setActiveSidebar] = useState(null); // 'people', 'chat', 'info'
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuExpanded, setMobileMenuExpanded] = useState(false);

  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideosRef = useRef({});
  const localStreamRef = useRef(null);
  const screenShareStreamRef = useRef(null);
  const currentSocketIdRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const agoraClientRef = useRef(null); // Agora RTC client
  const localAudioTrackRef = useRef(null);
  const localVideoTrackRef = useRef(null);
  const localScreenTrackRef = useRef(null);
  const remoteUsersRef = useRef({}); // Map socketId -> Agora remote user

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

    // Initialize Agora RTC Client
    if (!AGORA_APP_ID) {
      console.error('❌ [Agora] AGORA_APP_ID is not set. Please set REACT_APP_AGORA_APP_ID environment variable.');
      alert('Agora App ID is missing. Please configure REACT_APP_AGORA_APP_ID in your environment variables.');
      return;
    }

    agoraClientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    
    // Set up Agora event handlers
    agoraClientRef.current.on('user-published', async (user, mediaType) => {
      console.log('🎥 [Agora] User published:', user.uid, 'mediaType:', mediaType);
      await agoraClientRef.current.subscribe(user, mediaType);
      
      if (mediaType === 'video') {
        // Find socketId for this Agora UID (we'll use socketId as UID)
        const socketId = Object.keys(remoteUsersRef.current).find(
          sid => remoteUsersRef.current[sid]?.uid === user.uid
        ) || user.uid.toString();
        
        const videoElement = remoteVideosRef.current[socketId];
        if (videoElement) {
          user.videoTrack.play(videoElement);
          console.log('✅ [Agora] Playing remote video for:', socketId);
        } else {
          console.warn('⚠️ [Agora] Video element not found for:', socketId);
        }
      }
      
      if (mediaType === 'audio') {
        user.audioTrack.play();
        console.log('🔊 [Agora] Playing remote audio for:', user.uid);
      }
    });

    agoraClientRef.current.on('user-unpublished', (user, mediaType) => {
      console.log('👋 [Agora] User unpublished:', user.uid, 'mediaType:', mediaType);
      if (mediaType === 'video') {
        const socketId = Object.keys(remoteUsersRef.current).find(
          sid => remoteUsersRef.current[sid]?.uid === user.uid
        ) || user.uid.toString();
        const videoElement = remoteVideosRef.current[socketId];
        if (videoElement) {
          user.videoTrack.stop();
        }
      }
    });

    agoraClientRef.current.on('user-left', (user) => {
      console.log('👋 [Agora] User left:', user.uid);
      const socketId = Object.keys(remoteUsersRef.current).find(
        sid => remoteUsersRef.current[sid]?.uid === user.uid
      );
      if (socketId) {
        delete remoteUsersRef.current[socketId];
      }
    });

    // Get user media and create Agora tracks
    AgoraRTC.createMicrophoneAndCameraTracks({}, {})
      .then(([audioTrack, videoTrack]) => {
        localAudioTrackRef.current = audioTrack;
        localVideoTrackRef.current = videoTrack;
        
        // Create a MediaStream from Agora tracks for local video display
        const stream = new MediaStream([audioTrack.getMediaStreamTrack(), videoTrack.getMediaStreamTrack()]);
        localStreamRef.current = stream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Initialize mute state
        setIsMuted(!audioTrack.isPlaying);
        
        // Initialize video state
        setIsVideoOff(!videoTrack.isPlaying);

        // Join Agora channel using roomId
        const uid = socketRef.current?.id || Math.floor(Math.random() * 100000);
        agoraClientRef.current.join(AGORA_APP_ID, roomId, null, uid)
          .then(() => {
            console.log('✅ [Agora] Joined channel:', roomId, 'with UID:', uid);
            // Publish local tracks
            return agoraClientRef.current.publish([audioTrack, videoTrack]);
          })
          .then(() => {
            console.log('✅ [Agora] Published local tracks');
          })
          .catch(err => {
            console.error('❌ [Agora] Error joining/publishing:', err);
          });
        
        // Join room with name from cookie (or "Caller" if not set)
        const nameToUse = getCookie('userName') || 'Caller';
        socketRef.current.emit('join-room', roomId, nameToUse);
      })
      .catch(err => {
        console.error('❌ [Agora] Error creating tracks:', err);
        alert('Could not access camera/microphone. Please allow permissions.');
      });

    // Socket event handlers (for user list and chat - video handled by Agora)
    socketRef.current.on('user-joined', ({ socketId, userName }) => {
      console.log('👤 [Socket] User joined:', { socketId, userName });
      // Agora handles video automatically, this is just for user list
    });
    socketRef.current.on('existing-users', (users) => {
      console.log('👥 [Socket] Existing users:', users);
      // Agora handles video automatically, this is just for user list
    });
    socketRef.current.on('user-left', handleUserLeft);
    socketRef.current.on('user-list', handleUserList);
    socketRef.current.on('chat-message', handleChatMessage);

    return () => {
      // Cleanup
      // Stop recording if active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
      
      // Stop Agora tracks
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop();
        localVideoTrackRef.current.close();
        localVideoTrackRef.current = null;
      }
      if (localScreenTrackRef.current) {
        localScreenTrackRef.current.stop();
        localScreenTrackRef.current.close();
        localScreenTrackRef.current = null;
      }
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (screenShareStreamRef.current) {
        screenShareStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Leave Agora channel
      if (agoraClientRef.current) {
        agoraClientRef.current.leave().then(() => {
          console.log('✅ [Agora] Left channel');
        }).catch(err => {
          console.error('❌ [Agora] Error leaving channel:', err);
        });
      }
      
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [roomId]);

  // Note: createPeerConnection removed - Agora handles all connections automatically

  // Note: handleUserJoined and handleExistingUsers are no longer needed
  // Agora automatically handles all users in the channel through event handlers

  const handleUserLeft = (socketId) => {
    console.log('👋 [Socket] User left:', socketId);
    // Agora handles video cleanup automatically through user-left event
    // Just clean up local references
    delete remoteUsersRef.current[socketId];
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
    if (localAudioTrackRef.current) {
      const newMutedState = !isMuted;
      if (newMutedState) {
        localAudioTrackRef.current.setEnabled(false);
      } else {
        localAudioTrackRef.current.setEnabled(true);
      }
      setIsMuted(newMutedState);
      console.log('🔇 [Agora] Mute toggled:', newMutedState);
    }
  };

  const toggleVideo = () => {
    if (localVideoTrackRef.current) {
      const newVideoState = !isVideoOff;
      if (newVideoState) {
        localVideoTrackRef.current.setEnabled(false);
      } else {
        localVideoTrackRef.current.setEnabled(true);
      }
      setIsVideoOff(newVideoState);
      console.log('📹 [Agora] Video toggled:', !newVideoState);
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        // Stop screen sharing and switch back to camera
        console.log('🛑 [Agora ScreenShare] Stopping screen share');
        
        if (screenShareStreamRef.current) {
          screenShareStreamRef.current.getTracks().forEach(track => {
            track.stop();
            console.log('🛑 [ScreenShare] Stopped track:', track.kind);
          });
          screenShareStreamRef.current = null;
        }

        // Switch back to camera
        if (!localStreamRef.current) {
          console.warn('⚠️ [ScreenShare] No local stream to restore');
          return;
        }

        // Create new camera video track with Agora
        const cameraVideoTrack = await AgoraRTC.createCameraVideoTrack();
        localVideoTrackRef.current = cameraVideoTrack;
        
        // Publish new camera track
        await agoraClientRef.current.publish([cameraVideoTrack]);
        
        // Update local video display
        if (localVideoRef.current) {
          cameraVideoTrack.play(localVideoRef.current);
        }
        
        // Update local stream for MediaRecorder compatibility
        const stream = new MediaStream([cameraVideoTrack.getMediaStreamTrack()]);
        if (localAudioTrackRef.current) {
          stream.addTrack(localAudioTrackRef.current.getMediaStreamTrack());
        }
        localStreamRef.current = stream;

        setIsScreenSharing(false);
        console.log('✅ [Agora ScreenShare] Screen share stopped, camera restored');
      } else {
        // Start screen sharing
        console.log('📺 [Agora ScreenShare] Starting screen share');
        
        const screenVideoTrack = await AgoraRTC.createScreenVideoTrack({}, 'auto');
        
        // Handle user stopping screen share from browser UI
        if (screenVideoTrack.getMediaStreamTrack) {
          screenVideoTrack.getMediaStreamTrack().addEventListener('ended', () => {
            console.log('🛑 [Agora ScreenShare] Screen share ended by user');
            if (isScreenSharing) {
              setIsScreenSharing(false);
              toggleScreenShare();
            }
          });
        }
        
        localScreenTrackRef.current = screenVideoTrack;
        
        // Unpublish camera video track
        if (localVideoTrackRef.current) {
          await agoraClientRef.current.unpublish([localVideoTrackRef.current]);
        }
        
        // Publish screen track
        await agoraClientRef.current.publish([screenVideoTrack]);
        
        // Update local video display
        if (localVideoRef.current) {
          screenVideoTrack.play(localVideoRef.current);
        }
        
        // Update local stream for MediaRecorder compatibility
        const stream = new MediaStream([screenVideoTrack.getMediaStreamTrack()]);
        if (localAudioTrackRef.current) {
          stream.addTrack(localAudioTrackRef.current.getMediaStreamTrack());
        }
        localStreamRef.current = stream;
        screenShareStreamRef.current = stream;

        setIsScreenSharing(true);
        console.log('✅ [Agora ScreenShare] Screen share started successfully');
      }
    } catch (error) {
      console.error('❌ [ScreenShare] Error toggling screen share:', error);
      if (error.name === 'NotAllowedError') {
        alert('Screen sharing permission was denied. Please allow screen sharing in your browser settings.');
      } else if (error.name === 'NotFoundError') {
        alert('No screen sharing source found. Please make sure you have a screen to share.');
      } else {
        alert(`Error starting screen share: ${error.message}`);
      }
      setIsScreenSharing(false);
    }
  };

  const toggleScreenRecord = async () => {
    try {
      if (isRecording) {
        // Stop recording
        console.log('🛑 [Record] Stopping recording');
        
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current = null;
        }
        
        setIsRecording(false);
      } else {
        // Start recording
        console.log('🔴 [Record] Starting recording');
        
        // Collect all video and audio tracks from local and remote streams
        const allTracks = [];
        
        // Add local stream tracks
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => {
            if (track.enabled && track.readyState === 'live') {
              allTracks.push(track);
            }
          });
        }
        
        // Add remote stream tracks
        Object.values(remoteVideosRef.current).forEach(videoElement => {
          if (videoElement && videoElement.srcObject) {
            const stream = videoElement.srcObject;
            stream.getTracks().forEach(track => {
              if (track.enabled && track.readyState === 'live') {
                allTracks.push(track);
              }
            });
          }
        });
        
        if (allTracks.length === 0) {
          alert('No active streams to record. Please make sure video/audio is enabled.');
          return;
        }
        
        console.log('📹 [Record] Tracks to record:', {
          total: allTracks.length,
          video: allTracks.filter(t => t.kind === 'video').length,
          audio: allTracks.filter(t => t.kind === 'audio').length
        });
        
        // Create a combined stream
        const combinedStream = new MediaStream();
        allTracks.forEach(track => {
          combinedStream.addTrack(track);
        });
        
        // Check if MediaRecorder is supported
        if (!MediaRecorder.isTypeSupported('video/webm')) {
          alert('Recording is not supported in this browser. Please use Chrome or Firefox.');
          return;
        }
        
        // Create MediaRecorder
        const options = {
          mimeType: 'video/webm;codecs=vp9,opus',
          videoBitsPerSecond: 2500000 // 2.5 Mbps
        };
        
        // Fallback to default if codec not supported
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options.mimeType = 'video/webm';
        }
        
        const recorder = new MediaRecorder(combinedStream, options);
        const chunks = [];
        
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data);
            console.log('📹 [Record] Data chunk received:', event.data.size, 'bytes');
          }
        };
        
        recorder.onstop = () => {
          console.log('🛑 [Record] Recording stopped, creating file');
          
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          
          // Create download link
          const a = document.createElement('a');
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const fileName = `conference-recording-${timestamp}.webm`;
          
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          // Clean up
          URL.revokeObjectURL(url);
          
          console.log('✅ [Record] File saved:', fileName, `(${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
          alert(`Recording saved as ${fileName}`);
        };
        
        recorder.onerror = (event) => {
          console.error('❌ [Record] Recording error:', event.error);
          alert('Error during recording: ' + event.error.message);
          setIsRecording(false);
        };
        
        // Start recording
        recorder.start(1000); // Collect data every second
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        
        console.log('✅ [Record] Recording started');
      }
    } catch (error) {
      console.error('❌ [Record] Error toggling recording:', error);
      alert(`Error starting recording: ${error.message}`);
      setIsRecording(false);
    }
  };

  const endConference = () => {
    // Stop recording if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setIsRecording(false);
    }
    
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(track => track.stop());
    if (screenShareStreamRef.current) screenShareStreamRef.current.getTracks().forEach(track => track.stop());
    navigate('/');
  };

  const copyConferenceLink = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const link = `${window.location.origin}/guest-join/${roomId}`;
    console.log('Copy link clicked, link:', link);
    
      try {
        // Try modern clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
          console.log('Using clipboard API');
          await navigator.clipboard.writeText(link);
          console.log('Link copied successfully');
          alert('Link copied to clipboard!');
        } else {
          console.log('Using fallback method');
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = link;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          
          try {
            const successful = document.execCommand('copy');
            if (successful) {
              console.log('Link copied with fallback method');
              alert('Link copied to clipboard!');
            } else {
              console.error('Failed to copy link');
              alert(`Link: ${link}\n\nPlease copy this link manually.`);
            }
          } catch (err) {
            console.error('Fallback copy failed:', err);
            alert(`Link: ${link}\n\nPlease copy this link manually.`);
          } finally {
            document.body.removeChild(textArea);
          }
        }
      } catch (err) {
        console.error('Failed to copy link:', err);
        // Show link in alert as last resort
        alert(`Link: ${link}\n\nPlease copy this link manually.\n\nError: ${err.message}`);
      }
  };

  const handleNamePopupConfirm = () => {
    const newName = popupNameInput.trim() || 'Caller';
    setUserName(newName);
    setCookie('userName', newName);
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
                ref={el => { 
                  if (el) {
                    console.log('📹 [Render] Video element created/updated for socketId:', user.socketId, {
                      userName: user.userName,
                      allVideoElements: Object.keys(remoteVideosRef.current)
                    });
                    
                    // Check if there was an old element with a stream
                    const oldElement = remoteVideosRef.current[user.socketId];
                    const oldStream = oldElement && oldElement.srcObject;
                    
                    remoteVideosRef.current[user.socketId] = el;
                    
                    // If old element had a stream, reattach it to new element
                    if (oldStream && !el.srcObject) {
                      console.log('🔄 [Render] Reattaching stream to new video element', {
                        streamId: oldStream.id,
                        hasVideoTracks: oldStream.getVideoTracks().length,
                        hasAudioTracks: oldStream.getAudioTracks().length
                      });
                      
                      // Ensure new element is properly configured
                      el.setAttribute('autoplay', 'true');
                      el.setAttribute('playsinline', 'true');
                      el.autoplay = true;
                      el.playsInline = true;
                      el.muted = true; // Start muted for autoplay
                      
                      el.srcObject = oldStream;
                      
                      // Try to play if track is live
                      const videoTrack = oldStream.getVideoTracks()[0];
                      if (videoTrack && videoTrack.readyState === 'live') {
                        console.log('🔄 [Render] Track is live, attempting play on reattached element');
                        
                        // Wait for metadata before playing
                        const handleReattachMetadata = () => {
                          console.log('✅ [Render] Reattached element metadata loaded, readyState:', el.readyState);
                          el.removeEventListener('loadedmetadata', handleReattachMetadata);
                          if (el && el.srcObject === oldStream && el.paused) {
                            el.play()
                              .then(() => {
                                console.log('✅ [Render] Reattached video playing');
                                // Try unmuting after a moment
                                setTimeout(() => {
                                  if (el && el.srcObject === oldStream) {
                                    el.muted = false;
                                  }
                                }, 1000);
                              })
                              .catch(err => {
                                console.warn('⚠️ [Render] Reattached video play failed:', err.name);
                              });
                          }
                        };
                        el.addEventListener('loadedmetadata', handleReattachMetadata, { once: true });
                        
                        // Fallback: try playing after delay
                        setTimeout(() => {
                          if (el && el.srcObject === oldStream && el.paused) {
                            console.log('🔄 [Render] Fallback play attempt for reattached element');
                            el.play()
                              .then(() => {
                                console.log('✅ [Render] Reattached video playing (fallback)');
                                setTimeout(() => {
                                  if (el && el.srcObject === oldStream) {
                                    el.muted = false;
                                  }
                                }, 1000);
                              })
                              .catch(() => {});
                          }
                        }, 500);
                      } else {
                        console.warn('⚠️ [Render] Track not live when reattaching:', {
                          hasTrack: !!videoTrack,
                          readyState: videoTrack?.readyState
                        });
                      }
                    }
                  } else {
                    // Element was removed - but keep the ref if stream exists
                    if (remoteVideosRef.current[user.socketId]) {
                      const oldElement = remoteVideosRef.current[user.socketId];
                      const hasStream = oldElement && oldElement.srcObject;
                      if (hasStream) {
                        console.log('⚠️ [Render] Video element ref removed but stream exists, keeping ref for socketId:', user.socketId);
                        // Don't delete - the element might be recreated
                      } else {
                        console.log('📹 [Render] Video element removed for socketId:', user.socketId);
                        delete remoteVideosRef.current[user.socketId];
                      }
                    }
                  }
                }}
                autoPlay
                playsInline
                muted={false}
                className="meet-video"
              />
              <div className="meet-name-tag">{user.userName}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="meet-bottom-bar">
        {!isMobile && (
          <div className="meet-bottom-left">
            <div className="meet-time">{currentTime}</div>
            <div className="meet-separator">|</div>
            <div className="meet-code">{roomId}</div>
          </div>
        )}

        <div className="meet-bottom-center">
          <button 
            className="meet-control-btn image-btn"
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <Icons.MicOff /> : <Icons.Mic />}
          </button>
          
          <button 
            className="meet-control-btn image-btn"
            onClick={toggleVideo}
            title={isVideoOff ? "Turn on camera" : "Turn off camera"}
          >
            {isVideoOff ? <Icons.VideoOff /> : <Icons.Video />}
          </button>

          {(!isMobile || mobileMenuExpanded) && (
            <button 
              className="meet-control-btn image-btn"
              onClick={toggleScreenShare}
              title="Present now"
            >
              {isScreenSharing ? <Icons.ScreenShareActive /> : <Icons.ScreenShare />}
            </button>
          )}

          {(!isMobile || mobileMenuExpanded) && (
            <button 
              className={`meet-control-btn image-btn ${isRecording ? 'recording' : ''}`}
              onClick={toggleScreenRecord}
              title={isRecording ? "Stop recording" : "Start recording"}
            >
              {isRecording ? <Icons.RecordActive /> : <Icons.Record />}
            </button>
          )}

          <button 
            className="meet-control-btn image-btn"
            onClick={endConference}
            title="Leave call"
          >
            <Icons.CallEnd />
          </button>

          {isMobile && (
            <button 
              className="meet-control-btn mobile-expand-btn"
              onClick={() => setMobileMenuExpanded(!mobileMenuExpanded)}
              title={mobileMenuExpanded ? "Collapse" : "More options"}
            >
              {mobileMenuExpanded ? '▼' : '▲'}
            </button>
          )}
        </div>

        {(!isMobile || mobileMenuExpanded) && (
          <div className="meet-bottom-right">
            <button 
              className="meet-action-btn copy-link-btn image-btn" 
              title="Copy link"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Copy button clicked - handler fired!');
                copyConferenceLink(e);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Copy button mousedown');
              }}
              style={{ 
                borderRadius: '24px', 
                padding: '0',
                background: 'transparent',
                width: '109px',
                height: '109px',
                border: 'none',
                boxShadow: 'none',
                cursor: 'pointer',
                zIndex: 100,
                position: 'relative'
              }}
            >
              <Icons.Copy />
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
        )}
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
