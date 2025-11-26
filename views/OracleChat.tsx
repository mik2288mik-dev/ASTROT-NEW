import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, ChatMessage } from '../types';
import { chatWithAstra } from '../services/astrologyService';
import { motion } from 'framer-motion';

interface OracleChatProps {
    profile: UserProfile;
}

export const OracleChat: React.FC<OracleChatProps> = ({ profile }) => {
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'init',
            role: 'model',
            text: `Hello ${profile.name}. I am Astra. Ask me anything about your chart, your feelings, or the stars.`,
            timestamp: Date.now()
        }
    ]);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: input,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const history = messages.map(m => ({ role: m.role, text: m.text }));
            const responseText = await chatWithAstra(history, userMsg.text, profile);

            const botMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: responseText,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, botMsg]);
        } catch (err) {
            console.error(err);
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: "The cosmic connection is weak right now. Please try again.",
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-astro-bg">
            {/* Chat Header */}
            <div className="p-4 border-b border-astro-border bg-astro-bg/95 backdrop-blur z-10 text-center shrink-0">
                <h2 className="text-sm font-bold uppercase tracking-widest text-astro-text font-serif">Oracle Astra</h2>
            </div>

            {/* Messages Area - Scrolls Independently */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                {messages.map((msg) => (
                    <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div 
                            className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${
                                msg.role === 'user' 
                                ? 'bg-astro-text text-astro-bg rounded-br-sm font-medium' 
                                : 'bg-astro-card text-astro-text border border-astro-border rounded-bl-sm font-light'
                            }`}
                        >
                            {msg.text}
                        </div>
                    </motion.div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                         <div className="bg-astro-card px-4 py-3 rounded-2xl rounded-bl-sm border border-astro-border flex space-x-2">
                            <div className="w-1.5 h-1.5 bg-astro-subtext rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 bg-astro-subtext rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 bg-astro-subtext rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Input Area - Anchored at Bottom (above nav) */}
            <div className="p-4 bg-astro-card border-t border-astro-border shrink-0 pb-24">
                <div className="flex items-center gap-2 bg-astro-bg rounded-full px-4 py-3 border border-astro-border focus-within:border-astro-highlight transition-colors shadow-sm">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={profile.language === 'ru' ? "Спроси звезды..." : "Ask the stars..."}
                        className="flex-1 bg-transparent text-astro-text outline-none placeholder-astro-subtext text-sm"
                        disabled={loading}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={loading || !input.trim()}
                        className="p-2 bg-astro-highlight rounded-full text-white disabled:opacity-50 hover:scale-105 transition-transform"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};