import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
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
  endCall: '/icons/mic-off.png', // mic-off.png actually contains the Decline/End Call icon
  copyLink: '/icons/end-call.png', // end-call.png actually contains the Link icon
};

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001';

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
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuExpanded, setMobileMenuExpanded] = useState(false);

  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideosRef = useRef({});
  const peerConnectionsRef = useRef({});
  const localStreamRef = useRef(null);
  const screenShareStreamRef = useRef(null);
  const currentSocketIdRef = useRef(null);

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
    console.log('🔌 [WebRTC] Creating peer connection for socketId:', socketId);
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        // ... (Keep existing ICE servers)
      ],
      iceCandidatePoolSize: 10
    });

    // Add local stream tracks
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getTracks();
      console.log('📤 [WebRTC] Adding local tracks:', {
        socketId,
        videoTracks: tracks.filter(t => t.kind === 'video').length,
        audioTracks: tracks.filter(t => t.kind === 'audio').length
      });
      tracks.forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    } else {
      console.warn('⚠️ [WebRTC] No local stream available when creating peer connection');
    }

    // Log connection state changes
    pc.onconnectionstatechange = () => {
      console.log('🔌 [WebRTC] Connection state changed:', {
        socketId,
        state: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        iceGatheringState: pc.iceGatheringState
      });
      
      // If connection fails but ICE is still connected, try to recover
      if (pc.connectionState === 'failed' && (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed')) {
        console.log('🔄 [WebRTC] Connection failed but ICE connected - attempting recovery');
        const videoElement = remoteVideosRef.current[socketId];
        if (videoElement && videoElement.srcObject) {
          const stream = videoElement.srcObject;
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack && videoTrack.readyState === 'live') {
            console.log('🔄 [WebRTC] Video track is live, forcing play');
            setTimeout(() => {
              if (videoElement && videoElement.srcObject === stream && videoElement.paused) {
                videoElement.play().then(() => {
                  console.log('✅ [WebRTC] Recovery play succeeded');
                }).catch(err => {
                  console.warn('⚠️ [WebRTC] Recovery play failed:', err);
                });
              }
            }, 500);
          }
        }
      }
    };
    
    pc.oniceconnectionstatechange = () => {
      console.log('🧊 [WebRTC] ICE connection state:', {
        socketId,
        state: pc.iceConnectionState
      });
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('🎥 [WebRTC] ontrack event received for socketId:', socketId);
      console.log('🎥 [WebRTC] Event details:', {
        streams: event.streams?.length || 0,
        track: event.track?.kind,
        trackId: event.track?.id,
        trackEnabled: event.track?.enabled,
        trackReadyState: event.track?.readyState
      });
      
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        console.log('🎥 [WebRTC] Stream received:', {
          streamId: stream.id,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          videoTrackId: stream.getVideoTracks()[0]?.id,
          videoTrackEnabled: stream.getVideoTracks()[0]?.enabled,
          videoTrackReadyState: stream.getVideoTracks()[0]?.readyState
        });
        const setVideoStream = (videoElement) => {
          if (!videoElement) {
            console.warn('⚠️ [WebRTC] Video element not found for socketId:', socketId);
            return;
          }
          
          console.log('🎥 [WebRTC] Setting stream on video element:', {
            socketId,
            videoElementExists: !!videoElement,
            currentSrcObject: videoElement.srcObject?.id || 'none',
            newStreamId: stream.id,
            videoElementReadyState: videoElement.readyState,
            videoElementPaused: videoElement.paused
          });
          
          // Cancel any pending play promise to avoid AbortError
          if (videoElement._playPromise) {
            videoElement._playPromise.catch(() => {}); // Suppress errors from cancelled promise
            videoElement._playPromise = null;
          }
          
          // Set the stream
          videoElement.srcObject = stream;
          console.log('🎥 [WebRTC] Stream set, readyState:', videoElement.readyState);
          
          // Function to safely play the video
          const playVideo = () => {
            // Only play if this is still the current stream
            if (videoElement.srcObject !== stream) {
              console.warn('⚠️ [WebRTC] Stream changed, not playing');
              return;
            }
            
            console.log('🎥 [WebRTC] Attempting to play video:', {
              socketId,
              readyState: videoElement.readyState,
              paused: videoElement.paused,
              hasTracks: stream.getVideoTracks().length > 0
            });
            
            const playPromise = videoElement.play();
            if (playPromise !== undefined) {
              videoElement._playPromise = playPromise;
              playPromise
                .then(() => {
                  if (videoElement._playPromise === playPromise) {
                    videoElement._playPromise = null;
                  }
                  console.log('✅ [WebRTC] Remote video playing successfully for socketId:', socketId);
                })
                .catch((err) => {
                  if (videoElement._playPromise === playPromise) {
                    videoElement._playPromise = null;
                  }
                  
                  // Suppress AbortError - it's expected when stream changes
                  if (err.name === 'AbortError') {
                    console.log('⚠️ [WebRTC] Play aborted (expected when stream changes)');
                    // Try again after a short delay
                    setTimeout(() => {
                      if (videoElement && videoElement.srcObject === stream && videoElement.paused) {
                        console.log('🔄 [WebRTC] Retrying play after AbortError');
                        videoElement.play().catch(() => {});
                      }
                    }, 200);
                    return;
                  }
                  
                  // Log other errors
                  if (err.name !== 'NotAllowedError') {
                    console.warn('❌ [WebRTC] Error playing remote video:', err);
                  }
                  
                  // Retry if video is ready or track is live
                  const currentTrack = stream.getVideoTracks()[0];
                  const trackLive = currentTrack && currentTrack.readyState === 'live';
                  if (videoElement.srcObject === stream && (videoElement.readyState >= 2 || trackLive)) {
                    setTimeout(() => {
                      if (videoElement && videoElement.srcObject === stream && videoElement.paused) {
                        console.log('🔄 [WebRTC] Retrying play, readyState:', videoElement.readyState, 'trackLive:', trackLive);
                        videoElement.play().catch(() => {}); // Ignore errors on retry
                      }
                    }, 500);
                  }
                });
            } else {
              console.warn('⚠️ [WebRTC] play() returned undefined');
            }
          };
          
          // Check if video track is live - for WebRTC, this is more reliable than readyState
          const videoTrack = stream.getVideoTracks()[0];
          const isTrackLive = videoTrack && videoTrack.readyState === 'live';
          
          // Try to play immediately if ready, otherwise wait for canplay event
          if (videoElement.readyState >= 2) {
            console.log('🎥 [WebRTC] Video ready (readyState >= 2), attempting play');
            playVideo();
          } else if (isTrackLive) {
            // Track is live but readyState is 0 - wait a bit for video element to process
            console.log('🎥 [WebRTC] Track is live but readyState is 0, waiting for video element to process');
            // Wait a short time for the video element to start processing the stream
            setTimeout(() => {
              if (videoElement.srcObject === stream) {
                if (videoElement.readyState > 0) {
                  console.log('✅ [WebRTC] Video readyState changed, attempting play');
                  playVideo();
                } else {
                  // Still 0, but track is live - try playing anyway
                  console.log('🔄 [WebRTC] readyState still 0 but track live, attempting forced play');
                  playVideo();
                }
              }
            }, 300);
          } else {
            console.log('⏳ [WebRTC] Waiting for video to be ready, readyState:', videoElement.readyState);
            const handleCanPlay = () => {
              videoElement.removeEventListener('canplay', handleCanPlay);
              if (videoElement.srcObject === stream) {
                console.log('✅ [WebRTC] canplay event fired');
                playVideo();
              }
            };
            videoElement.addEventListener('canplay', handleCanPlay, { once: true });
            
            // Also listen for track becoming live
            if (videoTrack) {
              const handleTrackStarted = () => {
                console.log('✅ [WebRTC] Video track started');
                if (videoElement.srcObject === stream && videoElement.paused) {
                  playVideo();
                }
              };
              if (videoTrack.readyState === 'live') {
                handleTrackStarted();
              } else {
                videoTrack.addEventListener('started', handleTrackStarted, { once: true });
              }
            }
            
            // Fallback: try after delays
            setTimeout(() => {
              if (videoElement.srcObject === stream) {
                const trackNowLive = stream.getVideoTracks()[0]?.readyState === 'live';
                if ((videoElement.readyState >= 2 || trackNowLive) && videoElement.paused) {
                  console.log('🔄 [WebRTC] Fallback play attempt');
                  playVideo();
                }
              }
            }, 500);
            
            // More aggressive fallback - try playing even with readyState 0 if track is live
            setTimeout(() => {
              if (videoElement.srcObject === stream) {
                const trackNowLive = stream.getVideoTracks()[0]?.readyState === 'live';
                if (trackNowLive && videoElement.paused) {
                  console.log('🔄 [WebRTC] Aggressive fallback - track is live, forcing play');
                  playVideo();
                }
              }
            }, 1000);
          }
        };

        let videoElement = remoteVideosRef.current[socketId];
        console.log('🎥 [WebRTC] Looking for video element:', {
          socketId,
          videoElementFound: !!videoElement,
          allRemoteVideos: Object.keys(remoteVideosRef.current)
        });
        
        if (videoElement) {
          console.log('✅ [WebRTC] Video element found immediately');
          setVideoStream(videoElement);
        } else {
          console.log('⏳ [WebRTC] Video element not found, retrying...');
          let retries = 0;
          const retryInterval = setInterval(() => {
            videoElement = remoteVideosRef.current[socketId];
            if (videoElement) {
              console.log('✅ [WebRTC] Video element found after retry, attempt:', retries);
              setVideoStream(videoElement);
              clearInterval(retryInterval);
            } else if (retries >= 20) {
              console.error('❌ [WebRTC] Video element not found after 20 retries for socketId:', socketId);
              console.log('Available video elements:', Object.keys(remoteVideosRef.current));
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
        console.log('🧊 [WebRTC] ICE candidate for socketId:', socketId);
        socketRef.current.emit('ice-candidate', {
          target: socketId,
          candidate: event.candidate
        });
      } else {
        console.log('🧊 [WebRTC] ICE gathering complete for socketId:', socketId);
      }
    };

    return pc;
  };

  const handleUserJoined = async ({ socketId, userName: name }) => {
    console.log('👤 [WebRTC] User joined:', { socketId, userName: name });
    let pc = peerConnectionsRef.current[socketId];
    if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
      console.log('🔌 [WebRTC] Creating new peer connection for:', socketId);
      pc = createPeerConnection(socketId);
      peerConnectionsRef.current[socketId] = pc;
    }
    if (pc.signalingState === 'stable') {
      try {
        console.log('📤 [WebRTC] Creating offer for:', socketId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current.emit('offer', { target: socketId, offer: offer });
        console.log('✅ [WebRTC] Offer sent to:', socketId);
      } catch (error) {
        console.error('❌ [WebRTC] Error creating offer:', error);
      }
    } else {
      console.log('⚠️ [WebRTC] Signaling state not stable:', pc.signalingState);
    }
  };

  const handleExistingUsers = async (users) => {
    console.log('👥 [WebRTC] Existing users:', users.map(u => ({ socketId: u.socketId, userName: u.userName })));
    for (const user of users) {
      let pc = peerConnectionsRef.current[user.socketId];
      if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
        console.log('🔌 [WebRTC] Creating peer connection for existing user:', user.socketId);
        pc = createPeerConnection(user.socketId);
        peerConnectionsRef.current[user.socketId] = pc;
      }
      if (pc.signalingState === 'stable') {
        try {
          console.log('📤 [WebRTC] Creating offer for existing user:', user.socketId);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current.emit('offer', { target: user.socketId, offer: offer });
          console.log('✅ [WebRTC] Offer sent to existing user:', user.socketId);
        } catch (error) {
          console.error('❌ [WebRTC] Error creating offer for existing user:', error);
        }
      } else {
        console.log('⚠️ [WebRTC] Signaling state not stable for:', user.socketId, pc.signalingState);
      }
    }
  };

  const handleOffer = async ({ offer, sender }) => {
    console.log('📥 [WebRTC] Received offer from:', sender);
    let pc = peerConnectionsRef.current[sender];
    if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
      console.log('🔌 [WebRTC] Creating peer connection for offer sender:', sender);
      pc = createPeerConnection(sender);
      peerConnectionsRef.current[sender] = pc;
    }
    if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer') {
      try {
        console.log('📥 [WebRTC] Setting remote description and creating answer');
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current.emit('answer', { target: sender, answer: answer });
        console.log('✅ [WebRTC] Answer sent to:', sender);
      } catch (error) {
        console.error('❌ [WebRTC] Error handling offer:', error);
      }
    } else {
      console.log('⚠️ [WebRTC] Signaling state not ready for offer:', pc.signalingState);
    }
  };

  const handleAnswer = async ({ answer, sender }) => {
    console.log('📥 [WebRTC] Received answer from:', sender);
    const pc = peerConnectionsRef.current[sender];
    if (pc) {
      // Only set answer if we're in the correct state
      if (pc.signalingState === 'have-local-offer') {
        try {
          console.log('📥 [WebRTC] Setting remote answer');
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          console.log('✅ [WebRTC] Remote answer set successfully');
        } catch (error) {
          console.error('❌ [WebRTC] Error setting remote answer:', error);
        }
      } else if (pc.signalingState === 'stable') {
        // Answer already set or connection has progressed - this is okay
        console.log('✅ [WebRTC] Answer already processed or connection established, state:', pc.signalingState);
      } else {
        console.warn('⚠️ [WebRTC] Cannot set answer - wrong signaling state:', pc.signalingState);
      }
    } else {
      console.warn('⚠️ [WebRTC] Cannot set answer - no peer connection found');
    }
  };

  const handleIceCandidate = async ({ candidate, sender }) => {
    const pc = peerConnectionsRef.current[sender];
    if (pc && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('🧊 [WebRTC] ICE candidate added for:', sender);
      } catch (error) {
        if (error.name !== 'OperationError') {
          console.error('❌ [WebRTC] Error adding ICE candidate:', error);
        }
      }
    } else {
      console.warn('⚠️ [WebRTC] Cannot add ICE candidate - no PC or no candidate:', {
        hasPC: !!pc,
        hasCandidate: !!candidate
      });
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
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
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
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
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
                      console.log('🔄 [Render] Reattaching stream to new video element');
                      el.srcObject = oldStream;
                      el.autoplay = true;
                      el.playsInline = true;
                      el.muted = false;
                      
                      // Try to play if track is live
                      const videoTrack = oldStream.getVideoTracks()[0];
                      if (videoTrack && videoTrack.readyState === 'live') {
                        setTimeout(() => {
                          if (el && el.srcObject === oldStream && el.paused) {
                            el.play().then(() => {
                              console.log('✅ [Render] Reattached video playing');
                            }).catch(err => {
                              console.warn('⚠️ [Render] Reattached video play failed:', err);
                            });
                          }
                        }, 100);
                      }
                    }
                    
                    // Check if there's a stream waiting for this element
                    const pc = peerConnectionsRef.current[user.socketId];
                    if (pc) {
                      console.log('📹 [Render] Peer connection exists for this user:', {
                        socketId: user.socketId,
                        connectionState: pc.connectionState,
                        iceConnectionState: pc.iceConnectionState
                      });
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
