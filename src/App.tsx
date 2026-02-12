import { useState, useEffect, useMemo, useRef } from 'react';
import { CameraFeed } from './components/CameraFeed';
import { ARView } from './components/ARView';
import { MiniMap } from './components/MiniMap';
import { NavigationCard } from './components/NavigationCard';
// import { LandmarkLabel, DestinationPin } from './components/LandmarkLabel';
import { useSensorFusion } from './hooks/useSensorFusion';
import { calculateDistance, calculateBearing, findNearestWaypointIndex } from './utils/geoUtils';
import routeData from './data/route.json';

function App() {
  // Sensor Fusion: GPS + Orientation + Kalman Filter
  const {
    smoothedLocation,
    heading: deviceHeading,
    pitch: devicePitch,
    accuracy: gpsAccuracy,
    loaded: geoLoaded,
    error: geoError,
    calibrateHeading,
  } = useSensorFusion();

  // Use smoothed (Kalman-filtered) location for navigation
  const userLoc = smoothedLocation;

  const [targetIndex, setTargetIndex] = useState<number>(1);
  const [isNavigating, setIsNavigating] = useState(false);
  const [activeRoute, setActiveRoute] = useState<any[]>([]);
  const [isOutbound, setIsOutbound] = useState(true);

  // Audio refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedRef = useRef<string | null>(null);
  const isPlayingRef = useRef<boolean>(false);

  // Initialize Navigation
  useEffect(() => {
    if (geoLoaded && !isNavigating && userLoc.lat !== 0) {
      const outboundStart = routeData.outbound[0];
      const inboundStart = routeData.inbound[0];

      const distToOutbound = calculateDistance(userLoc, outboundStart);
      const distToInbound = calculateDistance(userLoc, inboundStart);

      const isOut = distToOutbound <= distToInbound;
      setIsOutbound(isOut);
      const selectedRoute = isOut ? routeData.outbound : routeData.inbound;
      setActiveRoute(selectedRoute);

      const nearestIdx = findNearestWaypointIndex(userLoc, selectedRoute);
      let newTarget = nearestIdx + 1;
      if (newTarget >= selectedRoute.length) newTarget = selectedRoute.length - 1;

      setTargetIndex(newTarget);
      setIsNavigating(true);
    }
  }, [geoLoaded, userLoc, isNavigating]);

  // Toggle route direction
  const toggleRoute = () => {
    const newIsOutbound = !isOutbound;
    setIsOutbound(newIsOutbound);
    const newRoute = newIsOutbound ? routeData.outbound : routeData.inbound;
    setActiveRoute(newRoute);
    const nearestIdx = findNearestWaypointIndex(userLoc, newRoute);
    let newTarget = nearestIdx + 1;
    if (newTarget >= newRoute.length) newTarget = newRoute.length - 1;
    setTargetIndex(newTarget);
  };

  // Update Navigation Progress & Audio
  useEffect(() => {
    if (!isNavigating || activeRoute.length === 0) return;

    const currentTarget = activeRoute[targetIndex];
    if (!currentTarget) return;

    const dist = calculateDistance(userLoc, currentTarget);

    // Audio Playback Logic
    if (dist < 50 && dist > 10 && currentTarget.type === 'bus_stop' && currentTarget.audioFile) {
      if (lastPlayedRef.current !== currentTarget.audioFile && !isPlayingRef.current) {
        lastPlayedRef.current = currentTarget.audioFile;
        isPlayingRef.current = true;

        if (!audioRef.current) {
          audioRef.current = new Audio();
          audioRef.current.preload = 'auto';
          audioRef.current.volume = 1.0;
        }

        audioRef.current.onended = null;
        audioRef.current.onerror = null;

        const stopAudioFile = currentTarget.audioFile;

        audioRef.current.onerror = () => {
          isPlayingRef.current = false;
        };

        audioRef.current.src = `/assets/AudioTrack/getOff.mp3`;

        audioRef.current.onended = () => {
          if (!audioRef.current) {
            isPlayingRef.current = false;
            return;
          }
          audioRef.current.src = `/assets/AudioTrack/${stopAudioFile}`;
          audioRef.current.onended = () => {
            isPlayingRef.current = false;
          };
          audioRef.current.play().catch(() => {
            isPlayingRef.current = false;
          });
        };

        audioRef.current.play().catch(() => {
          isPlayingRef.current = false;
        });
      }
    }

    // Switch to next waypoint
    if (dist < 20) {
      if (targetIndex < activeRoute.length - 1) {
        setTargetIndex(prev => prev + 1);
      }
    }
  }, [userLoc, targetIndex, isNavigating, activeRoute]);

  // Derived calculations
  const currentTarget = activeRoute[targetIndex];

  const distanceToTarget = useMemo(() => {
    if (!currentTarget) return 0;
    return Math.round(calculateDistance(userLoc, currentTarget));
  }, [userLoc, currentTarget]);

  // Find next turn and next bus stop
  const nextTurn = useMemo(() => {
    for (let i = targetIndex; i < activeRoute.length; i++) {
      if (activeRoute[i].type.includes('turn')) {
        const dist = Math.round(calculateDistance(userLoc, activeRoute[i]));
        return { ...activeRoute[i], distance: dist };
      }
    }
    return null;
  }, [activeRoute, targetIndex, userLoc]);

  const nextBusStop = useMemo(() => {
    for (let i = targetIndex; i < activeRoute.length; i++) {
      if (activeRoute[i].type === 'bus_stop') {
        const dist = Math.round(calculateDistance(userLoc, activeRoute[i]));
        let stopsUntil = 0;
        for (let j = targetIndex; j < i; j++) {
          if (activeRoute[j].type === 'bus_stop') stopsUntil++;
        }
        return { ...activeRoute[i], distance: dist, stopsUntil };
      }
    }
    return null;
  }, [activeRoute, targetIndex, userLoc]);

  // Find second bus stop (for 3rd card)
  const secondBusStop = useMemo(() => {
    let found = 0;
    for (let i = targetIndex; i < activeRoute.length; i++) {
      if (activeRoute[i].type === 'bus_stop') {
        found++;
        if (found === 2) {
          const dist = Math.round(calculateDistance(userLoc, activeRoute[i]));
          return { ...activeRoute[i], distance: dist };
        }
      }
    }
    return null;
  }, [activeRoute, targetIndex, userLoc]);

  const bearingToTarget = useMemo(() => {
    if (!currentTarget) return 0;
    const realBearing = calculateBearing(userLoc, currentTarget);
    const isTurn = currentTarget.type.includes('turn');
    const isNear = distanceToTarget < 40;

    if (isTurn && isNear) {
      return realBearing;
    }
    return deviceHeading;
  }, [userLoc, currentTarget, deviceHeading, distanceToTarget]);

  // Turn direction
  const getTurnDirection = (type: string): 'left' | 'right' | 'straight' => {
    if (type.includes('left')) return 'left';
    if (type.includes('right')) return 'right';
    return 'straight';
  };

  if (geoError) {
    return (
      <div style={{ padding: 20, color: 'white', background: '#1a1a1a', height: '100vh' }}>
        GPS Error: {geoError.message}. Please enable location services.
      </div>
    );
  }

  return (
    <div className="app-root">
      {/* ============ AR Camera (Full Screen Background) ============ */}
      <div className="ar-fullscreen">
        <CameraFeed />
        {geoLoaded && (
          <ARView
            targetBearing={bearingToTarget}
            currentHeading={deviceHeading}
            landmarks={routeData.landmarks}
            userLocation={userLoc}
          />
        )}

        {/* β Badge — Top Left */}
        <div className="beta-badge">β</div>

        {/* Heading Calibration Button — Top Right */}
        <button
          className="calibrate-btn"
          onClick={() => {
            if (activeRoute.length < 2) return;
            // Find current road segment
            const idx = Math.max(0, Math.min(targetIndex, activeRoute.length - 1));
            const prevIdx = Math.max(0, idx - 1);
            const from = activeRoute[prevIdx];
            const to = activeRoute[idx];
            // Calculate road bearing
            const roadBearing = calculateBearing(from, to);
            calibrateHeading(roadBearing);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        </button>

        {/* Debug Overlay */}
        <div className="debug-overlay">
          <div>HEAD: {Math.round(deviceHeading)}°</div>
          <div>KF: {userLoc.lat.toFixed(4)},{userLoc.lon.toFixed(4)}</div>
          <div>ACC: {gpsAccuracy.toFixed(0)}m PIT: {Math.round(devicePitch)}°</div>
        </div>
      </div>

      {/* ============ Route Name Bar (overlaid on AR) ============ */}
      <div className="route-bar">
        <button className="route-toggle-btn" onClick={toggleRoute}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            {isOutbound ? (
              <polyline points="9,6 15,12 9,18" />
            ) : (
              <polyline points="15,6 9,12 15,18" />
            )}
          </svg>
        </button>
        <span className="route-name">route β</span>
      </div>

      {/* ============ Info Cards (Horizontal Scroll) ============ */}
      <div className="cards-scroll-container">
        <div className="cards-scroll">
          {/* Card 1: Next Bus Stop */}
          {nextBusStop && (
            <NavigationCard
              type="stop"
              title={nextBusStop.name || 'Bus Stop'}
              distance={nextBusStop.distance}
              label="next stop"
            />
          )}

          {/* Card 2: Next Turn */}
          {nextTurn && (
            <NavigationCard
              type="turn"
              title={`Turn ${getTurnDirection(nextTurn.type) === 'left' ? 'Left' : 'Right'}`}
              distance={nextTurn.distance}
              turnDirection={getTurnDirection(nextTurn.type)}
              label="next stop"
            />
          )}

          {/* Card 3: Second Bus Stop */}
          {secondBusStop && (
            <NavigationCard
              type="stop"
              title={secondBusStop.name || 'Bus Stop'}
              distance={secondBusStop.distance}
              label="next stop"
            />
          )}

          {/* Card 4: Distance to target */}
          {currentTarget && (
            <NavigationCard
              type="stop"
              title={currentTarget.name || 'Target'}
              distance={distanceToTarget}
              label="next stop"
            />
          )}
        </div>
      </div>

      {/* ============ Mini Map (Bottom, Yellow Border) ============ */}
      <div className="minimap-wrapper">
        <MiniMap
          userLocation={userLoc}
          nextWaypointIndex={targetIndex}
          userHeading={deviceHeading}
          activeRoute={activeRoute}
        />
      </div>
    </div>
  );
}

export default App;
