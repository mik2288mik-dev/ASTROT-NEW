
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '../types';
import { getText } from '../constants';

interface SolarSystemProps {
    language: Language;
}

export const SolarSystem: React.FC<SolarSystemProps> = ({ language }) => {
    const [selectedPlanet, setSelectedPlanet] = useState<string | null>(null);

    // Significantly increased sizes for "wow" effect and better tap targets
    const planets = [
        { id: 'sun', color: '#FDB813', size: 50, orbit: 0, speed: 0, label: 'Sun' },
        { id: 'mercury', color: '#A0A0A0', size: 14, orbit: 45, speed: 40, label: 'Mercury' },
        { id: 'venus', color: '#E6BE8A', size: 20, orbit: 65, speed: 70, label: 'Venus' },
        { id: 'earth', color: '#4F83CC', size: 22, orbit: 85, speed: 100, label: 'Earth' },
        { id: 'mars', color: '#E56B6F', size: 18, orbit: 105, speed: 150, label: 'Mars' },
        { id: 'jupiter', color: '#D4A373', size: 36, orbit: 135, speed: 250, label: 'Jupiter' },
        { id: 'saturn', color: '#F4D35E', size: 30, orbit: 165, speed: 400, label: 'Saturn' }
    ];

    const handlePlanetClick = (id: string) => {
        setSelectedPlanet(id);
    };

    return (
        <div className="relative w-full h-[360px] bg-astro-bg rounded-2xl overflow-hidden flex items-center justify-center mb-6 border border-astro-border shadow-sm">
            {/* Title Overlay - Centered & Styled */}
            <div className="absolute top-6 left-0 right-0 z-10 pointer-events-none flex justify-center">
                <h3 className="text-astro-text font-serif text-[10px] uppercase tracking-[0.3em] opacity-60 border-b border-transparent">
                    {getText(language, 'dashboard.solar_system_title')}
                </h3>
            </div>

            {/* Sun */}
            <motion.div 
                className="absolute rounded-full shadow-[0_0_60px_rgba(253,184,19,0.2)] cursor-pointer z-20 bg-gradient-to-br from-yellow-300 to-orange-500"
                style={{ width: 50, height: 50 }}
                animate={{ scale: [1, 1.05, 1], boxShadow: ["0 0 40px rgba(253,184,19,0.2)", "0 0 70px rgba(253,184,19,0.4)", "0 0 40px rgba(253,184,19,0.2)"] }}
                transition={{ duration: 4, repeat: Infinity }}
                onClick={() => handlePlanetClick('sun')}
            />

            {/* Orbits & Planets */}
            {planets.filter(p => p.id !== 'sun').map((planet) => (
                <div 
                    key={planet.id}
                    className="absolute rounded-full border border-astro-orbit flex items-center justify-center pointer-events-none"
                    style={{ width: planet.orbit * 2, height: planet.orbit * 2 }}
                >
                     <motion.div 
                        className="w-full h-full relative pointer-events-auto"
                        animate={{ rotate: 360 }}
                        transition={{ duration: planet.speed, repeat: Infinity, ease: "linear" }}
                     >
                        <motion.div 
                            className="absolute top-1/2 -translate-y-1/2 rounded-full cursor-pointer z-30 shadow-lg border-2 border-white/20 hover:border-white hover:shadow-2xl transition-all"
                            style={{ 
                                width: planet.size, 
                                height: planet.size, 
                                backgroundColor: planet.color,
                                right: -planet.size / 2,
                                boxShadow: `0 0 ${planet.size / 2}px ${planet.color}40`
                            }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 1.2 }}
                            onClick={(e) => { e.stopPropagation(); handlePlanetClick(planet.id); }}
                        />
                     </motion.div>
                </div>
            ))}

            {/* Info Modal */}
            <AnimatePresence>
                {selectedPlanet && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="absolute bottom-6 inset-x-6 bg-astro-card/98 backdrop-blur-xl p-6 md:p-7 rounded-2xl border-2 border-astro-border z-40 shadow-2xl"
                    >
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                                <p className="card-text text-base md:text-[17px] text-astro-text font-serif leading-relaxed tracking-wide font-medium" style={{ lineHeight: '1.65', maxWidth: '60ch' }}>
                                    {getText(language, `planets.${selectedPlanet}`)}
                                </p>
                            </div>
                            <button 
                                onClick={() => setSelectedPlanet(null)}
                                className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-astro-subtext hover:text-astro-text hover:bg-astro-bg/50 rounded-full transition-all"
                            >
                                ✕
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
