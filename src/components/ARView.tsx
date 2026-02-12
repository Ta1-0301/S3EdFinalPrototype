import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import { Group, Shape } from 'three';
import { calculateDistance, calculateBearing, toRadians } from '../utils/geoUtils';
import type { Coordinate } from '../utils/geoUtils';

// ============ Types ============

interface LandmarkData {
    id: string;
    name: string;
    lat: number;
    lon: number;
    visibleRadius: number;
}

interface ARViewProps {
    targetBearing: number;
    currentHeading: number;
    pitch?: number;
    landmarks?: LandmarkData[];
    userLocation?: Coordinate;
}

// ============ AR Navigation Arrow ============

const ArrowModel = ({ rotationY, pitch = 0 }: { rotationY: number; pitch?: number }) => {
    const groupRef = useRef<Group>(null!);

    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y += (rotationY - groupRef.current.rotation.y) * 0.1;
            groupRef.current.rotation.x = pitch;
            const t = state.clock.getElapsedTime();
            groupRef.current.position.y = Math.sin(t * 2) * 0.2;
        }
    });

    const arrowShape = useMemo(() => {
        const shape = new Shape();
        const width = 1.2;
        const height = 1.8;
        const innerHeight = 0.6;
        shape.moveTo(-width, 0);
        shape.lineTo(0, height);
        shape.lineTo(width, 0);
        shape.lineTo(0, innerHeight);
        shape.lineTo(-width, 0);
        return shape;
    }, []);

    const extrudeSettings = {
        steps: 1,
        depth: 0.5,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelSegments: 2,
    };

    return (
        <group ref={groupRef} position={[0, -1.2, -5]}>
            <mesh rotation={[-Math.PI / 2 + 0.5, 0, 0]}>
                <extrudeGeometry args={[arrowShape, extrudeSettings]} />
                <meshStandardMaterial
                    color="#00ff88"
                    emissive="#004422"
                    emissiveIntensity={0.8}
                    roughness={0.2}
                    metalness={0.8}
                />
            </mesh>
        </group>
    );
};

// ============ 3D Landmark Pin ============

const LandmarkPin = ({
    position,
    name,
    distance,
}: {
    position: [number, number, number];
    name: string;
    distance: number;
}) => {
    const groupRef = useRef<Group>(null!);

    // Bobbing animation
    useFrame((state) => {
        if (groupRef.current) {
            const t = state.clock.getElapsedTime();
            groupRef.current.position.y = position[1] + Math.sin(t * 1.5) * 0.15;
        }
    });

    // Scale based on distance: closer = bigger, farther = smaller
    // Clamp between 0.4 and 1.2
    const scale = Math.max(0.4, Math.min(1.2, 30 / Math.max(distance, 10)));

    return (
        <group ref={groupRef} position={position}>
            <group scale={[scale, scale, scale]}>
                {/* Pin body — always faces camera */}
                <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
                    {/* Red pin drop shape */}
                    <mesh position={[0, 0.8, 0]}>
                        <sphereGeometry args={[0.4, 16, 16]} />
                        <meshStandardMaterial
                            color="#ff3b30"
                            emissive="#991100"
                            emissiveIntensity={0.5}
                            roughness={0.3}
                            metalness={0.4}
                        />
                    </mesh>

                    {/* White inner circle */}
                    <mesh position={[0, 0.8, 0.35]}>
                        <circleGeometry args={[0.15, 16]} />
                        <meshBasicMaterial color="white" />
                    </mesh>

                    {/* Pin needle (cone) */}
                    <mesh position={[0, 0.1, 0]} rotation={[Math.PI, 0, 0]}>
                        <coneGeometry args={[0.12, 0.6, 8]} />
                        <meshStandardMaterial
                            color="#ff3b30"
                            emissive="#991100"
                            emissiveIntensity={0.3}
                        />
                    </mesh>

                    {/* Label background + text */}
                    <mesh position={[0, 1.7, 0]}>
                        <planeGeometry args={[name.length * 0.22 + 0.6, 0.5]} />
                        <meshBasicMaterial color="black" opacity={0.75} transparent />
                    </mesh>
                    <Text
                        position={[0, 1.7, 0.01]}
                        fontSize={0.25}
                        color="white"
                        anchorX="center"
                        anchorY="middle"
                        font={undefined}
                    >
                        {name}
                    </Text>

                    {/* Distance label */}
                    <Text
                        position={[0, 1.35, 0.01]}
                        fontSize={0.16}
                        color="#aaaaaa"
                        anchorX="center"
                        anchorY="middle"
                        font={undefined}
                    >
                        {distance}m
                    </Text>
                </Billboard>

                {/* Ground shadow circle */}
                <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[0.3, 16]} />
                    <meshBasicMaterial color="#8b5cf6" opacity={0.4} transparent />
                </mesh>
            </group>
        </group>
    );
};

