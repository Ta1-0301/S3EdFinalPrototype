import React, { useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Coordinate } from '../utils/geoUtils';

interface MiniMapProps {
    userLocation: Coordinate;
    nextWaypointIndex: number;
    userHeading: number;
    activeRoute?: any[];
}

export const MiniMap: React.FC<MiniMapProps> = ({
    userLocation,
    userHeading,
    activeRoute = []
}) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const userMarkerRef = useRef<maplibregl.Marker | null>(null);
    const initializedRef = useRef(false);

    // Initialize map
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: {
                version: 8,
                sources: {
                    'osm-tiles': {
                        type: 'raster',
                        tiles: [
                            'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                            'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                            'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
                        ],
                        tileSize: 256,
                        attribution: '© OpenStreetMap',
                    },
                },
                layers: [
                    {
                        id: 'osm-tiles-layer',
                        type: 'raster',
                        source: 'osm-tiles',
                        minzoom: 0,
                        maxzoom: 19,
                    },
                ],
            },
            center: [170.5194, -45.8670], // Dunedin default
            zoom: 16,
            bearing: 0,
            pitch: 0,
            interactive: false, // No user interaction — display only
            attributionControl: false,
        });

        // Disable all interactions for a clean display-only map
        map.dragRotate.disable();
        map.touchZoomRotate.disable();
        map.scrollZoom.disable();
        map.boxZoom.disable();
        map.dragPan.disable();
        map.doubleClickZoom.disable();
        map.keyboard.disable();

        map.on('load', () => {
            // Add route source (empty initially — will be populated when route is set)
            map.addSource('route', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: [],
                    },
                },
            });

            // Route line - upcoming section (bright)
            map.addLayer({
                id: 'route-line',
                type: 'line',
                source: 'route',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round',
                },
                paint: {
                    'line-color': '#ffffff',
                    'line-width': 4,
                    'line-opacity': 0.9,
                },
            });

            // Bus stops source
            map.addSource('bus-stops', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: [],
                },
            });

            // Bus stop markers
            map.addLayer({
                id: 'bus-stops-layer',
                type: 'circle',
                source: 'bus-stops',
                paint: {
                    'circle-radius': 6,
                    'circle-color': '#4CAF50',
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff',
                },
            });

            // Bus stop icons (inner)
            map.addLayer({
                id: 'bus-stops-inner',
                type: 'circle',
                source: 'bus-stops',
                paint: {
                    'circle-radius': 3,
                    'circle-color': '#ffffff',
                },
            });

            initializedRef.current = true;
        });

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
            initializedRef.current = false;
        };
    }, []);

    // Update route data when activeRoute changes
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !initializedRef.current || activeRoute.length === 0) return;

        const routeSource = map.getSource('route') as maplibregl.GeoJSONSource;
        if (routeSource) {
            const coordinates = activeRoute.map((wp: any) => [wp.lon, wp.lat]);
            routeSource.setData({
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates,
                },
            });
        }

        // Update bus stops
        const busStopSource = map.getSource('bus-stops') as maplibregl.GeoJSONSource;
        if (busStopSource) {
            const features = activeRoute
                .filter((wp: any) => wp.type === 'bus_stop')
                .map((wp: any) => ({
                    type: 'Feature' as const,
                    properties: { name: wp.name || 'Stop' },
                    geometry: {
                        type: 'Point' as const,
                        coordinates: [wp.lon, wp.lat],
                    },
                }));
            busStopSource.setData({
                type: 'FeatureCollection',
                features,
            });
        }

        // Fit bounds to route
        if (activeRoute.length >= 2) {
            const bounds = new maplibregl.LngLatBounds();
            activeRoute.forEach((wp: any) => bounds.extend([wp.lon, wp.lat]));
            map.fitBounds(bounds, { padding: 30, duration: 0 });
        }
    }, [activeRoute]);

    // Update user position and heading
    useEffect(() => {
        const map = mapRef.current;
        if (!map || userLocation.lat === 0) return;

        // Center map on user — heading-up display
        // MapLibre bearing = compass heading → rotates map so heading is "up"
        map.easeTo({
            center: [userLocation.lon, userLocation.lat],
            bearing: userHeading,
            duration: 300,
            zoom: 17,
        });

        // Create or update user marker
        if (!userMarkerRef.current) {
            const el = document.createElement('div');
            el.className = 'maplibre-user-marker';
            el.innerHTML = `
                <svg width="28" height="28" viewBox="0 0 24 24">
                    <polygon points="12,2 22,22 12,17 2,22" fill="none" stroke="#00d4ff" stroke-width="2"/>
                </svg>
            `;

            userMarkerRef.current = new maplibregl.Marker({
                element: el,
                // viewport alignment = arrow always points up on screen
                rotationAlignment: 'viewport',
                pitchAlignment: 'viewport',
            })
                .setLngLat([userLocation.lon, userLocation.lat])
                .addTo(map);
        } else {
            userMarkerRef.current.setLngLat([userLocation.lon, userLocation.lat]);
        }
    }, [userLocation, userHeading]);

    return (
        <div className="minimap-container">
            <div ref={mapContainerRef} className="minimap-gl" />
        </div>
    );
};
