
import React, { useEffect, useState, useRef } from 'react';
import { UserProfile, NatalChartData } from '../types';
import { getNatalIntro } from '../services/astrologyService';
import { motion } from 'framer-motion';
import { getText } from '../constants';
import { MonoButton, MonoChatBubble, MonoPage } from '../components/mono-ui';

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
            <MonoPage className="flex min-h-full items-center justify-center px-4" animate={false}>
                <p className="text-[15px] font-medium text-mono-muted">
                    {getText(profile.language, 'hook.analyzing')}
                </p>
            </MonoPage>
        );
    }

    return (
        <MonoPage className="px-4 pb-10 pt-6" animate={false}>
            <div className="mx-auto flex w-full max-w-md flex-col gap-4">
                {messages.map((msg, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                        className="flex w-full flex-col gap-3"
                    >
                        {msg.type === 'text' ? (
                            <MonoChatBubble role="assistant">{msg.text}</MonoChatBubble>
                        ) : null}

                        {msg.type === 'cta' ? (
                            <div className="mt-4 space-y-4 text-center">
                                <p className="text-[14px] leading-relaxed text-mono-muted">{msg.text}</p>
                                <MonoButton fullWidth onClick={onComplete}>
                                    {getText(profile.language, 'hook.cta_button')}
                                </MonoButton>
                            </div>
                        ) : null}
                    </motion.div>
                ))}
                <div ref={scrollRef} className="h-4" />
            </div>
        </MonoPage>
    );
};
