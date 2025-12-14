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
  Record: () => (
    <svg viewBox="0 0 24 24" width="24" height="24" className="control-icon">
      <circle cx="12" cy="12" r="8" fill="currentColor" />
    </svg>
  ),
  RecordActive: () => (
    <svg viewBox="0 0 24 24" width="24" height="24" className="control-icon">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  ),
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
  const mediaRecorderRef = useRef(null);

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
      // Stop recording if active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
      
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
      const videoTrack = tracks.find(t => t.kind === 'video');
      console.log('📤 [WebRTC] Adding local tracks:', {
        socketId,
        videoTracks: tracks.filter(t => t.kind === 'video').length,
        audioTracks: tracks.filter(t => t.kind === 'audio').length,
        isScreenSharing: isScreenSharing,
        videoTrackLabel: videoTrack?.label || 'none'
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
      
      // If connection fails or disconnects but ICE is still connected, try to recover
      if ((pc.connectionState === 'failed' || pc.connectionState === 'disconnected') && 
          (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed')) {
        console.log('🔄 [WebRTC] Connection', pc.connectionState, 'but ICE connected - attempting recovery');
        const videoElement = remoteVideosRef.current[socketId];
        if (videoElement && videoElement.srcObject) {
          const stream = videoElement.srcObject;
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack && videoTrack.readyState === 'live') {
            console.log('🔄 [WebRTC] Video track is live, forcing play');
            // Try multiple recovery attempts
            [500, 1000, 2000].forEach((delay, index) => {
              setTimeout(() => {
                if (videoElement && videoElement.srcObject === stream) {
                  if (videoElement.paused) {
                    console.log(`🔄 [WebRTC] Recovery play attempt ${index + 1}`);
                    videoElement.play().then(() => {
                      console.log('✅ [WebRTC] Recovery play succeeded');
                    }).catch(err => {
                      if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
                        console.warn('⚠️ [WebRTC] Recovery play failed:', err.name);
                      }
                    });
                  } else if (videoElement.readyState === 0) {
                    // Video playing but no frames - try reload
                    console.log('🔄 [WebRTC] Video playing but readyState 0, attempting reload');
                    if (!videoElement._reloading) {
                      const currentSrcObject = videoElement.srcObject;
                      videoElement.srcObject = null;
                      setTimeout(() => {
                        if (videoElement && currentSrcObject) {
                          videoElement.srcObject = currentSrcObject;
                          videoElement.play().catch(() => {});
                        }
                      }, 200);
                    }
                  }
                }
              }, delay);
            });
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
          
          // Ensure video element is properly configured before setting stream
          videoElement.setAttribute('autoplay', 'true');
          videoElement.setAttribute('playsinline', 'true');
          videoElement.playsInline = true;
          videoElement.autoplay = true;
          
          // Set the stream
          videoElement.srcObject = stream;
          
          // Force the video element to process the stream
          // For WebRTC streams, we need to ensure the element is ready
          const streamVideoTrack = stream.getVideoTracks()[0];
          if (streamVideoTrack) {
            console.log('🎥 [WebRTC] Video track details:', {
              id: streamVideoTrack.id,
              enabled: streamVideoTrack.enabled,
              readyState: streamVideoTrack.readyState,
              muted: streamVideoTrack.muted,
              label: streamVideoTrack.label,
              kind: streamVideoTrack.kind
            });
            
            // Ensure track is enabled
            if (!streamVideoTrack.enabled) {
              console.warn('⚠️ [WebRTC] Video track is disabled, enabling it');
              streamVideoTrack.enabled = true;
            }
          }
          
          console.log('🎥 [WebRTC] Stream set, readyState:', videoElement.readyState, {
            autoplay: videoElement.autoplay,
            playsInline: videoElement.playsInline,
            muted: videoElement.muted,
            streamId: stream.id,
            hasVideoTracks: stream.getVideoTracks().length,
            hasAudioTracks: stream.getAudioTracks().length,
            videoTrackEnabled: streamVideoTrack?.enabled,
            videoTrackReadyState: streamVideoTrack?.readyState
          });
          
          // Try to force processing by checking stream active state
          setTimeout(() => {
            if (videoElement.srcObject === stream && videoElement.readyState === 0) {
              const activeTrack = stream.getVideoTracks()[0];
              if (activeTrack && activeTrack.readyState === 'live') {
                console.log('🔄 [WebRTC] Stream active but readyState still 0, attempting direct play');
                // Try playing directly without waiting
                videoElement.play().catch(err => {
                  if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
                    console.warn('⚠️ [WebRTC] Direct play failed:', err.name);
                  }
                });
              }
            }
          }, 100);
          
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
            
            // Add playing event listener to confirm video actually starts
            const handlePlaying = () => {
              console.log('✅ [WebRTC] Video is actually playing now for socketId:', socketId, {
                readyState: videoElement.readyState,
                paused: videoElement.paused,
                currentTime: videoElement.currentTime
              });
              videoElement.removeEventListener('playing', handlePlaying);
            };
            videoElement.addEventListener('playing', handlePlaying, { once: true });
            
            // Also listen for loadedmetadata which indicates the video element has processed the stream
            const handleLoadedMetadata = () => {
              console.log('✅ [WebRTC] Video metadata loaded, readyState:', videoElement.readyState);
              videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
            };
            videoElement.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
            
            // Force autoplay and playsInline attributes
            videoElement.setAttribute('autoplay', 'true');
            videoElement.setAttribute('playsinline', 'true');
            videoElement.muted = false; // Try unmuted first
            
            console.log('🎥 [WebRTC] Video element attributes:', {
              autoplay: videoElement.autoplay,
              playsInline: videoElement.playsInline,
              muted: videoElement.muted,
              srcObject: !!videoElement.srcObject
            });
            
            const playPromise = videoElement.play();
            if (playPromise !== undefined) {
              videoElement._playPromise = playPromise;
              
              // Add timeout to detect if promise hangs
              const playTimeout = setTimeout(() => {
                if (videoElement._playPromise === playPromise) {
                  console.warn('⏱️ [WebRTC] play() promise timeout - checking video state');
                  console.log('⏱️ [WebRTC] Video state:', {
                    paused: videoElement.paused,
                    readyState: videoElement.readyState,
                    currentTime: videoElement.currentTime,
                    ended: videoElement.ended,
                    videoWidth: videoElement.videoWidth,
                    videoHeight: videoElement.videoHeight
                  });
                  
                  // Check if video is actually showing frames
                  const isActuallyPlaying = !videoElement.paused && 
                                          videoElement.readyState >= 2 && 
                                          videoElement.currentTime > 0;
                  
                  if (!isActuallyPlaying && videoElement.srcObject === stream) {
                    // Video says it's playing but not actually showing frames
                    if (!videoElement.paused && videoElement.readyState === 0) {
                      console.warn('⚠️ [WebRTC] Video marked as playing but readyState is 0 - forcing reload');
                      // Try to force the video element to process the stream
                      const currentSrcObject = videoElement.srcObject;
                      videoElement.srcObject = null;
                      setTimeout(() => {
                        if (videoElement && currentSrcObject) {
                          videoElement.srcObject = currentSrcObject;
                          videoElement.play().catch(() => {});
                        }
                      }, 100);
                    } else if (videoElement.paused) {
                      console.log('🔄 [WebRTC] Retrying play after timeout');
                      videoElement.play().catch(err => {
                        console.warn('❌ [WebRTC] Retry play error:', err);
                      });
                    }
                  }
                }
              }, 2000);
              
              playPromise
                .then(() => {
                  clearTimeout(playTimeout);
                  if (videoElement._playPromise === playPromise) {
                    videoElement._playPromise = null;
                  }
                  console.log('✅ [WebRTC] play() promise resolved for socketId:', socketId, {
                    paused: videoElement.paused,
                    readyState: videoElement.readyState,
                    currentTime: videoElement.currentTime
                  });
                  
                  // Check if actually playing after a short delay
                  setTimeout(() => {
                    if (videoElement && videoElement.srcObject === stream) {
                      const isActuallyPlaying = !videoElement.paused && 
                                              videoElement.readyState >= 2 && 
                                              videoElement.currentTime > 0;
                      
                      if (videoElement.paused) {
                        console.warn('⚠️ [WebRTC] Video paused after play() resolved, retrying');
                        videoElement.play().catch(() => {});
                      } else if (!isActuallyPlaying && !videoElement._reloading) {
                        // Video says playing but no frames - force reload
                        console.warn('⚠️ [WebRTC] Video playing but no frames (readyState:', videoElement.readyState, 'currentTime:', videoElement.currentTime, '), forcing reload');
                        videoElement._reloading = true;
                        const currentSrcObject = videoElement.srcObject;
                        
                        // Cancel any pending play promises
                        if (videoElement._playPromise) {
                          videoElement._playPromise.catch(() => {});
                          videoElement._playPromise = null;
                        }
                        
                        videoElement.srcObject = null;
                        
                        setTimeout(() => {
                          if (videoElement && currentSrcObject) {
                            videoElement.setAttribute('autoplay', 'true');
                            videoElement.setAttribute('playsinline', 'true');
                            videoElement.srcObject = currentSrcObject;
                            
                            // Wait for metadata before playing
                            const handleReloadMetadata = () => {
                              videoElement.removeEventListener('loadedmetadata', handleReloadMetadata);
                              if (videoElement.srcObject === currentSrcObject) {
                                videoElement.play()
                                  .then(() => {
                                    console.log('✅ [WebRTC] Video playing after reload');
                                    videoElement._reloading = false;
                                  })
                                  .catch(() => {
                                    videoElement._reloading = false;
                                  });
                              }
                            };
                            videoElement.addEventListener('loadedmetadata', handleReloadMetadata, { once: true });
                            
                            // Fallback
                            setTimeout(() => {
                              if (videoElement._reloading && videoElement.srcObject === currentSrcObject) {
                                videoElement.play().catch(() => {});
                                videoElement._reloading = false;
                              }
                            }, 1000);
                          }
                        }, 300);
                      } else {
                        console.log('✅ [WebRTC] Video confirmed playing with frames');
                      }
                    }
                  }, 500);
                })
                .catch((err) => {
                  clearTimeout(playTimeout);
                  if (videoElement._playPromise === playPromise) {
                    videoElement._playPromise = null;
                  }
                  
                  console.log('❌ [WebRTC] play() promise rejected:', {
                    name: err.name,
                    message: err.message,
                    paused: videoElement.paused,
                    readyState: videoElement.readyState
                  });
                  
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
                  
                  // For NotAllowedError, try with muted
                  if (err.name === 'NotAllowedError') {
                    console.log('🔇 [WebRTC] Play not allowed, trying muted');
                    videoElement.muted = true;
                    setTimeout(() => {
                      if (videoElement && videoElement.srcObject === stream && videoElement.paused) {
                        videoElement.play()
                          .then(() => {
                            console.log('✅ [WebRTC] Video playing muted');
                            // Try to unmute after a moment
                            setTimeout(() => {
                              if (videoElement && videoElement.srcObject === stream) {
                                videoElement.muted = false;
                              }
                            }, 1000);
                          })
                          .catch(() => {});
                      }
                    }, 100);
                    return;
                  }
                  
                  // Log other errors
                  console.warn('❌ [WebRTC] Error playing remote video:', err);
                  
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
              // If play() returns undefined, try direct play
              setTimeout(() => {
                if (videoElement && videoElement.srcObject === stream && videoElement.paused) {
                  console.log('🔄 [WebRTC] Direct play attempt');
                  videoElement.play().catch(() => {});
                }
              }, 100);
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
            
            // Listen for loadedmetadata event which indicates stream processing started
            const handleLoadedMetadata = () => {
              console.log('✅ [WebRTC] Metadata loaded, readyState:', videoElement.readyState);
              if (videoElement.srcObject === stream) {
                playVideo();
              }
            };
            videoElement.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
            
            // Also listen for loadeddata
            const handleLoadedData = () => {
              console.log('✅ [WebRTC] Data loaded, readyState:', videoElement.readyState);
              if (videoElement.srcObject === stream && videoElement.paused) {
                playVideo();
              }
            };
            videoElement.addEventListener('loadeddata', handleLoadedData, { once: true });
            
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
            
            // Additional fallback - try again after longer delay
            setTimeout(() => {
              if (videoElement && videoElement.srcObject === stream && videoElement.paused) {
                const trackStillLive = stream.getVideoTracks()[0]?.readyState === 'live';
                if (trackStillLive) {
                  console.log('🔄 [WebRTC] Delayed fallback play attempt, readyState:', videoElement.readyState);
                  playVideo();
                }
              }
            }, 1000);
            
            // Aggressive polling fallback - check every 500ms and try to play
            let pollCount = 0;
            const maxPolls = 10; // Try for 5 seconds
            const pollInterval = setInterval(() => {
              pollCount++;
              if (pollCount > maxPolls) {
                clearInterval(pollInterval);
                console.log('⏱️ [WebRTC] Stopped polling for playback');
                return;
              }
              
              if (videoElement && videoElement.srcObject === stream) {
                const track = stream.getVideoTracks()[0];
                const trackLive = track && track.readyState === 'live';
                
                if (trackLive && videoElement.paused) {
                  console.log(`🔄 [WebRTC] Polling attempt ${pollCount}/${maxPolls}, readyState:`, videoElement.readyState);
                  videoElement.play()
                    .then(() => {
                      console.log('✅ [WebRTC] Video started via polling');
                      clearInterval(pollInterval);
                    })
                    .catch(err => {
                      if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
                        console.warn(`⚠️ [WebRTC] Polling play error (attempt ${pollCount}):`, err.name);
                      }
                    });
                } else if (!videoElement.paused) {
                  // Check if actually playing (has frames)
                  const isActuallyPlaying = videoElement.readyState >= 2 && videoElement.currentTime > 0;
                  if (isActuallyPlaying) {
                    console.log('✅ [WebRTC] Video is playing with frames, stopping poll');
                    clearInterval(pollInterval);
                  } else {
                    // Video says playing but no frames - might need to force reload
                    if (videoElement.readyState === 0 && pollCount > 3 && !videoElement._reloading) {
                      console.warn('⚠️ [WebRTC] Video playing but readyState 0, forcing stream reload');
                      videoElement._reloading = true;
                      const currentSrcObject = videoElement.srcObject;
                      
                      // Cancel any pending play promises
                      if (videoElement._playPromise) {
                        videoElement._playPromise.catch(() => {});
                        videoElement._playPromise = null;
                      }
                      
                      videoElement.srcObject = null;
                      
                      // Wait longer for the element to reset
                      setTimeout(() => {
                        if (videoElement && currentSrcObject) {
                          videoElement.setAttribute('autoplay', 'true');
                          videoElement.setAttribute('playsinline', 'true');
                          videoElement.srcObject = currentSrcObject;
                          
                          // Wait for loadedmetadata before playing
                          const handleReloadMetadata = () => {
                            videoElement.removeEventListener('loadedmetadata', handleReloadMetadata);
                            if (videoElement.srcObject === currentSrcObject) {
                              console.log('🔄 [WebRTC] Reloaded stream metadata, attempting play');
                              videoElement.play()
                                .then(() => {
                                  console.log('✅ [WebRTC] Video playing after reload');
                                  videoElement._reloading = false;
                                })
                                .catch(err => {
                                  console.warn('⚠️ [WebRTC] Play failed after reload:', err.name);
                                  videoElement._reloading = false;
                                });
                            }
                          };
                          videoElement.addEventListener('loadedmetadata', handleReloadMetadata, { once: true });
                          
                          // Fallback if metadata doesn't load
                          setTimeout(() => {
                            if (videoElement._reloading && videoElement.srcObject === currentSrcObject) {
                              console.log('🔄 [WebRTC] Fallback play after reload timeout');
                              videoElement.play().catch(() => {});
                              videoElement._reloading = false;
                            }
                          }, 1000);
                        }
                      }, 300);
                    }
                  }
                }
              } else {
                clearInterval(pollInterval);
              }
            }, 500);
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
        console.log('🛑 [ScreenShare] Stopping screen share');
        
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

        // Get current audio track to preserve it
        const currentAudioTrack = localStreamRef.current.getAudioTracks()[0];
        const wasAudioEnabled = currentAudioTrack && currentAudioTrack.enabled;

        // Get new camera video track
        const cameraStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: !isMuted && wasAudioEnabled
        });
        
        const videoTrack = cameraStream.getVideoTracks()[0];
        const audioTrack = cameraStream.getAudioTracks()[0];
        
        console.log('📹 [ScreenShare] Switching back to camera:', {
          hasVideo: !!videoTrack,
          hasAudio: !!audioTrack
        });
        
        // Replace video track in all peer connections
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const videoSender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(videoTrack);
            console.log('🔄 [ScreenShare] Replaced video track in peer connection');
          }
        });

        // Update local stream
        if (localStreamRef.current) {
          const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldVideoTrack) {
            localStreamRef.current.removeTrack(oldVideoTrack);
            oldVideoTrack.stop();
          }
          localStreamRef.current.addTrack(videoTrack);
          
          // Handle audio: use new audio track if available, otherwise keep existing
          if (audioTrack) {
            const oldAudioTrack = localStreamRef.current.getAudioTracks()[0];
            if (oldAudioTrack) {
              localStreamRef.current.removeTrack(oldAudioTrack);
              oldAudioTrack.stop();
            }
            localStreamRef.current.addTrack(audioTrack);
          }
        } else {
          localStreamRef.current = cameraStream;
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        setIsScreenSharing(false);
        console.log('✅ [ScreenShare] Screen share stopped, camera restored');
      } else {
        // Start screen sharing
        console.log('📺 [ScreenShare] Starting screen share');
        
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: {
            cursor: 'always',
            displaySurface: 'monitor'
          }, 
          audio: true 
        });
        
        // Handle user stopping screen share from browser UI
        screenStream.getVideoTracks()[0].addEventListener('ended', () => {
          console.log('🛑 [ScreenShare] Screen share ended by user');
          if (isScreenSharing) {
            setIsScreenSharing(false);
            toggleScreenShare();
          }
        });

        screenShareStreamRef.current = screenStream;
        const videoTrack = screenStream.getVideoTracks()[0];
        const audioTrack = screenStream.getAudioTracks()[0];
        
        console.log('📺 [ScreenShare] Screen stream obtained:', {
          hasVideo: !!videoTrack,
          hasAudio: !!audioTrack,
          videoLabel: videoTrack.label
        });
        
        // Replace video track in all existing peer connections
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
            console.log('🔄 [ScreenShare] Replaced video track in peer connection');
          }
        });

        // Update local stream - preserve existing audio track
        if (localStreamRef.current) {
          const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldVideoTrack) {
            localStreamRef.current.removeTrack(oldVideoTrack);
            oldVideoTrack.stop();
          }
          localStreamRef.current.addTrack(videoTrack);
          
          // Optionally add screen share audio if available, otherwise keep existing audio
          if (audioTrack) {
            const existingAudioTrack = localStreamRef.current.getAudioTracks()[0];
            if (existingAudioTrack) {
              // Keep existing audio track (microphone), don't replace with screen audio
              console.log('🎤 [ScreenShare] Keeping existing microphone audio');
            } else {
              localStreamRef.current.addTrack(audioTrack);
              console.log('🔊 [ScreenShare] Added screen share audio');
            }
          }
          
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
        } else {
          // No local stream yet - create one with screen share
          localStreamRef.current = new MediaStream();
          localStreamRef.current.addTrack(videoTrack);
          if (audioTrack) {
            localStreamRef.current.addTrack(audioTrack);
          }
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
        }

        setIsScreenSharing(true);
        console.log('✅ [ScreenShare] Screen share started successfully');
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
          setRecordedChunks([]);
          
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
        setMediaRecorder(recorder);
        mediaRecorderRef.current = recorder;
        setRecordedChunks(chunks);
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

          {(!isMobile || mobileMenuExpanded) && (
            <button 
              className={`meet-control-btn image-btn ${isRecording ? 'recording' : ''}`}
              onClick={toggleScreenRecord}
              title={isRecording ? "Stop recording" : "Start recording"}
              style={isRecording ? { 
                backgroundColor: '#d32f2f',
                animation: 'pulse 2s infinite'
              } : {}}
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
