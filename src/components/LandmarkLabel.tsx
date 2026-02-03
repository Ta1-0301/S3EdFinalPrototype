import React from 'react';

// Book/Library icon
const LibraryIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="12" y1="6" x2="12" y2="13" />
        <line x1="9" y1="9" x2="15" y2="9" />
    </svg>
);

// Generic building icon
const BuildingIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
        <path d="M9 22v-4h6v4" />
        <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
    </svg>
);

interface LandmarkLabelProps {
    name: string;
    type?: 'library' | 'building' | 'default';
    position: { x: number; y: number }; // percentage from top-left
    visible?: boolean;
}

export const LandmarkLabel: React.FC<LandmarkLabelProps> = ({
    name,
    type = 'default',
    position,
    visible = true
}) => {
    if (!visible) return null;

    const getIcon = () => {
        switch (type) {
            case 'library': return <LibraryIcon />;
            case 'building': return <BuildingIcon />;
            default: return <BuildingIcon />;
        }
    };

    return (
        <div
            className="landmark-label animate-fade-in"
            style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
                transform: 'translate(-50%, -100%)'
            }}
        >
            <div className="landmark-text">{name}</div>
            <div className="landmark-icon">{getIcon()}</div>
        </div>
    );
};

// Destination Pin Component
interface DestinationPinProps {
    position: { x: number; y: number };
    visible?: boolean;
}

export const DestinationPin: React.FC<DestinationPinProps> = ({
    position,
    visible = true
}) => {
    if (!visible) return null;

    return (
        <div
            className="destination-pin"
            style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
                transform: 'translate(-50%, -100%)'
            }}
        >
            {/* Pin marker SVG */}
            <svg className="pin-marker" viewBox="0 0 40 50" fill="none">
                <path
                    d="M20 0C9 0 0 9 0 20c0 15 20 30 20 30s20-15 20-30C40 9 31 0 20 0z"
                    fill="#ff6b6b"
                />
                <circle cx="20" cy="18" r="8" fill="white" opacity="0.9" />
            </svg>
            {/* Shadow ellipse */}
            <div className="pin-shadow" />
        </div>
    );
};
