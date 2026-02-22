import { useState, useEffect, useRef, useCallback } from 'react';
import type { Coordinate } from '../utils/geoUtils';
import { KalmanFilter2D, type KalmanState } from '../utils/KalmanFilter';

/**
 * Sensor Fusion Hook
 * 
 * Kotlin版 SensorFusion + KalmanFilter の Web移植
 * 
 * データフロー:
 *   GPS → useGeolocation → KalmanFilter.update()
 *   Sensor → useOrientation → heading (EMA smoothed)
 *   Timer → KalmanFilter.predict() → smoothedLocation
 * 
 * Result: 滑らかな位置 + 方位を出力
 */

/**
 * Low Pass Filter alpha for heading smoothing.
 * Range: 0.05 (very smooth/slow) to 0.2 (responsive/noisy)
 * 0.1 = balanced — matches Kotlin SensorFusion spec
 */
const HEADING_LPF_ALPHA = 0.1;

// Predict interval (ms) - between GPS updates, predict position from velocity
const PREDICT_INTERVAL_MS = 50; // 20fps prediction

export interface SensorFusionState {
    /** カルマンフィルタで平滑化された位置 */
    smoothedLocation: Coordinate;
    /** 生のGPS位置 */
    rawLocation: Coordinate;
    /** コンパス方位（度、北=0、時計回り） */
    heading: number;
    /** ピッチ角（度、端末の傾き） */
    pitch: number;
    /** GPS精度（メートル） */
    accuracy: number;
    /** 速度（m/s） */
    speed: number;
    /** GPSが初期化されたか */
    loaded: boolean;
    /** エラー情報 */
    error?: { code: number; message: string };
    /** 方位キャリブレーション: 道路方位を渡すとオフセットを計算して適用 */
    calibrateHeading: (roadBearing: number) => void;
}

