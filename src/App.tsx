import { useState, useEffect, useMemo, useRef } from 'react';
import { CameraFeed } from './components/CameraFeed';
import { ARView } from './components/ARView';
import { MiniMap } from './components/MiniMap';
import { NavigationCard } from './components/NavigationCard';
// import { LandmarkLabel, DestinationPin } from './components/LandmarkLabel';
import { useGeolocation } from './hooks/useGeolocation';
import { useOrientation } from './hooks/useOrientation';
import { calculateDistance, calculateBearing, findNearestWaypointIndex } from './utils/geoUtils';
import routeData from './data/route.json';

function App() {
  const { coordinates: userLoc, loaded: geoLoaded, error: geoError } = useGeolocation();
  const { heading: deviceHeading } = useOrientation();

  const [targetIndex, setTargetIndex] = useState<number>(1);
  const [isNavigating, setIsNavigating] = useState(false);
  const [activeRoute, setActiveRoute] = useState<any[]>([]);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);

  // Orientation detection
  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

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

      const selectedRoute = distToInbound < distToOutbound ? routeData.inbound : routeData.outbound;
      setActiveRoute(selectedRoute);

      const nearestIdx = findNearestWaypointIndex(userLoc, selectedRoute);
      let newTarget = nearestIdx + 1;
      if (newTarget >= selectedRoute.length) newTarget = selectedRoute.length - 1;

      setTargetIndex(newTarget);
      setIsNavigating(true);
    }
  }, [geoLoaded, userLoc, isNavigating]);

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
        // Count stops until this one
        let stopsUntil = 0;
        for (let j = targetIndex; j < i; j++) {
          if (activeRoute[j].type === 'bus_stop') stopsUntil++;
        }
        return { ...activeRoute[i], distance: dist, stopsUntil };
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

  // Calculate progress percentage
  const progressPercent = useMemo(() => {
    if (activeRoute.length === 0) return 0;
    return Math.min(100, (targetIndex / (activeRoute.length - 1)) * 100);
  }, [targetIndex, activeRoute.length]);

  // Turn direction
  const getTurnDirection = (type: string): 'left' | 'right' | 'straight' => {
    if (type.includes('left')) return 'left';
    if (type.includes('right')) return 'right';
    return 'straight';
  };

  // Show destination pin when close (temporarily disabled)
  // const showDestinationPin = distanceToTarget < 100 && currentTarget?.type === 'goal';

  if (geoError) {
    return (
      <div style={{ padding: 20, color: 'white', background: '#1a1a1a', height: '100vh' }}>
        GPS Error: {geoError.message}. Please enable location services.
      </div>
    );
  }

  return (
    <div className={`app-container auto-layout ${isLandscape ? 'landscape' : 'portrait'}`}>
      {/* Side Panel - Navigation Cards + MiniMap */}
      <div className="side-panel">
        {/* Turn Card */}
        {nextTurn && (
          <NavigationCard
            type="turn"
            title={`Turn ${getTurnDirection(nextTurn.type) === 'left' ? 'Left' : 'Right'}`}
            distance={nextTurn.distance}
            subtitle={`${distanceToTarget}m away | stop in ${nextBusStop?.stopsUntil ?? 0}`}
            turnDirection={getTurnDirection(nextTurn.type)}
          />
        )}

        {/* Bus Stop Card */}
        {nextBusStop && (
          <NavigationCard
            type="stop"
            title={nextBusStop.name || 'Bus Stop'}
            distance={nextBusStop.distance}
            subtitle={nextBusStop.stopsUntil === 0 ? 'next stop' : `stop in ${nextBusStop.stopsUntil + 1}`}
          />
        )}

        {/* MiniMap */}
        <MiniMap
          userLocation={userLoc}
          nextWaypointIndex={targetIndex}
          userHeading={deviceHeading}
          activeRoute={activeRoute}
        />
      </div>

      {/* Camera View with AR Overlays */}
      <div className="camera-container">
        {/* Camera Feed */}
        <CameraFeed />

        {/* AR Arrow Layer */}
        {geoLoaded && (
          <ARView
            targetBearing={bearingToTarget}
            currentHeading={deviceHeading}
          />
        )}

        {/* Landmark Labels - Temporarily disabled */}
        {/* <LandmarkLabel
          name="Robertson Library"
          type="library"
          position={{ x: 75, y: 25 }}
          visible={true}
        /> */}

        {/* Destination Pin - Temporarily disabled */}
        {/* <DestinationPin
          position={{ x: 50, y: 60 }}
          visible={showDestinationPin}
        /> */}

        {/* Progress Bar (Vertical) */}
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{ height: `${progressPercent}%` }}
          />
        </div>

        {/* Compass Indicator */}
        <div style={{
          position: 'absolute',
          right: 40,
          top: '50%',
          transform: 'translateY(-50%) rotate(' + deviceHeading + 'deg)',
          zIndex: 25
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2">
            <polygon points="12,2 22,22 12,17 2,22" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default App;
