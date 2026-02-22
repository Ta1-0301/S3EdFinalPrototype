import { useState, useEffect, useMemo, useRef } from 'react';
import { CameraFeed } from './components/CameraFeed';
import { ARView } from './components/ARView';
import { MiniMap } from './components/MiniMap';
import { NavigationCard } from './components/NavigationCard';
// import { LandmarkLabel, DestinationPin } from './components/LandmarkLabel';
import { useSensorFusion } from './hooks/useSensorFusion';
import { calculateDistance, calculateBearing, findNearestWaypointIndex, projectPoint } from './utils/geoUtils';
import routeData from './data/route.json';

function App() {
  // Sensor Fusion: GPS + Orientation + Kalman Filter
  const {
    smoothedLocation,
    rawLocation,
    heading: deviceHeading,
    pitch: devicePitch,
    accuracy: gpsAccuracy,
    speed: gpsSpeed,
    loaded: geoLoaded,
    error: geoError,
    calibrateHeading,
  } = useSensorFusion();

  // Composite heading for MiniMap:
  // - GPS heading (from movement) is used when speed >= 0.5 m/s (more accurate when moving)
  // - Compass heading is used when stationary/slow, or GPS heading is unavailable
  // Weight blends smoothly between the two sources
  const compositeHeading = useMemo(() => {
    const gpsHeading = rawLocation.headingGPS;
    const speed = gpsSpeed ?? 0;
    if (gpsHeading != null && !isNaN(gpsHeading) && speed >= 0.5) {
      // Blend: higher speed = more GPS trust (up to 80%)
      const gpsWeight = Math.min(0.8, speed / 3);
      // Handle angle wrap-around when blending
      let diff = gpsHeading - deviceHeading;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      return (deviceHeading + diff * gpsWeight + 360) % 360;
    }
    return deviceHeading;
  }, [rawLocation.headingGPS, gpsSpeed, deviceHeading]);

  // Use smoothed (Kalman-filtered) location for navigation
  const userLoc = smoothedLocation;

  const [targetIndex, setTargetIndex] = useState<number>(1);
  const [isNavigating, setIsNavigating] = useState(false);
  const [activeRoute, setActiveRoute] = useState<any[]>([]);
  const [isOutbound, setIsOutbound] = useState(true);

  // Extract bus stops from active route for AR pins
  const busStopsList = useMemo(() =>
    activeRoute.filter((wp: any) => wp.type === 'bus_stop'),
    [activeRoute]);

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

        audioRef.current.src = `./assets/AudioTrack/Audio file Get off.mp3`;

        audioRef.current.onended = () => {
          if (!audioRef.current) {
            isPlayingRef.current = false;
            return;
          }
          audioRef.current.src = `./assets/AudioTrack/${stopAudioFile}`;
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

  // Next 3 waypoints in route order (starting from current target)
  const upcomingWaypoints = useMemo(() => {
    const results = [];
    for (let i = targetIndex; i < activeRoute.length && results.length < 3; i++) {
      const dist = Math.round(calculateDistance(userLoc, activeRoute[i]));
      results.push({ ...activeRoute[i], distance: dist });
    }
    return results;
  }, [activeRoute, targetIndex, userLoc]);

  const bearingToTarget = useMemo(() => {
    if (!currentTarget) return deviceHeading;

    // Look-ahead distance beyond the turn vertex (meters)
    const LOOK_AHEAD_M = 15;
    // Trigger radius: start pointing to turn when within this distance
    const TURN_TRIGGER_M = 45;

    // Helper: given a turn waypoint index, compute bearing toward the look-ahead point
    const lookAheadBearing = (turnIdx: number): number => {
      const turnWp = activeRoute[turnIdx];
      const exitWp = activeRoute[turnIdx + 1]; // waypoint after the turn
      if (!exitWp) {
        // No exit waypoint — fall back to pointing directly at the turn
        return calculateBearing(userLoc, turnWp);
      }
      // Exit bearing = direction from turn vertex to next waypoint
      const exitBearing = calculateBearing(turnWp, exitWp);
      // Project a point 15m past the turn vertex along the exit bearing
      const ahead = projectPoint(turnWp, exitBearing, LOOK_AHEAD_M);
      return calculateBearing(userLoc, ahead);
    };

    // 1. Is the current target itself a turn and close enough?
    if (currentTarget.type.includes('turn') && distanceToTarget < TURN_TRIGGER_M) {
      return lookAheadBearing(targetIndex);
    }

    // 2. Look ahead in the route for the nearest upcoming turn within range
    for (let i = targetIndex + 1; i < activeRoute.length; i++) {
      if (activeRoute[i].type.includes('turn')) {
        const distToTurn = calculateDistance(userLoc, activeRoute[i]);
        if (distToTurn < TURN_TRIGGER_M) {
          return lookAheadBearing(i);
        }
        break; // only check the nearest upcoming turn
      }
    }

    // 3. Default: straight ahead
    return deviceHeading;
  }, [userLoc, currentTarget, deviceHeading, distanceToTarget, activeRoute, targetIndex]);

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
            busStops={busStopsList}
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
          {upcomingWaypoints.map((wp, idx) => {
            const isTurn = wp.type.includes('turn');
            return (
              <NavigationCard
                key={wp.id ?? idx}
                type={isTurn ? 'turn' : 'stop'}
                title={
                  isTurn
                    ? `Turn ${getTurnDirection(wp.type) === 'left' ? 'Left' : 'Right'}`
                    : wp.name || 'Waypoint'
                }
                distance={wp.distance}
                turnDirection={isTurn ? getTurnDirection(wp.type) : undefined}
                label={idx === 0 ? 'next' : `in ${idx + 1} stops`}
              />
            );
          })}
        </div>
      </div>

      {/* ============ Mini Map (Bottom, Yellow Border) ============ */}
      <div className="minimap-wrapper">
        <MiniMap
          userLocation={userLoc}
          nextWaypointIndex={targetIndex}
          userHeading={compositeHeading}
          activeRoute={activeRoute}
        />
      </div>
    </div>
  );
}

export default App;
