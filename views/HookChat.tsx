
import React, { useEffect, useState, useRef } from 'react';
import { UserProfile, NatalChartData } from '../types';
import { getNatalIntro } from '../services/astrologyService';
import { motion } from 'framer-motion';
import { getText } from '../constants';
import { MonoChatBubble } from '../components/mono-ui';

interface HookChatProps {
    profile: UserProfile;
    chartData: NatalChartData;
    onComplete: () => void;
}

interface MessageItem {
    type: 'text' | 'key' | 'cta';
    title?: string;
    text: string;
}

export const HookChat: React.FC<HookChatProps> = ({ profile, chartData, onComplete }) => {
    const [messages, setMessages] = useState<MessageItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const language = profile.language === 'en' ? 'en' : 'ru';

    useEffect(() => {
        const sequence = async () => {
            setIsLoading(true);

            try {
                let introText: string;

                try {
                    introText = await getNatalIntro(profile, chartData);
                } catch (error) {
                    console.error('[HookChat] Failed to get natal intro:', error);
                    introText = language === 'ru'
                        ? `Привет, ${profile.name}! Я уже собрала твою личную основу. Дальше покажу, что поможет тебе яснее видеть себя, отношения и важные решения.`
                        : `Hi, ${profile.name}! I've already gathered your personal foundation. Next I'll show what can help you see yourself, your relationships, and key decisions more clearly.`;
                }

                setIsLoading(false);

                const greetingText = getText(profile.language, 'hook.intro').replace('{name}', profile.name);
                setMessages([{ type: 'text', text: greetingText }]);
                await new Promise((r) => setTimeout(r, 1500));

                setMessages((prev) => [...prev, { type: 'text', text: introText || '' }]);
                await new Promise((r) => setTimeout(r, 3000));

                setMessages((prev) => [...prev, {
                    type: 'cta',
                    text: getText(profile.language, 'hook.done'),
                }]);
            } catch (e) {
                console.error(e);
                setIsLoading(false);
                onComplete();
            }
        };
        sequence();
    }, [chartData, language, onComplete, profile]);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (isLoading) {
        return (
            <div
                className="fresh-page lumia-main-scroll"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}
            >
                <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--fresh-muted)' }}>
                    {getText(profile.language, 'hook.analyzing')}
                </p>
            </div>
        );
    }

    return (
        <div className="fresh-page lumia-main-scroll" style={{ paddingBottom: 40 }}>
            <div style={{ margin: '0 auto', display: 'flex', width: '100%', maxWidth: '28rem', flexDirection: 'column', gap: 16, padding: '8px 16px' }}>
                {messages.map((msg, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                    >
                        {msg.type === 'text' ? (
                            <MonoChatBubble role="assistant">{msg.text}</MonoChatBubble>
                        ) : null}

                        {msg.type === 'cta' ? (
                            <div style={{ marginTop: 16, textAlign: 'center' }}>
                                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--fresh-muted)', marginBottom: 16 }}>{msg.text}</p>
                                <button type="button" className="fresh-btn-primary" style={{ width: '100%', margin: 0 }} onClick={onComplete}>
                                    {getText(profile.language, 'hook.cta_button')}
                                </button>
                            </div>
                        ) : null}
                    </motion.div>
                ))}
                <div ref={scrollRef} style={{ height: 16 }} />
            </div>
        </div>
    );
};
