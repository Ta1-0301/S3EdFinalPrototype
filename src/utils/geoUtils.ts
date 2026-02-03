export interface Coordinate {
    lat: number;
    lon: number;
}

export interface Waypoint extends Coordinate {
    id: string;
    type: string;
    name?: string;
    audioFile?: string;
}

const R = 6371e3; // Earth radius in meters

export function toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

export function toDegrees(radians: number): number {
    return (radians * 180) / Math.PI;
}

export function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
    const φ1 = toRadians(coord1.lat);
    const φ2 = toRadians(coord2.lat);
    const Δφ = toRadians(coord2.lat - coord1.lat);
    const Δλ = toRadians(coord2.lon - coord1.lon);

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

export function calculateBearing(start: Coordinate, dest: Coordinate): number {
    const startLat = toRadians(start.lat);
    const startLon = toRadians(start.lon);
    const destLat = toRadians(dest.lat);
    const destLon = toRadians(dest.lon);

    const y = Math.sin(destLon - startLon) * Math.cos(destLat);
    const x =
        Math.cos(startLat) * Math.sin(destLat) -
        Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLon - startLon);
    const θ = Math.atan2(y, x);
    const bearing = (toDegrees(θ) + 360) % 360;
    return bearing;
}

export function findNearestWaypointIndex(
    currentPos: Coordinate,
    waypoints: Waypoint[]
): number {
    let minDistance = Infinity;
    let nearestIndex = 0;

    waypoints.forEach((wp, index) => {
        const dist = calculateDistance(currentPos, wp);
        if (dist < minDistance) {
            minDistance = dist;
            nearestIndex = index;
        }
    });

    return nearestIndex;
}