export const useSensorFusion = () => {
    // ----- GPS State -----
    const [geoState, setGeoState] = useState<{
        loaded: boolean;
        coordinates: Coordinate;
        error?: { code: number; message: string };
    }>({
        loaded: false,
        coordinates: { lat: 0, lon: 0 },
    });

    // ----- Orientation State -----
    const [heading, setHeading] = useState<number>(0);
    const [pitch, setPitch] = useState<number>(0);
    const headingRef = useRef<number>(0);
    const headingOffsetRef = useRef<number>(0);

    // ----- Kalman Filter -----
    const kalmanRef = useRef<KalmanFilter2D>(new KalmanFilter2D(1e-8));
    const [smoothed, setSmoothed] = useState<Coordinate>({ lat: 0, lon: 0 });
    const predictTimerRef = useRef<number | null>(null);

    // ----- GPS Watcher -----
    useEffect(() => {
        if (!('geolocation' in navigator)) {
            setGeoState(s => ({
                ...s,
                loaded: true,
                error: { code: 0, message: 'Geolocation not supported' },
            }));
            return;
        }

        const onSuccess = (position: GeolocationPosition) => {
            const coords = position.coords;
            const newCoord: Coordinate = {
                lat: coords.latitude,
                lon: coords.longitude,
                altitude: coords.altitude ?? undefined,
                accuracy: coords.accuracy ?? undefined,
                speed: coords.speed ?? undefined,
                headingGPS: coords.heading ?? undefined,
                timestamp: position.timestamp,
            };

            setGeoState({
                loaded: true,
                coordinates: newCoord,
            });

            // Kalman Filter update with GPS observation
            const kf = kalmanRef.current;
            if (!kf.isInitialized()) {
                kf.init(coords.latitude, coords.longitude, position.timestamp);
            } else {
                kf.predict(position.timestamp);
                kf.update(coords.latitude, coords.longitude, coords.accuracy ?? 10);
            }

            const state = kf.getState();
            setSmoothed({
                lat: state.lat,
                lon: state.lon,
                accuracy: coords.accuracy ?? undefined,
                speed: coords.speed ?? undefined,
                timestamp: position.timestamp,
            });
        };

        const onError = (error: GeolocationPositionError) => {
            setGeoState(s => ({
                ...s,
                loaded: true,
                error: { code: error.code, message: error.message },
            }));
        };

        const options: PositionOptions = {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000,
        };

        const watcher = navigator.geolocation.watchPosition(onSuccess, onError, options);

        return () => navigator.geolocation.clearWatch(watcher);
    }, []);

    // ----- Predict Timer (between GPS updates) -----
    useEffect(() => {
        const kf = kalmanRef.current;

        predictTimerRef.current = window.setInterval(() => {
            if (!kf.isInitialized()) return;

            kf.predict(Date.now());
            const state: KalmanState = kf.getState();
            setSmoothed(prev => ({
                ...prev,
                lat: state.lat,
                lon: state.lon,
            }));
        }, PREDICT_INTERVAL_MS);

        return () => {
            if (predictTimerRef.current !== null) {
                clearInterval(predictTimerRef.current);
            }
        };
    }, []);

    // ----- Orientation / Heading -----
    useEffect(() => {
        const handleOrientation = (event: DeviceOrientationEvent) => {
            let compassHeading: number | null = null;
            let devicePitch: number | null = null;

            // iOS WebKit
            if (typeof (event as any).webkitCompassHeading === 'number') {
                compassHeading = (event as any).webkitCompassHeading;
            }
            // Android / Standards (Absolute)
            else if (event.alpha !== null) {
                compassHeading = (360 - event.alpha) % 360;
            }

            // Pitch (beta): -180 to 180, 0 = flat, 90 = vertical
            if (event.beta !== null) {
                devicePitch = event.beta;
            }

            if (compassHeading !== null) {
                // Screen orientation correction
                let screenAngle = 0;
                if (screen.orientation && screen.orientation.angle !== undefined) {
                    screenAngle = screen.orientation.angle;
                } else if (typeof window.orientation === 'number') {
                    screenAngle = window.orientation as number;
                }

                let correctedHeading = compassHeading;
                if (screenAngle !== 0) {
                    correctedHeading = (compassHeading + screenAngle) % 360;
                }

                // Low Pass Filter with delta correction (spec: Kotlin SensorFusion)
                // Handles 359° → 1° wraparound correctly
                const prev = headingRef.current;
                if (prev === 0 && correctedHeading !== 0) {
                    // First reading: initialize directly
                    headingRef.current = correctedHeading;
                } else {
                    let delta = correctedHeading - prev;
                    // Normalize delta to [-180, 180] to avoid jump artifacts
                    if (delta > 180) delta -= 360;
                    if (delta < -180) delta += 360;
                    headingRef.current = (prev + HEADING_LPF_ALPHA * delta + 360) % 360;
                }

                // Apply calibration offset
                const calibrated = (headingRef.current + headingOffsetRef.current + 360) % 360;

                // Deadzone: skip update if heading change < 2° (suppress compass micro-jitter)
                setHeading(prev => {
                    let diff = calibrated - prev;
                    if (diff > 180) diff -= 360;
                    if (diff < -180) diff += 360;
                    return Math.abs(diff) < 2.0 ? prev : calibrated;
                });
            }

            if (devicePitch !== null) {
                setPitch(devicePitch);
            }
        };

        // iOS Permission
        const requestPermission = async () => {
            if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
                try {
                    const permission = await (DeviceOrientationEvent as any).requestPermission();
                    if (permission !== 'granted') return false;
                } catch {
                    return false;
                }
            }
            return true;
        };

        const init = async () => {
            const allowed = await requestPermission();
            if (allowed) {
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

    // ----- Calibrate heading to road direction -----
    const calibrateHeading = useCallback((roadBearing: number) => {
        // offset = roadBearing - rawSensorHeading
        const rawHeading = headingRef.current;
        let offset = roadBearing - rawHeading;
        // Normalize to [-180, 180]
        while (offset > 180) offset -= 360;
        while (offset < -180) offset += 360;
        headingOffsetRef.current = offset;
        // Immediately apply
        const calibrated = (rawHeading + offset + 360) % 360;
        setHeading(calibrated);
    }, []);

    // ----- Combined output -----
    const result: SensorFusionState = {
        smoothedLocation: smoothed,
        rawLocation: geoState.coordinates,
        heading,
        pitch,
        accuracy: geoState.coordinates.accuracy ?? 0,
        speed: geoState.coordinates.speed ?? 0,
        loaded: geoState.loaded,
        error: geoState.error,
        calibrateHeading,
    };

    return result;
};