// ============ Scene Content ============

const SceneContent = ({
    arrowRotationY,
    pitch,
    landmarks,
    userLocation,
    currentHeading,
}: {
    arrowRotationY: number;
    pitch: number;
    landmarks: LandmarkData[];
    userLocation: Coordinate;
    currentHeading: number;
}) => {
    // Convert GPS landmarks to Three.js positions
    const visibleLandmarks = useMemo(() => {
        if (!userLocation || userLocation.lat === 0) return [];

        return landmarks
            .map((lm) => {
                const dist = calculateDistance(userLocation, { lat: lm.lat, lon: lm.lon });

                // Only show if within visible radius
                if (dist > lm.visibleRadius) return null;

                // Calculate bearing from user to landmark
                const bearing = calculateBearing(userLocation, { lat: lm.lat, lon: lm.lon });

                // Relative angle: bearing relative to user's heading
                const relAngle = toRadians(bearing - currentHeading);

                // Scale distance for Three.js space
                // Map real-world meters to Three.js units
                // Use logarithmic scaling so far landmarks don't go too deep
                const d3d = Math.min(dist * 0.15, 20);

                // Convert polar (distance, angle) to Cartesian (x, z)
                const x = d3d * Math.sin(relAngle);
                const z = -d3d * Math.cos(relAngle);
                const y = 0; // Eye level

                return {
                    ...lm,
                    position: [x, y, z] as [number, number, number],
                    distance: Math.round(dist),
                };
            })
            .filter(Boolean) as (LandmarkData & {
                position: [number, number, number];
                distance: number;
            })[];
    }, [landmarks, userLocation, currentHeading]);

    return (
        <>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />

            {/* Navigation Arrow */}
            <ArrowModel rotationY={arrowRotationY} pitch={pitch} />

            {/* Landmark Pins */}
            {visibleLandmarks.map((lm) => (
                <LandmarkPin
                    key={lm.id}
                    position={lm.position}
                    name={lm.name}
                    distance={lm.distance}
                />
            ))}
        </>
    );
};

// ============ Main Component ============

export const ARView: React.FC<ARViewProps> = ({
    targetBearing,
    currentHeading,
    pitch = 0,
    landmarks = [],
    userLocation = { lat: 0, lon: 0 },
}) => {
    let relAngleDeg = targetBearing - currentHeading;
    while (relAngleDeg > 180) relAngleDeg -= 360;
    while (relAngleDeg < -180) relAngleDeg += 360;
    const relAngleRad = (relAngleDeg * Math.PI) / 180;

    return (
        <div className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none">
            <Canvas camera={{ position: [0, 0, 0], fov: 75 }}>
                <SceneContent
                    arrowRotationY={-relAngleRad}
                    pitch={pitch}
                    landmarks={landmarks}
                    userLocation={userLocation}
                    currentHeading={currentHeading}
                />
            </Canvas>
        </div>
    );
};
