import React from 'react';

// Turn direction icons as SVG
const TurnLeftIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 4v7a4 4 0 0 1-4 4H5" />
        <path d="M9 11L5 15L9 19" />
    </svg>
);

const TurnRightIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 4v7a4 4 0 0 0 4 4h6" />
        <path d="M15 11l4 4-4 4" />
    </svg>
);

const StraightIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
    </svg>
);

// Red Map Pin Icon
const PinIcon = () => (
    <svg viewBox="0 0 24 24" width="24" height="24">
        <path
            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
            fill="#ff3b30"
        />
    </svg>
);

interface NavigationCardProps {
    type: 'turn' | 'stop';
    title: string;
    distance: number;
    subtitle?: string;
    turnDirection?: 'left' | 'right' | 'straight';
    label?: string;
}

export const NavigationCard: React.FC<NavigationCardProps> = ({
    type,
    title,
    distance,
    turnDirection = 'straight',
    label = 'next stop'
}) => {
    const getTurnIcon = () => {
        switch (turnDirection) {
            case 'left': return <TurnLeftIcon />;
            case 'right': return <TurnRightIcon />;
            default: return <StraightIcon />;
        }
    };

    return (
        <div className="yellow-card">
            {/* Top icon */}
            <div className="yellow-card-icon">
                {type === 'turn' ? (
                    <div className="turn-icon-circle">
                        {getTurnIcon()}
                    </div>
                ) : (
                    <PinIcon />
                )}
            </div>

            {/* Main text */}
            <div className="yellow-card-text">
                <span className="yellow-card-title">{title}</span>
                <span className="yellow-card-distance">in {distance}m</span>
            </div>

            {/* Bottom label */}
            <div className="yellow-card-label">{label}</div>
        </div>
    );
};
