import React from 'react';

// Turn direction icons — curved arrow style matching reference image
const TurnLeftIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* Curved arc from bottom-right up and to the left */}
        <path d="M18 16 C18 10, 12 6, 6 9" />
        {/* Arrowhead pointing left */}
        <polyline points="9,6 6,9 9,12" />
    </svg>
);

const TurnRightIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* Curved arc from bottom-left up and to the right */}
        <path d="M6 16 C6 10, 12 6, 18 9" />
        {/* Arrowhead pointing right */}
        <polyline points="15,6 18,9 15,12" />
    </svg>
);

const StraightIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="7,10 12,5 17,10" />
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
            {/* Main text — top */}
            <div className="yellow-card-text">
                <span className="yellow-card-title">{title}</span>
                <span className="yellow-card-distance">in {distance}m</span>
            </div>

            {/* Bottom label */}
            <div className="yellow-card-label">{label}</div>

            {/* Bottom icon */}
            <div className="yellow-card-icon">
                {type === 'turn' ? (
                    <div className="turn-icon-circle">
                        {getTurnIcon()}
                    </div>
                ) : (
                    <PinIcon />
                )}
            </div>
        </div>
    );
};
