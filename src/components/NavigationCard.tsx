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

const BusStopIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
);

interface NavigationCardProps {
    type: 'turn' | 'stop';
    title: string;
    distance: number;
    subtitle?: string;
    turnDirection?: 'left' | 'right' | 'straight';
}

export const NavigationCard: React.FC<NavigationCardProps> = ({
    type,
    title,
    distance,
    subtitle,
    turnDirection = 'straight'
}) => {
    const getTurnIcon = () => {
        switch (turnDirection) {
            case 'left': return <TurnLeftIcon />;
            case 'right': return <TurnRightIcon />;
            default: return <StraightIcon />;
        }
    };

    return (
        <div className="nav-card animate-slide-top">
            <div className={`nav-card-icon ${type}`}>
                {type === 'turn' ? getTurnIcon() : <BusStopIcon />}
            </div>
            <div className="nav-card-content">
                <div className="nav-card-title">
                    {title} in {distance}m
                </div>
                {subtitle && (
                    <div className="nav-card-subtitle">
                        {subtitle}
                    </div>
                )}
            </div>
        </div>
    );
};
