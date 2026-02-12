import { useState, useEffect, useRef } from 'react';

// Smoothing factor for Low Pass Filter (0.0 - 1.0)
const SMOOTHING_FACTOR = 0.15;

export const useOrientation = () => {
    const [heading, setHeading] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);

    const currentHeadingRef = useRef<number>(0);

    useEffect(() => {
        const handleOrientation = (event: DeviceOrientationEvent) => {
            let compassHeading: number | null = null;

            // iOS WebKit
            if (typeof (event as any).webkitCompassHeading === 'number') {
                compassHeading = (event as any).webkitCompassHeading;
            }
            // Android / Standards (Absolute)
            // 'alpha' is rotation around z-axis. 0 is North.
            // Increases counter-clockwise.
            // Compass heading (clockwise from North) = 360 - alpha.
            else if (event.alpha !== null) {
                // If the event is absolute, or generally on Android Chrome
                compassHeading = (360 - event.alpha) % 360;
            }

            if (compassHeading !== null) {
                // Screen orientation correction (Portrait vs Landscape)
                // When in landscape, we need to adjust the heading.
                // window.orientation is deprecated but still widely supported.
                // screen.orientation.angle is the modern standard.
                let screenAngle = 0;
                if (screen.orientation && screen.orientation.angle !== undefined) {
                    screenAngle = screen.orientation.angle;
                } else if (typeof window.orientation === 'number') {
                    screenAngle = window.orientation as number;
                }

                // Correct heading calculation:
                // If device is rotated 90 deg (Landscape Primary), screenAngle is 90.
                // Compass heading (Device Top) points West (270) when User faces North (0).
                // We want 0. So 270 + 90 = 360 (0).
                // Therefore, we should ADD the screen angle.

                let correctedHeading = compassHeading;
                if (screenAngle !== 0) {
                    correctedHeading = (compassHeading + screenAngle) % 360;
                }

                // Smoothing (Low Pass Filter)
                const currentRad = (currentHeadingRef.current * Math.PI) / 180;
                const targetRad = (correctedHeading * Math.PI) / 180;

                // Decompose to x, y
                const cx = Math.cos(currentRad);
                const cy = Math.sin(currentRad);
                const tx = Math.cos(targetRad);
                const ty = Math.sin(targetRad);

                // Lerp
                const nx = cx + (tx - cx) * SMOOTHING_FACTOR;
                const ny = cy + (ty - cy) * SMOOTHING_FACTOR;

                // Recompose
                let smoothHeading = (Math.atan2(ny, nx) * 180) / Math.PI;
                smoothHeading = (smoothHeading + 360) % 360;

                currentHeadingRef.current = smoothHeading;
                setHeading(smoothHeading);
            }
        };

        // iOS Permission Request
        const requestPermission = async () => {
            if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
                try {
                    const permission = await (DeviceOrientationEvent as any).requestPermission();
                    if (permission !== 'granted') {
                        setError('Permission denied');
                        return false;
                    }
                } catch (e) {
                    console.error(e);
                    return false;
                }
            }
            return true;
        };

        const init = async () => {
            const allowed = await requestPermission();
            if (allowed) {
                // Try absolute event first (Android)
                if ('ondeviceorientationabsolute' in window) {
                    (window as any).addEventListener('deviceorientationabsolute', handleOrientation, true);
                } else {
                    (window as any).addEventListener('deviceorientation', handleOrientation, true);
                }
            }
        };

        init();

        return () => {
            if ('ondeviceorientationabsolute' in window) {
                (window as any).removeEventListener('deviceorientationabsolute', handleOrientation, true);
            } else {
                (window as any).removeEventListener('deviceorientation', handleOrientation, true);
            }
        };
    }, []);

    return { heading, error };
};
