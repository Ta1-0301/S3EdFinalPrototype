import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Group, Shape } from 'three';

interface ARViewProps {
    targetBearing: number; // The compass bearing we want to travel to (0-360)
    currentHeading: number; // The user's current device heading (0-360)
    pitch?: number; // Up/Down rotation for hills
}

const ArrowModel = ({ rotationY, pitch = 0 }: { rotationY: number, pitch?: number }) => {
    const groupRef = useRef<Group>(null!);

    // Bobbing animation state
    useFrame((state) => {
        if (groupRef.current) {
            // Smooth rotation with lerp
            groupRef.current.rotation.y += (rotationY - groupRef.current.rotation.y) * 0.1;
            groupRef.current.rotation.x = pitch;

            // Floating animation (Bobbing up and down)
            const t = state.clock.getElapsedTime();
            groupRef.current.position.y = Math.sin(t * 2) * 0.2; // Vertical movement
        }
    });

    // Create a custom arrow shape
    const arrowShape = useMemo(() => {
        const shape = new Shape();
        const width = 0.8;
        const headLength = 1.0;
        const shaftWidth = 0.4;
        const shaftLength = 1.2;

        // Draw 2D arrow pointing Up
        shape.moveTo(-shaftWidth / 2, 0);
        shape.lineTo(-shaftWidth / 2, shaftLength);
        shape.lineTo(-width, shaftLength);
        shape.lineTo(0, shaftLength + headLength); // Tip
        shape.lineTo(width, shaftLength);
        shape.lineTo(shaftWidth / 2, shaftLength);
        shape.lineTo(shaftWidth / 2, 0);
        shape.lineTo(-shaftWidth / 2, 0);

        return shape;
    }, []);

    const extrudeSettings = {
        steps: 1,
        depth: 0.3,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelSegments: 2,
    };

    return (
        <group ref={groupRef} position={[0, -0.5, -4]}>
            {/* Tilt the arrow more towards camera (-90 deg - 25 deg) so top face is visible */}
            <mesh rotation={[-Math.PI / 2 - 0.4, 0, 0]} position={[0, 0, 1]}>
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

export const ARView: React.FC<ARViewProps> = ({ targetBearing, currentHeading, pitch = 0 }) => {
    // Calculate relative rotation
    // If target is 90 (East) and we are facing 0 (North), arrow should point Right (+90)

    let relAngleDeg = targetBearing - currentHeading;

    // Normalize to -180 to +180 range to handle 360-degree wraparound
    while (relAngleDeg > 180) relAngleDeg -= 360;
    while (relAngleDeg < -180) relAngleDeg += 360;

    const relAngleRad = (relAngleDeg * Math.PI) / 180;

    // Three.js rotation: positive Y rotation = counter-clockwise when viewed from above
    // But our arrow shape points "up" in 2D (which becomes forward/-Z after rotation)
    // So positive relAngle (target is to the right) should rotate arrow right (negative Y rotation in Three.js)
    // Therefore we use negative relAngleRad

    return (
        <div className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none">
            <Canvas camera={{ position: [0, 0, 0], fov: 75 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} />
                {/* relAngleRad: positive = target is to the right, negative = target is to the left */}
                <ArrowModel rotationY={relAngleRad} pitch={pitch} />
            </Canvas>
        </div>
    );
};
