
import React from 'react';
import { ViewState, Language } from '../types';
import { getText } from '../constants';

interface NavigationProps {
    currentView: ViewState;
    setView: (view: ViewState) => void;
    language: Language;
    isPremium: boolean;
}

const NavItem: React.FC<{ 
    active: boolean; 
    onClick: () => void; 
    icon: React.ReactNode; 
    label: string;
    locked?: boolean;
}> = ({ active, onClick, icon, label, locked }) => (
    <button 
        onClick={onClick}
        className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200 ${
            active ? 'text-astro-highlight' : 'text-astro-subtext'
        }`}
    >
        <div className={`transform transition-transform relative ${active ? 'scale-110' : ''}`}>
            {icon}
            {locked && (
                <div className="absolute -top-1 -right-2 text-[8px]">🔒</div>
            )}
        </div>
        <span className="text-[9px] font-medium tracking-wider uppercase">{label}</span>
    </button>
);

export const Navigation: React.FC<NavigationProps> = ({ currentView, setView, language, isPremium }) => {
    return (
        <div className="fixed bottom-0 left-0 right-0 bg-astro-card/95 backdrop-blur-xl border-t border-white/5 h-[80px] pb-4 z-50">
            <div className="flex justify-around items-center h-full max-w-md mx-auto px-2">
                {/* 1. Dashboard (Main) */}
                <NavItem 
                    active={currentView === 'dashboard'} 
                    onClick={() => setView('dashboard')} 
                    label={getText(language, 'nav.today')}
                    locked={!isPremium}
                    icon={
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    }
                />

                {/* 2. Natal Chart */}
                <NavItem 
                    active={currentView === 'chart'} 
                    onClick={() => setView('chart')} 
                    label={getText(language, 'nav.chart')}
                    icon={
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    }
                />

                {/* 3. Oracle */}
                <NavItem 
                    active={currentView === 'oracle'} 
                    onClick={() => setView('oracle')} 
                    label={getText(language, 'nav.oracle')}
                    locked={!isPremium}
                    icon={
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                    }
                />

                {/* 4. Settings */}
                 <NavItem 
                    active={currentView === 'settings'} 
                    onClick={() => setView('settings')} 
                    label={getText(language, 'nav.settings')}
                    icon={
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    }
                />
            </div>
        </div>
    );
};
