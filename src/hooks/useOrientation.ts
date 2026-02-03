

import { useState, useEffect, useRef } from 'react';

// Smoothing factor for Low Pass Filter (0.0 - 1.0)
// Lower = smoother but more lag. Higher = more responsive but jittery.
const SMOOTHING_FACTOR = 0.15;

export const useOrientation = () => {
    const [heading, setHeading] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);

    // Use ref to keep track of the smoothed angular value to prevent state-loop issues
    const currentHeadingRef = useRef<number>(0);
    const screenOrientationRef = useRef<number>(0);

    useEffect(() => {
        // 1. Handle Screen Orientation Changes (Portrait/Landscape)
        const updateScreenOrientation = () => {
            let angle = 0;
            if (typeof window !== 'undefined') {
                if (screen.orientation && screen.orientation.angle) {
                    angle = screen.orientation.angle;
                } else if (typeof window.orientation === 'number') {
                    angle = window.orientation as number;
                }
            }
            screenOrientationRef.current = angle;
        };

        window.addEventListener('orientationchange', updateScreenOrientation);
        updateScreenOrientation();

        // 2. Handle Device Orientation
        const handleOrientation = (event: any) => {
            let absoluteHeading: number | null = null;

            // iOS WebKit
            if (typeof event.webkitCompassHeading === 'number') {
                absoluteHeading = event.webkitCompassHeading;
            }
            // Android / Standards (Absolute)
            // Check if the event is absolute. 
            // Note: 'deviceorientationabsolute' event usually guarantees absolute values.
            else if (event.absolute === true || event.alpha !== null) {
                // alpha: rotation around z-axis [0, 360) within [0, 360)
                // 0 is Earth's North? Not always, but for 'deviceorientationabsolute' it should be.
                // Standard: z-axis is up. alpha=0 is north. 
                // rotation logic: alpha increases as device rotates counter-clockwise.
                // Compass heading is usually clockwise. 
                // So compassHeading = 360 - alpha.
                absoluteHeading = 360 - (event.alpha as number);
            }

            if (absoluteHeading !== null) {
                // Apply Screen Orientation Correction
                // If screen is rotated 90 deg (Landscape), we need to add/subtract 90 deg.
                let correctedHeading = absoluteHeading + screenOrientationRef.current;

                correctedHeading = (correctedHeading + 360) % 360;

                // Apply Low-Pass Filter (Smoothing)
                // We need custom logic for circular values (0 vs 360 boundary)
                // It's easier to smooth the vector components (sin/cos)

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

                // Throttling state updates could be good here if 60fps React renders are heavy,
                // but for now Update state directly.
                setHeading(smoothHeading);
            }
        };

        // Use absolute event if available (Android Chrome)
        if ('ondeviceorientationabsolute' in window) {
            (window as any).addEventListener('deviceorientationabsolute', handleOrientation as EventListener, true);
        }
        else if ('ondeviceorientation' in window) {
            // On iOS, this event includes webkitCompassHeading which IS absolute.
            // On standard non-absolute devices, this might be relative (which we want to avoid if possible).
            (window as any).addEventListener('deviceorientation', handleOrientation as EventListener, true);
        }
        else {
            setError("Device orientation not supported");
        }

        return () => {
            window.removeEventListener('orientationchange', updateScreenOrientation);
            if ('ondeviceorientationabsolute' in window) {
                (window as any).removeEventListener('deviceorientationabsolute', handleOrientation as EventListener, true);
            } else {
                (window as any).removeEventListener('deviceorientation', handleOrientation as EventListener, true);
            }
        };
    }, []);

    return { heading, error };
};
