
import React, { useEffect, useState, useRef } from 'react';
import { UserProfile, NatalChartData } from '../types';
import { getThreeKeys } from '../services/astrologyService';
import { saveProfile } from '../services/storageService';
import { motion } from 'framer-motion';
import { Loading } from '../components/ui/Loading';
import { getText } from '../constants';

interface HookChatProps {
    profile: UserProfile;
    chartData: NatalChartData;
    onComplete: () => void;
    onUpdateProfile: (profile: UserProfile) => void;
}

interface MessageItem {
    type: 'text' | 'key' | 'cta';
    title?: string;
    text: string;
}

export const HookChat: React.FC<HookChatProps> = ({ profile, chartData, onComplete, onUpdateProfile }) => {
    const [messages, setMessages] = useState<MessageItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const sequence = async () => {
            setIsLoading(true);
            
            try {
                const keys = await getThreeKeys(profile, chartData);
                
                // Save keys immediately
                console.log('[HookChat] Saving three keys to profile...');
                const updatedProfile = { ...profile, threeKeys: keys };
                try {
                    await saveProfile(updatedProfile);
                    console.log('[HookChat] Three keys saved successfully');
                } catch (error) {
                    console.error('[HookChat] Failed to save three keys:', error);
                }
                onUpdateProfile(updatedProfile);
                
                setIsLoading(false);
                
                // Animation Sequence - FAST & PERSISTENT
                
                // 1. Intro
                const introText = getText(profile.language, 'hook.intro').replace('{name}', profile.name);
                setMessages([{ type: 'text', text: introText }]);
                await new Promise(r => setTimeout(r, 1500));
                
                // 2. Key 1
                setMessages(prev => [...prev, { 
                    type: 'key',
                    title: getText(profile.language, 'hook.key1_title'),
                    text: keys.key1.text 
                }]);
                await new Promise(r => setTimeout(r, 2500));
                
                // 3. Key 2
                setMessages(prev => [...prev, { 
                    type: 'key',
                    title: getText(profile.language, 'hook.key2_title'),
                    text: keys.key2.text 
                }]);
                await new Promise(r => setTimeout(r, 2500));

                // 4. Key 3
                setMessages(prev => [...prev, { 
                    type: 'key',
                    title: getText(profile.language, 'hook.key3_title'),
                    text: keys.key3.text 
                }]);
                await new Promise(r => setTimeout(r, 2500));

                // 5. CTA (Final)
                setMessages(prev => [...prev, { 
                    type: 'cta',
                    text: getText(profile.language, 'hook.done')
                }]);

            } catch (e) {
                console.error(e);
                setIsLoading(false);
                onComplete(); // Fallback to Paywall
            }
        };
        sequence();
    }, []);

    useEffect(() => {
        // Auto scroll to bottom
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    if (isLoading) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-astro-bg z-50">
                <Loading message={getText(profile.language, 'hook.analyzing')} />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-astro-bg p-4 pt-8 pb-24 overflow-y-auto scrollbar-hide">
            <div className="flex-1 space-y-8">
                {messages.map((msg, idx) => (
                    <motion.div 
                        key={idx}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="flex flex-col items-center text-center w-full"
                    >
                         <div className="w-full max-w-2xl mx-auto px-4">
                            {msg.type === 'key' && (
                                <h4 className="text-astro-highlight text-xs md:text-sm font-bold uppercase tracking-[0.3em] mb-5 animate-pulse">
                                    {msg.title}
                                </h4>
                            )}
                            
                            <p className={`text-astro-text font-serif font-light drop-shadow-sm whitespace-pre-wrap ${
                                msg.type === 'text' ? "italic text-astro-highlight opacity-90 text-base md:text-lg leading-relaxed" : 
                                msg.type === 'cta' ? "text-sm md:text-base text-astro-subtext mt-5 leading-relaxed" : "text-lg md:text-xl leading-relaxed"
                            }`}
                            style={{
                                lineHeight: msg.type === 'key' ? '1.7' : '1.6',
                                maxWidth: '65ch'
                            }}>
                                {msg.text}
                            </p>

                            {msg.type === 'cta' && (
                                <motion.button
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 1, duration: 0.5 }}
                                    onClick={onComplete}
                                    className="mt-10 w-full max-w-md mx-auto bg-astro-text text-astro-bg py-4 md:py-5 rounded-xl font-bold uppercase tracking-widest text-sm shadow-glow hover:scale-105 transition-transform"
                                >
                                    {getText(profile.language, 'hook.cta_button')}
                                </motion.button>
                            )}
                        </div>
                    </motion.div>
                ))}
                
                <div ref={scrollRef} className="h-10" />
            </div>
        </div>
    );
};
