import React, { useMemo } from 'react';
import routeData from '../data/route.json';
import type { Coordinate } from '../utils/geoUtils';

// Bus stop icon SVG (From new design)
const BusStopMarker = ({ x, y, isNext }: { x: number; y: number; isNext: boolean }) => (
    <g transform={`translate(${x - 8}, ${y - 16})`}>
        <rect
            x="0" y="0"
            width="16" height="16"
            rx="3"
            fill={isNext ? "#7CFC00" : "#4ade80"}
        />
        <path
            d="M4 4h8v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4z"
            fill="white"
        />
        <rect x="5" y="5" width="2" height="2" fill="#333" />
        <rect x="9" y="5" width="2" height="2" fill="#333" />
    </g>
);

interface MiniMapProps {
    userLocation: Coordinate;
    nextWaypointIndex: number;
    userHeading: number;
    activeRoute?: any[];
}

export const MiniMap: React.FC<MiniMapProps> = ({
    userLocation,
    nextWaypointIndex,
    userHeading,
    activeRoute = []
}) => {
    // Use passed activeRoute or fallback
    const displayRoute = activeRoute.length > 0 ? activeRoute : routeData.outbound;

    // Calculate bounding box (Original logic with slightly tighter padding)
    const { minLat, maxLat, minLon, maxLon } = useMemo(() => {
        let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
        displayRoute.forEach((wp: any) => {
            minLat = Math.min(minLat, wp.lat);
            maxLat = Math.max(maxLat, wp.lat);
            minLon = Math.min(minLon, wp.lon);
            maxLon = Math.max(maxLon, wp.lon);
        });
        // Original padding logic
        const latPad = (maxLat - minLat) * 0.1 || 0.001;
        const lonPad = (maxLon - minLon) * 0.1 || 0.001;
        return {
            minLat: minLat - latPad,
            maxLat: maxLat + latPad,
            minLon: minLon - lonPad,
            maxLon: maxLon + lonPad
        };
    }, [displayRoute]);

    const normalize = (lat: number, lon: number) => {
        const y = ((maxLat - lat) / (maxLat - minLat)) * 100; // Invert Lat for Y
        const x = ((lon - minLon) / (maxLon - minLon)) * 100;
        return { x, y };
    };

    // Generate route line points
    const routePoints = displayRoute.map((wp: any) => {
        const pos = normalize(wp.lat, wp.lon);
        return `${pos.x},${pos.y}`;
    }).join(' ');

    const userPos = normalize(userLocation.lat, userLocation.lon);
    const nextWp = displayRoute[nextWaypointIndex];

    return (
        <div className="minimap-container">
            <svg viewBox="0 0 100 100" className="minimap-svg" preserveAspectRatio="xMidYMid meet">
                <style>{`
          @keyframes pulse {
            0% { r: 3; opacity: 1; }
            100% { r: 10; opacity: 0; }
          }
          .user-pulse {
            animation: pulse 2s infinite;
            fill: #00d4ff;
          }
        `}</style>

                {/* Route Line - Original Style */}
                <polyline
                    points={routePoints}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.4)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Next Leg Highlight (Dotted Line) - Original Feature */}
                {nextWp && userLocation.lat !== 0 && (
                    <line
                        x1={userPos.x} y1={userPos.y}
                        x2={normalize(nextWp.lat, nextWp.lon).x} y2={normalize(nextWp.lat, nextWp.lon).y}
                        stroke="#7CFC00"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                        opacity="0.8"
                    />
                )}

                {/* Waypoints & Bus Stops */}
                {displayRoute.map((wp: any, idx: number) => {
                    const pos = normalize(wp.lat, wp.lon);
                    const isNext = idx === nextWaypointIndex;

                    if (wp.type === 'bus_stop') {
                        return (
                            <BusStopMarker
                                key={wp.id}
                                x={pos.x}
                                y={pos.y}
                                isNext={isNext}
                            />
                        );
                    }

                    // Regular waypoint (Turn) - Original Dot Style
                    return (
                        <circle
                            key={wp.id}
                            cx={pos.x}
                            cy={pos.y}
                            r={isNext ? 3 : 2}
                            fill={isNext ? "#7CFC00" : "white"}
                            opacity={isNext ? 1 : 0.5}
                        />
                    );
                })}

                {/* User Arrow & Pulse - Original Style */}
                {userLocation.lat !== 0 && (
                    <g transform={`translate(${userPos.x}, ${userPos.y})`}>
                        {/* Pulse Effect */}
                        <circle cx="0" cy="0" r="3" className="user-pulse" />

                        {/* Direction Arrow (Simple) */}
                        <g transform={`rotate(${userHeading})`}>
                            <path d="M0 -6 L5 6 L0 3 L-5 6 Z" fill="#00d4ff" stroke="white" strokeWidth="1.5" />
                        </g>
                    </g>
                )}
            </svg>
        </div>
    );
};
