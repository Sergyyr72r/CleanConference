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
  Fullscreen: () => <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>,
  FullscreenExit: () => <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>,
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
  const [isCreator, setIsCreator] = useState(false); // Track if current user is conference creator
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // UI States
  const [currentTime, setCurrentTime] = useState('');
  const [activeSidebar, setActiveSidebar] = useState(null); // 'people', 'chat', 'info'
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuExpanded, setMobileMenuExpanded] = useState(false);

  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localVideoContainerRef = useRef(null);
  const remoteVideosRef = useRef({});
  const localStreamRef = useRef(null);
  const screenShareStreamRef = useRef(null);
  const currentSocketIdRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const agoraClientRef = useRef(null); // Agora RTC client
  const localAudioTrackRef = useRef(null);
  const localVideoTrackRef = useRef(null);
  const localScreenTrackRef = useRef(null);
  const agoraUidToSocketIdRef = useRef({}); // Map Agora UID -> Socket.IO socketId
  const pendingAgoraTracksRef = useRef({}); // Map socketId -> { videoTrack, audioTrack } for tracks waiting for video element
  const pendingAgoraTracksByUidRef = useRef({}); // Map Agora UID -> { videoTrack } for tracks waiting for socketId mapping
  const activeRemoteVideoTracksRef = useRef({}); // Map Agora UID -> videoTrack for all active remote video tracks
  const recentSocketJoinsRef = useRef([]); // Array of { socketId, userName, timestamp } for recent Socket.IO joins

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
        // Find socketId for this Agora UID
        // First try direct mapping
        let socketId = agoraUidToSocketIdRef.current[user.uid];
        
        if (!socketId) {
          // Try to find socketId by matching with users from Socket.IO
          const usersList = users; // Get from state via closure
          const uidStr = user.uid.toString();
          
          // Strategy 1: Check if UID matches a socketId directly (string match)
          const directMatch = usersList.find(u => u.socketId === uidStr);
          if (directMatch) {
            socketId = directMatch.socketId;
            agoraUidToSocketIdRef.current[user.uid] = socketId;
            console.log('✅ [Agora] Matched UID to socketId by direct string match:', user.uid, '->', socketId);
          } else {
            // Strategy 2: Find a user that doesn't have an Agora UID mapping yet
            // This is the most reliable - find any user in the list without a mapping
            const unmappedUser = usersList.find(u => {
              const hasMapping = Object.values(agoraUidToSocketIdRef.current).includes(u.socketId);
              return !hasMapping;
            });
            
            if (unmappedUser) {
              socketId = unmappedUser.socketId;
              agoraUidToSocketIdRef.current[user.uid] = socketId;
              console.log('✅ [Agora] Matched UID to socketId by finding unmapped user:', user.uid, '->', socketId);
              // Remove from recent joins since it's now mapped
              recentSocketJoinsRef.current = recentSocketJoinsRef.current.filter(j => j.socketId !== socketId);
            } else {
              // Strategy 3: Find the most recently joined Socket.IO user that doesn't have an Agora UID mapping yet
              const recentJoins = recentSocketJoinsRef.current
                .filter(join => {
                  // Check if this socketId doesn't have a mapping yet
                  const hasMapping = Object.values(agoraUidToSocketIdRef.current).includes(join.socketId);
                  return !hasMapping;
                })
                .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
              
              if (recentJoins.length > 0) {
                socketId = recentJoins[0].socketId;
                agoraUidToSocketIdRef.current[user.uid] = socketId;
                console.log('✅ [Agora] Matched UID to socketId by most recent Socket.IO join:', user.uid, '->', socketId);
                // Remove from recent joins since it's now mapped
                recentSocketJoinsRef.current = recentSocketJoinsRef.current.filter(j => j.socketId !== socketId);
              } else if (usersList.length > 0) {
                // Last resort: use the first user in the list
                socketId = usersList[0].socketId;
                agoraUidToSocketIdRef.current[user.uid] = socketId;
                console.log('⚠️ [Agora] Matched UID to socketId using first user (fallback):', user.uid, '->', socketId);
              }
            }
          }
        }
        
        // If still no socketId, try using UID as socketId (final fallback)
        if (!socketId) {
          socketId = user.uid.toString();
          console.warn('⚠️ [Agora] No socketId mapping found for UID:', user.uid, 'using UID as socketId');
        }
        
        // Store the track in activeRemoteVideoTracksRef for later retrieval
        activeRemoteVideoTracksRef.current[user.uid] = user.videoTrack;
        
        const videoElement = remoteVideosRef.current[socketId];
        if (videoElement) {
          user.videoTrack.play(videoElement);
          console.log('✅ [Agora] Playing remote video for:', socketId, '(Agora UID:', user.uid + ')');
          // Clean up pending track if it exists
          if (pendingAgoraTracksRef.current[socketId]) {
            delete pendingAgoraTracksRef.current[socketId];
          }
        } else {
          console.warn('⚠️ [Agora] Video element not found for socketId:', socketId, '(Agora UID:', user.uid + ')');
          // Store the track by UID so we can match it later when we get the correct socketId
          pendingAgoraTracksByUidRef.current[user.uid] = { videoTrack: user.videoTrack };
          
          // If we have a socketId (even if it's the UID as fallback), store the mapping
          if (socketId) {
            agoraUidToSocketIdRef.current[user.uid] = socketId;
            // Also store in pendingAgoraTracksRef in case the socketId is correct
            if (!pendingAgoraTracksRef.current[socketId]) {
              pendingAgoraTracksRef.current[socketId] = {};
            }
            pendingAgoraTracksRef.current[socketId].videoTrack = user.videoTrack;
          }
          
          console.log('💾 [Agora] Stored track by UID for later matching. UID:', user.uid, 'socketId:', socketId);
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
        const socketId = agoraUidToSocketIdRef.current[user.uid] || user.uid.toString();
        const videoElement = remoteVideosRef.current[socketId];
        if (videoElement) {
          // Let Agora manage the remote track lifecycle; just clear our element
          videoElement.srcObject = null;
        }
        // Clean up active track (but keep mapping in case they republish)
        delete activeRemoteVideoTracksRef.current[user.uid];
        delete pendingAgoraTracksByUidRef.current[user.uid];
      }
    });

    agoraClientRef.current.on('user-left', (user) => {
      console.log('👋 [Agora] User left:', user.uid);
      const socketId = agoraUidToSocketIdRef.current[user.uid] || user.uid.toString();
      const videoElement = remoteVideosRef.current[socketId];
      if (videoElement) {
        videoElement.srcObject = null;
        delete remoteVideosRef.current[socketId];
      }
      // Clean up all mappings and stored tracks
      delete agoraUidToSocketIdRef.current[user.uid];
      delete activeRemoteVideoTracksRef.current[user.uid];
      delete pendingAgoraTracksRef.current[socketId];
      delete pendingAgoraTracksByUidRef.current[user.uid];
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

        // Initialize mute state (audio starts unmuted)
        setIsMuted(false);
        
        // Initialize video state (camera starts on)
        setIsVideoOff(false);

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
      // Store this socketId so we can match it with the next Agora publish
      // We'll match the first Agora publish after this user-joined to this socketId
      const joinInfo = { socketId, userName, timestamp: Date.now() };
      recentSocketJoinsRef.current.push(joinInfo);
      // Keep only last 10 joins
      if (recentSocketJoinsRef.current.length > 10) {
        recentSocketJoinsRef.current.shift();
      }
      if (!pendingAgoraTracksRef.current[socketId]) {
        pendingAgoraTracksRef.current[socketId] = { socketId, joinedAt: Date.now() };
      }
    });
    socketRef.current.on('existing-users', (users) => {
      console.log('👥 [Socket] Existing users:', users);
      // Track existing users so we can match them with Agora UIDs
      if (Array.isArray(users)) {
        users.forEach(({ socketId, userName }) => {
          const joinInfo = { socketId, userName, timestamp: Date.now() };
          recentSocketJoinsRef.current.push(joinInfo);
          // Keep only last 10 joins
          if (recentSocketJoinsRef.current.length > 10) {
            recentSocketJoinsRef.current.shift();
          }
        });
      }
    });
    socketRef.current.on('is-creator', (isCreatorFlag) => {
      console.log('👑 [Socket] Is creator:', isCreatorFlag);
      setIsCreator(isCreatorFlag);
    });
    socketRef.current.on('user-left', handleUserLeft);
    socketRef.current.on('user-list', handleUserList);
    socketRef.current.on('chat-message', handleChatMessage);

    // Fullscreen change event listener
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Periodic retry mechanism: check for video elements without tracks and try to match them
    const retryInterval = setInterval(() => {
      // Check all video elements in remoteVideosRef
      Object.keys(remoteVideosRef.current).forEach(socketId => {
        const videoElement = remoteVideosRef.current[socketId];
        if (!videoElement) {
          return; // Element doesn't exist
        }
        
        // Check if element already has a video track playing
        // Agora tracks use play() directly, so we check if video is actually playing
        const hasVideoTracks = videoElement.srcObject && videoElement.srcObject.getVideoTracks().length > 0;
        const isPlaying = !videoElement.paused && videoElement.readyState >= 2; // HAVE_CURRENT_DATA or higher
        const hasVideo = videoElement.videoWidth > 0 && videoElement.videoHeight > 0; // Video has dimensions
        
        // Skip if element already has video playing
        if (hasVideoTracks || (isPlaying && hasVideo)) {
          return; // Element already has a stream or is playing
        }
        
        // Log that we're checking this element
        const availableTracks = {
          pendingBySocketId: Object.keys(pendingAgoraTracksRef.current).length,
          pendingByUid: Object.keys(pendingAgoraTracksByUidRef.current).length,
          activeByUid: Object.keys(activeRemoteVideoTracksRef.current).length,
          uidMappings: Object.keys(agoraUidToSocketIdRef.current).length,
          pendingSocketIds: Object.keys(pendingAgoraTracksRef.current),
          pendingUids: Object.keys(pendingAgoraTracksByUidRef.current),
          activeUids: Object.keys(activeRemoteVideoTracksRef.current),
          mappings: Object.entries(agoraUidToSocketIdRef.current).map(([uid, sid]) => `${uid}->${sid}`)
        };
        console.log('🔄 [Retry] Checking video element for socketId:', socketId, {
          hasVideoTracks,
          isPlaying,
          hasVideo,
          readyState: videoElement.readyState,
          availableTracks
        });
        
        // Check if there's a pending track for this socketId
        const pendingTrack = pendingAgoraTracksRef.current[socketId];
        if (pendingTrack && pendingTrack.videoTrack) {
          console.log('🔄 [Retry] Found pending track for socketId:', socketId, '- attempting to play');
          try {
            pendingTrack.videoTrack.play(videoElement);
            console.log('✅ [Retry] Successfully played pending track');
            delete pendingAgoraTracksRef.current[socketId];
            return;
          } catch (err) {
            console.error('❌ [Retry] Error playing pending track:', err);
          }
        }
        
        // Check if there's a mapped UID for this socketId with an active track
        const mappedUid = Object.keys(agoraUidToSocketIdRef.current).find(
          uid => agoraUidToSocketIdRef.current[uid] === socketId
        );
        if (mappedUid) {
          const activeTrack = activeRemoteVideoTracksRef.current[mappedUid];
          if (activeTrack) {
            console.log('🔄 [Retry] Found active track by mapped UID. UID:', mappedUid, 'socketId:', socketId, '- attempting to play');
            try {
              activeTrack.play(videoElement);
              console.log('✅ [Retry] Successfully played active track');
              return;
            } catch (err) {
              console.error('❌ [Retry] Error playing active track:', err);
            }
          }
          
          // Also check pendingAgoraTracksByUidRef
          const trackByUid = pendingAgoraTracksByUidRef.current[mappedUid];
          if (trackByUid && trackByUid.videoTrack) {
            console.log('🔄 [Retry] Found track in pendingAgoraTracksByUidRef. UID:', mappedUid, 'socketId:', socketId, '- attempting to play');
            try {
              trackByUid.videoTrack.play(videoElement);
              console.log('✅ [Retry] Successfully played track from pendingAgoraTracksByUidRef');
              delete pendingAgoraTracksByUidRef.current[mappedUid];
              return;
            } catch (err) {
              console.error('❌ [Retry] Error playing track from pendingAgoraTracksByUidRef:', err);
            }
          }
        }
        
        // Check for unmapped tracks that should be matched to this socketId
        const unmappedUids = Object.keys(pendingAgoraTracksByUidRef.current).filter(
          uid => !agoraUidToSocketIdRef.current[uid] || 
                 agoraUidToSocketIdRef.current[uid] === uid.toString()
        );
        
        if (unmappedUids.length > 0) {
          const uidToMatch = unmappedUids[0];
          const unmappedTrack = pendingAgoraTracksByUidRef.current[uidToMatch];
          if (unmappedTrack && unmappedTrack.videoTrack) {
            console.log('🔄 [Retry] Matching unmapped track. UID:', uidToMatch, '-> socketId:', socketId, '- attempting to play');
            agoraUidToSocketIdRef.current[uidToMatch] = socketId;
            try {
              unmappedTrack.videoTrack.play(videoElement);
              console.log('✅ [Retry] Successfully played unmapped track');
              delete pendingAgoraTracksByUidRef.current[uidToMatch];
              return;
            } catch (err) {
              console.error('❌ [Retry] Error playing unmapped track:', err);
            }
          }
        }
        
        // Check for unmapped active tracks
        const unmappedActiveUids = Object.keys(activeRemoteVideoTracksRef.current).filter(
          uid => !agoraUidToSocketIdRef.current[uid] || 
                 agoraUidToSocketIdRef.current[uid] === uid.toString()
        );
        
        if (unmappedActiveUids.length > 0) {
          const uidToMatch = unmappedActiveUids[0];
          const activeTrack = activeRemoteVideoTracksRef.current[uidToMatch];
          if (activeTrack) {
            console.log('🔄 [Retry] Matching unmapped active track. UID:', uidToMatch, '-> socketId:', socketId, '- attempting to play');
            agoraUidToSocketIdRef.current[uidToMatch] = socketId;
            try {
              activeTrack.play(videoElement);
              console.log('✅ [Retry] Successfully played unmapped active track');
              return;
            } catch (err) {
              console.error('❌ [Retry] Error playing unmapped active track:', err);
            }
          }
        }
        
        // If we get here, no track was found - log summary (but only occasionally to avoid spam)
        const retryCount = (videoElement.dataset.retryCount || 0) + 1;
        videoElement.dataset.retryCount = retryCount;
        if (retryCount % 5 === 0) { // Log every 5th retry (every 10 seconds)
          console.warn('⚠️ [Retry] No track found after', retryCount, 'attempts for socketId:', socketId, {
            hasPendingBySocketId: !!pendingTrack,
            hasMappedUid: !!mappedUid,
            unmappedPendingCount: unmappedUids.length,
            unmappedActiveCount: unmappedActiveUids.length,
            availableTracks
          });
        }
      });
    }, 2000); // Check every 2 seconds

    return () => {
      // Cleanup
      clearInterval(retryInterval);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      
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
    if (remoteVideosRef.current[socketId]) {
      remoteVideosRef.current[socketId].srcObject = null;
      delete remoteVideosRef.current[socketId];
    }
  };

  const handleUserList = (userList) => {
    const currentSocketId = currentSocketIdRef.current || socketRef.current?.id;
    const otherUsers = userList.filter(user => user.socketId !== currentSocketId);
    setUsers(otherUsers);
    
    // Track users from user-list for Agora UID matching
    otherUsers.forEach(({ socketId, userName }) => {
      // Only add if not already in recent joins
      const alreadyTracked = recentSocketJoinsRef.current.some(j => j.socketId === socketId);
      if (!alreadyTracked) {
        const joinInfo = { socketId, userName, timestamp: Date.now() };
        recentSocketJoinsRef.current.push(joinInfo);
        // Keep only last 10 joins
        if (recentSocketJoinsRef.current.length > 10) {
          recentSocketJoinsRef.current.shift();
        }
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

  const toggleVideo = async () => {
    if (localVideoTrackRef.current) {
      const newVideoState = !isVideoOff;
      if (newVideoState) {
        localVideoTrackRef.current.setEnabled(false);
        setIsVideoOff(true);
      } else {
        // Re-enable the camera track
        localVideoTrackRef.current.setEnabled(true);
        
        // Wait a moment for the track to be ready, then update local video element
        setTimeout(() => {
          if (localVideoTrackRef.current && localVideoRef.current) {
            // Create a new MediaStream from the re-enabled track
            const stream = new MediaStream([localVideoTrackRef.current.getMediaStreamTrack()]);
            if (localAudioTrackRef.current) {
              stream.addTrack(localAudioTrackRef.current.getMediaStreamTrack());
            }
            localStreamRef.current = stream;
            localVideoRef.current.srcObject = stream;
            
            // Try to play the video
            localVideoRef.current.play().catch(err => {
              console.warn('⚠️ [Agora] Local video play failed after re-enable:', err);
            });
          }
        }, 200);
        
        setIsVideoOff(false);
      }
      console.log('📹 [Agora] Video toggled:', !newVideoState);
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        // Stop screen sharing and switch back to camera
        console.log('🛑 [Agora ScreenShare] Stopping screen share');
        
        // Unpublish screen track(s) first
        if (localScreenTrackRef.current) {
          await agoraClientRef.current.unpublish([localScreenTrackRef.current]);
          localScreenTrackRef.current.stop();
          localScreenTrackRef.current.close();
          localScreenTrackRef.current = null;
        }
        
        if (screenShareStreamRef.current) {
          screenShareStreamRef.current.getTracks().forEach(track => {
            track.stop();
            console.log('🛑 [ScreenShare] Stopped track:', track.kind);
          });
          screenShareStreamRef.current = null;
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
        
        const screenTracks = await AgoraRTC.createScreenVideoTrack({}, 'auto');
        
        // createScreenVideoTrack can return a single track or an array [videoTrack, audioTrack]
        const screenVideoTrack = Array.isArray(screenTracks) ? screenTracks[0] : screenTracks;
        const screenAudioTrack = Array.isArray(screenTracks) ? screenTracks[1] : null;
        
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
        
        // Publish screen track(s) - include audio track if available
        const tracksToPublish = [screenVideoTrack];
        if (screenAudioTrack) {
          tracksToPublish.push(screenAudioTrack);
        }
        await agoraClientRef.current.publish(tracksToPublish);
        
        // Update local video display
        if (localVideoRef.current) {
          screenVideoTrack.play(localVideoRef.current);
        }
        
        // Update local stream for MediaRecorder compatibility
        const stream = new MediaStream([screenVideoTrack.getMediaStreamTrack()]);
        if (screenAudioTrack) {
          stream.addTrack(screenAudioTrack.getMediaStreamTrack());
        } else if (localAudioTrackRef.current) {
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

  const toggleFullscreen = async () => {
    const container = localVideoContainerRef.current;
    if (!container) return;

    try {
      if (!isFullscreen) {
        // Enter fullscreen
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
          await container.webkitRequestFullscreen();
        } else if (container.mozRequestFullScreen) {
          await container.mozRequestFullScreen();
        } else if (container.msRequestFullscreen) {
          await container.msRequestFullscreen();
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  };

  return (
    <div className="meet-container">
      <div className="meet-main-area">
        <div className="meet-video-grid">
          {/* Local Video */}
          <div 
            ref={localVideoContainerRef}
            className={`meet-video-container local ${isFullscreen ? 'fullscreen' : ''}`}
          >
             <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`meet-video ${isVideoOff ? 'hidden' : ''} ${isScreenSharing ? '' : 'mirror'}`}
            />
            {isVideoOff && <div className="meet-avatar-placeholder">{userName.charAt(0)}</div>}
            <div className="meet-name-tag">You ({userName})</div>
            {isScreenSharing && (
              <button
                className="meet-fullscreen-btn"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? <Icons.FullscreenExit /> : <Icons.Fullscreen />}
              </button>
            )}
          </div>

          {/* Remote Videos */}
          {users.map(user => (
            <div key={user.socketId} className="meet-video-container">
              <video
                ref={el => { 
                  if (el) {
                    console.log('📹 [Render] Video element created/updated for socketId:', user.socketId, {
                      userName: user.userName,
                      allVideoElements: Object.keys(remoteVideosRef.current),
                      pendingTracksBySocketId: Object.keys(pendingAgoraTracksRef.current),
                      pendingTracksByUid: Object.keys(pendingAgoraTracksByUidRef.current),
                      uidMappings: Object.keys(agoraUidToSocketIdRef.current).map(uid => `${uid}->${agoraUidToSocketIdRef.current[uid]}`)
                    });
                    
                    // Check if there was an old element with a stream
                    const oldElement = remoteVideosRef.current[user.socketId];
                    const oldStream = oldElement && oldElement.srcObject;
                    
                    remoteVideosRef.current[user.socketId] = el;
                    
                    let trackPlayed = false;
                    
                    // Strategy 1: Check if there's a pending Agora track for this socketId
                    const pendingTrack = pendingAgoraTracksRef.current[user.socketId];
                    if (pendingTrack && pendingTrack.videoTrack) {
                      console.log('🔄 [Agora] Strategy 1: Found pending track by socketId:', user.socketId);
                      try {
                        pendingTrack.videoTrack.play(el);
                        console.log('✅ [Agora] Successfully played pending track on new video element');
                        delete pendingAgoraTracksRef.current[user.socketId];
                        trackPlayed = true;
                      } catch (err) {
                        console.error('❌ [Agora] Error playing pending track:', err);
                      }
                    }
                    
                    // Strategy 2: Check if there's an Agora UID mapped to this socketId that has a pending track
                    if (!trackPlayed) {
                      const mappedUid = Object.keys(agoraUidToSocketIdRef.current).find(
                        uid => agoraUidToSocketIdRef.current[uid] === user.socketId
                      );
                      if (mappedUid) {
                        // Check if we have a track stored by this UID
                        const trackByUid = pendingAgoraTracksByUidRef.current[mappedUid];
                        if (trackByUid && trackByUid.videoTrack) {
                          console.log('🔄 [Agora] Strategy 2: Found track by mapped UID. UID:', mappedUid, 'socketId:', user.socketId);
                          try {
                            trackByUid.videoTrack.play(el);
                            console.log('✅ [Agora] Successfully played track from UID mapping');
                            delete pendingAgoraTracksByUidRef.current[mappedUid];
                            trackPlayed = true;
                          } catch (err) {
                            console.error('❌ [Agora] Error playing track from UID mapping:', err);
                          }
                        }
                        // Also check pendingAgoraTracksRef with the UID as key (fallback)
                        if (!trackPlayed && pendingAgoraTracksRef.current[mappedUid] && pendingAgoraTracksRef.current[mappedUid].videoTrack) {
                          console.log('🔄 [Agora] Strategy 2b: Found track in pendingAgoraTracksRef by UID:', mappedUid);
                          try {
                            pendingAgoraTracksRef.current[mappedUid].videoTrack.play(el);
                            console.log('✅ [Agora] Successfully played track from pendingAgoraTracksRef by UID');
                            delete pendingAgoraTracksRef.current[mappedUid];
                            trackPlayed = true;
                          } catch (err) {
                            console.error('❌ [Agora] Error playing track from pendingAgoraTracksRef by UID:', err);
                          }
                        }
                      }
                    }
                    
                    // Strategy 3: Check if there's an unmapped Agora track that should be matched to this socketId
                    // This handles the race condition where Agora publishes before we have the socketId
                    if (!trackPlayed) {
                      const unmappedUids = Object.keys(pendingAgoraTracksByUidRef.current).filter(
                        uid => !agoraUidToSocketIdRef.current[uid] || 
                               agoraUidToSocketIdRef.current[uid] === uid.toString() // UID was used as fallback socketId
                      );
                      
                      if (unmappedUids.length > 0) {
                        // Match the first unmapped track to this socketId
                        const uidToMatch = unmappedUids[0];
                        const unmappedTrack = pendingAgoraTracksByUidRef.current[uidToMatch];
                        
                        if (unmappedTrack && unmappedTrack.videoTrack) {
                          console.log('🔄 [Agora] Strategy 3: Matching unmapped Agora track. UID:', uidToMatch, '-> socketId:', user.socketId);
                          agoraUidToSocketIdRef.current[uidToMatch] = user.socketId;
                          try {
                            unmappedTrack.videoTrack.play(el);
                            console.log('✅ [Agora] Successfully played unmapped track on new video element');
                            delete pendingAgoraTracksByUidRef.current[uidToMatch];
                            // Also clean up from pendingAgoraTracksRef if it exists there
                            if (pendingAgoraTracksRef.current[uidToMatch]) {
                              delete pendingAgoraTracksRef.current[uidToMatch];
                            }
                            trackPlayed = true;
                          } catch (err) {
                            console.error('❌ [Agora] Error playing unmapped track:', err);
                          }
                        }
                      }
                    }
                    
                    // Strategy 4: Check activeRemoteVideoTracksRef for already-subscribed tracks
                    if (!trackPlayed) {
                      // First, check if there's a mapped UID for this socketId
                      const mappedUid = Object.keys(agoraUidToSocketIdRef.current).find(
                        uid => agoraUidToSocketIdRef.current[uid] === user.socketId
                      );
                      
                      if (mappedUid) {
                        const activeTrack = activeRemoteVideoTracksRef.current[mappedUid];
                        if (activeTrack) {
                          console.log('🔄 [Agora] Strategy 4: Found active track by mapped UID. UID:', mappedUid, 'socketId:', user.socketId);
                          try {
                            activeTrack.play(el);
                            console.log('✅ [Agora] Successfully played active track from activeRemoteVideoTracksRef');
                            trackPlayed = true;
                            // Clean up pending tracks
                            if (pendingAgoraTracksRef.current[user.socketId]) {
                              delete pendingAgoraTracksRef.current[user.socketId];
                            }
                            if (pendingAgoraTracksByUidRef.current[mappedUid]) {
                              delete pendingAgoraTracksByUidRef.current[mappedUid];
                            }
                          } catch (err) {
                            console.error('❌ [Agora] Error playing active track:', err);
                          }
                        }
                      }
                      
                      // If still not found, check if any unmapped active track should be matched to this socketId
                      if (!trackPlayed) {
                        const unmappedUids = Object.keys(activeRemoteVideoTracksRef.current).filter(
                          uid => !agoraUidToSocketIdRef.current[uid] || 
                                 agoraUidToSocketIdRef.current[uid] === uid.toString()
                        );
                        
                        if (unmappedUids.length > 0) {
                          const uidToMatch = unmappedUids[0];
                          const activeTrack = activeRemoteVideoTracksRef.current[uidToMatch];
                          if (activeTrack) {
                            console.log('🔄 [Agora] Strategy 4b: Matching unmapped active track. UID:', uidToMatch, '-> socketId:', user.socketId);
                            agoraUidToSocketIdRef.current[uidToMatch] = user.socketId;
                            try {
                              activeTrack.play(el);
                              console.log('✅ [Agora] Successfully played unmapped active track');
                              trackPlayed = true;
                              // Clean up pending tracks
                              if (pendingAgoraTracksRef.current[user.socketId]) {
                                delete pendingAgoraTracksRef.current[user.socketId];
                              }
                              if (pendingAgoraTracksByUidRef.current[uidToMatch]) {
                                delete pendingAgoraTracksByUidRef.current[uidToMatch];
                              }
                            } catch (err) {
                              console.error('❌ [Agora] Error playing unmapped active track:', err);
                            }
                          }
                        }
                      }
                    }
                    
                    if (!trackPlayed) {
                      console.log('⚠️ [Agora] No pending track found for socketId:', user.socketId, '- will wait for Agora publish event');
                    }
                    
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
                muted
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

          {isCreator && (!isMobile || mobileMenuExpanded) && (
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
              className="meet-control-btn image-btn"
              onClick={() => setMobileMenuExpanded(!mobileMenuExpanded)}
              title={mobileMenuExpanded ? "Collapse" : "More options"}
            >
              ...
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
            <button onClick={handleNamePopupConfirm} className="popup-confirm-btn">Join</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Conference;
