import { useState, useEffect } from 'react';
import type { Coordinate } from '../utils/geoUtils';

interface GeolocationState {
    loaded: boolean;
    coordinates: Coordinate;
    error?: {
        code: number;
        message: string;
    };
}

export const useGeolocation = () => {
    const [location, setLocation] = useState<GeolocationState>({
        loaded: false,
        coordinates: { lat: 0, lon: 0 },
    });

    useEffect(() => {
        if (!('geolocation' in navigator)) {
            setLocation((state) => ({
                ...state,
                loaded: true,
                error: {
                    code: 0,
                    message: 'Geolocation not supported',
                },
            }));
            return;
        }

        const onSuccess = (position: GeolocationPosition) => {
            setLocation({
                loaded: true,
                coordinates: {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                },
            });
        };

        const onError = (error: GeolocationPositionError) => {
            setLocation((state) => ({
                ...state,
                loaded: true,
                error: {
                    code: error.code,
                    message: error.message,
                },
            }));
        };

        const options = {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000,
        };

        const watcher = navigator.geolocation.watchPosition(
            onSuccess,
            onError,
            options
        );

        return () => navigator.geolocation.clearWatch(watcher);
    }, []);

    return location;
};
