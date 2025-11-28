
import React, { useState } from 'react';
import { UserProfile, SynastryResult } from '../types';
import { calculateBriefSynastry, calculateFullSynastry } from '../services/astrologyService';
import { getText } from '../constants';
import { motion } from 'framer-motion';
import { Loading } from '../components/ui/Loading';

interface SynastryProps {
    profile: UserProfile;
    requestPremium: () => void;
}

export const Synastry: React.FC<SynastryProps> = ({ profile, requestPremium }) => {
    const [partnerName, setPartnerName] = useState("");
    const [partnerDate, setPartnerDate] = useState("");
    const [partnerTime, setPartnerTime] = useState("");
    const [partnerPlace, setPartnerPlace] = useState("");
    const [relationshipType, setRelationshipType] = useState("романтика");
    const [result, setResult] = useState<SynastryResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [analysisMode, setAnalysisMode] = useState<'brief' | 'full'>('brief');

    const handleCalculate = async (mode: 'brief' | 'full') => {
        if (!partnerName || !partnerDate) return;
        
        // Проверяем премиум статус для полного анализа
        if (mode === 'full' && !profile.isPremium) {
            requestPremium();
            return;
        }

        setLoading(true);
        setAnalysisMode(mode);
        
        try {
            let data: SynastryResult;
            
            if (mode === 'brief') {
                // Краткий анализ (бесплатный)
                data = await calculateBriefSynastry(
                    profile, 
                    partnerName, 
                    partnerDate,
                    partnerTime || undefined,
                    partnerPlace || undefined,
                    relationshipType
                );
            } else {
                // Полный анализ (премиум)
                data = await calculateFullSynastry(
                    profile, 
                    partnerName, 
                    partnerDate,
                    partnerTime || undefined,
                    partnerPlace || undefined,
                    relationshipType
                );
            }
            
            setResult(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        const loadingMessage = profile.language === 'ru' 
            ? 'Считываем звездную совместимость...' 
            : 'Reading star compatibility...';
        return <Loading message={loadingMessage} />;
    }

    return (
        <div className="p-6 pb-24 space-y-8">
            <h2 className="text-3xl font-serif font-bold text-astro-text text-center">
                {getText(profile.language, 'synastry.title')}
            </h2>

            {!result ? (
                <div className="space-y-6">
                    {/* Форма ввода данных */}
                    <div className="bg-astro-card border border-astro-border p-6 rounded-xl shadow-soft">
                        <h3 className="text-[10px] uppercase tracking-widest text-astro-subtext mb-6 font-bold">
                            {getText(profile.language, 'synastry.input_title')}
                        </h3>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs text-astro-text mb-2 font-serif">
                                    {getText(profile.language, 'synastry.partner_name')}
                                </label>
                                <input 
                                    type="text" 
                                    value={partnerName}
                                    onChange={(e) => setPartnerName(e.target.value)}
                                    placeholder={profile.language === 'ru' ? 'Введите имя' : 'Enter name'}
                                    className="w-full bg-astro-bg border-b border-astro-border p-3 outline-none focus:border-astro-highlight transition-colors text-astro-text"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-astro-text mb-2 font-serif">
                                    {profile.language === 'ru' ? 'Дата рождения *' : 'Birth Date *'}
                                </label>
                                <input 
                                    type="date" 
                                    value={partnerDate}
                                    onChange={(e) => setPartnerDate(e.target.value)}
                                    className="w-full bg-astro-bg border-b border-astro-border p-3 outline-none focus:border-astro-highlight transition-colors text-astro-text"
                                />
                            </div>
                            
                            {/* Дополнительные поля (опционально) */}
                            <div className="pt-4 border-t border-astro-border/30">
                                <p className="text-[9px] uppercase tracking-wider text-astro-subtext mb-4">
                                    {profile.language === 'ru' ? 'Дополнительно (для более точного анализа)' : 'Optional (for more accurate analysis)'}
                                </p>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-astro-text mb-2 font-serif">
                                            {profile.language === 'ru' ? 'Время рождения' : 'Birth Time'}
                                        </label>
                                        <input 
                                            type="time" 
                                            value={partnerTime}
                                            onChange={(e) => setPartnerTime(e.target.value)}
                                            className="w-full bg-astro-bg border-b border-astro-border p-3 outline-none focus:border-astro-highlight transition-colors text-astro-text"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-astro-text mb-2 font-serif">
                                            {profile.language === 'ru' ? 'Место рождения' : 'Birth Place'}
                                        </label>
                                        <input 
                                            type="text" 
                                            value={partnerPlace}
                                            onChange={(e) => setPartnerPlace(e.target.value)}
                                            placeholder={profile.language === 'ru' ? 'Город, страна' : 'City, country'}
                                            className="w-full bg-astro-bg border-b border-astro-border p-3 outline-none focus:border-astro-highlight transition-colors text-astro-text"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-astro-text mb-2 font-serif">
                                            {profile.language === 'ru' ? 'Тип отношений' : 'Relationship Type'}
                                        </label>
                                        <select 
                                            value={relationshipType}
                                            onChange={(e) => setRelationshipType(e.target.value)}
                                            className="w-full bg-astro-bg border-b border-astro-border p-3 outline-none focus:border-astro-highlight transition-colors text-astro-text"
                                        >
                                            <option value="романтика">{profile.language === 'ru' ? 'Романтические отношения' : 'Romantic'}</option>
                                            <option value="дружба">{profile.language === 'ru' ? 'Дружба' : 'Friendship'}</option>
                                            <option value="работа">{profile.language === 'ru' ? 'Деловое партнёрство' : 'Business'}</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Кнопки расчета */}
                    <div className="space-y-3">
                        {/* Краткий анализ (бесплатный) */}
                        <button 
                            onClick={() => handleCalculate('brief')}
                            disabled={!partnerName || !partnerDate}
                            className="w-full bg-astro-card border-2 border-astro-highlight text-astro-text py-4 rounded-lg font-bold uppercase tracking-widest text-[10px] shadow-lg disabled:opacity-50 disabled:border-astro-border hover:bg-astro-highlight hover:text-white transition-colors"
                        >
                            {profile.language === 'ru' ? '✨ Краткий обзор (Бесплатно)' : '✨ Brief Overview (Free)'}
                        </button>

                        {/* Полный анализ (премиум) */}
                        <button 
                            onClick={() => handleCalculate('full')}
                            disabled={!partnerName || !partnerDate}
                            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-lg font-bold uppercase tracking-widest text-[10px] shadow-lg disabled:opacity-50 hover:from-purple-600 hover:to-pink-600 transition-all relative overflow-hidden group"
                        >
                            {!profile.isPremium && (
                                <span className="absolute top-1 right-2 text-[8px] bg-white text-purple-600 px-2 py-0.5 rounded-full font-black">
                                    PRO
                                </span>
                            )}
                            <span className="group-hover:scale-105 transition-transform inline-block">
                                {profile.language === 'ru' ? '🔮 Глубокий разбор (Премиум)' : '🔮 Deep Analysis (Premium)'}
                            </span>
                        </button>
                    </div>
                </div>
            ) : (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    {/* Кнопка нового расчета */}
                    <div className="text-center">
                        <button 
                            onClick={() => {
                                setResult(null);
                                setPartnerName("");
                                setPartnerDate("");
                                setPartnerTime("");
                                setPartnerPlace("");
                            }} 
                            className="text-[10px] uppercase tracking-widest text-astro-subtext underline hover:text-astro-text transition-colors"
                        >
                            {profile.language === 'ru' ? '← Новый расчет' : '← New Calculation'}
                        </button>
                    </div>

                    {/* Отображение результатов в зависимости от режима */}
                    {result.briefOverview && (
                        // КРАТКИЙ РЕЖИМ (бесплатный)
                        <div className="space-y-4">
                            <div className="bg-gradient-to-br from-astro-card to-astro-bg p-6 rounded-xl border border-astro-border">
                                <h4 className="text-astro-highlight text-xs font-bold uppercase tracking-widest mb-3">
                                    {profile.language === 'ru' ? 'Вступление' : 'Introduction'}
                                </h4>
                                <p className="text-sm font-light leading-relaxed text-astro-text">
                                    {result.briefOverview.introduction}
                                </p>
                            </div>

                            <div className="bg-astro-card p-5 rounded-xl border border-astro-border">
                                <h4 className="text-green-400 text-[10px] font-bold uppercase tracking-widest mb-2">
                                    {profile.language === 'ru' ? '✅ Гармония' : '✅ Harmony'}
                                </h4>
                                <p className="text-sm font-light leading-relaxed text-astro-text">
                                    {result.briefOverview.harmony}
                                </p>
                            </div>

                            <div className="bg-astro-card p-5 rounded-xl border border-astro-border">
                                <h4 className="text-yellow-400 text-[10px] font-bold uppercase tracking-widest mb-2">
                                    {profile.language === 'ru' ? '⚠️ Точки роста' : '⚠️ Growth Points'}
                                </h4>
                                <p className="text-sm font-light leading-relaxed text-astro-text">
                                    {result.briefOverview.challenges}
                                </p>
                            </div>

                            <div className="bg-astro-card p-5 rounded-xl border border-astro-border">
                                <h4 className="text-astro-highlight text-[10px] font-bold uppercase tracking-widest mb-3">
                                    {profile.language === 'ru' ? '💡 Подсказки' : '💡 Tips'}
                                </h4>
                                <ul className="space-y-2">
                                    {result.briefOverview.tips.map((tip, index) => (
                                        <li key={index} className="text-sm font-light leading-relaxed text-astro-text flex items-start gap-2">
                                            <span className="text-astro-highlight mt-1">•</span>
                                            <span>{tip}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* CTA для премиум */}
                            {!profile.isPremium && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 p-6 rounded-xl border border-purple-500/30 text-center space-y-4"
                                >
                                    <p className="text-astro-text text-sm">
                                        {profile.language === 'ru' 
                                            ? '🔮 Хотите узнать больше? Получите глубокий разбор вашей совместимости с подробными рекомендациями!'
                                            : '🔮 Want to know more? Get a deep analysis of your compatibility with detailed recommendations!'
                                        }
                                    </p>
                                    <button 
                                        onClick={requestPremium}
                                        className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-3 rounded-full font-bold uppercase tracking-widest text-xs hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg"
                                    >
                                        {profile.language === 'ru' ? 'Получить полный разбор' : 'Get Full Analysis'}
                                    </button>
                                </motion.div>
                            )}
                        </div>
                    )}

                    {result.fullAnalysis && (
                        // ПОЛНЫЙ РЕЖИМ (премиум)
                        <div className="space-y-4">
                            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-6 rounded-xl border border-purple-500/30">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-xl">🌟</span>
                                    <h4 className="text-astro-highlight text-xs font-bold uppercase tracking-widest">
                                        {profile.language === 'ru' ? 'Общая тема вашей связи' : 'General Theme of Your Connection'}
                                    </h4>
                                </div>
                                <p className="text-sm font-light leading-relaxed text-astro-text whitespace-pre-wrap">
                                    {result.fullAnalysis.generalTheme}
                                </p>
                            </div>

                            <div className="bg-astro-card p-5 rounded-xl border border-astro-border">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-xl">💞</span>
                                    <h4 className="text-pink-400 text-[10px] font-bold uppercase tracking-widest">
                                        {profile.language === 'ru' ? 'Что вас притягивает' : 'What Attracts You'}
                                    </h4>
                                </div>
                                <p className="text-sm font-light leading-relaxed text-astro-text whitespace-pre-wrap">
                                    {result.fullAnalysis.attraction}
                                </p>
                            </div>

                            <div className="bg-astro-card p-5 rounded-xl border border-astro-border">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-xl">🌊</span>
                                    <h4 className="text-blue-400 text-[10px] font-bold uppercase tracking-widest">
                                        {profile.language === 'ru' ? 'Сложности и трения' : 'Difficulties and Friction'}
                                    </h4>
                                </div>
                                <p className="text-sm font-light leading-relaxed text-astro-text whitespace-pre-wrap">
                                    {result.fullAnalysis.difficulties}
                                </p>
                            </div>

                            <div className="bg-astro-card p-5 rounded-xl border border-astro-border">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-xl">📝</span>
                                    <h4 className="text-green-400 text-[10px] font-bold uppercase tracking-widest">
                                        {profile.language === 'ru' ? 'Как выстраивать отношения' : 'How to Build the Relationship'}
                                    </h4>
                                </div>
                                <ul className="space-y-2">
                                    {result.fullAnalysis.recommendations.map((rec, index) => (
                                        <li key={index} className="text-sm font-light leading-relaxed text-astro-text flex items-start gap-2">
                                            <span className="text-green-400 mt-1 font-bold">{index + 1}.</span>
                                            <span>{rec}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="bg-gradient-to-br from-astro-highlight/10 to-astro-card p-6 rounded-xl border border-astro-highlight/30">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-xl">✨</span>
                                    <h4 className="text-astro-highlight text-xs font-bold uppercase tracking-widest">
                                        {profile.language === 'ru' ? 'Потенциал отношений' : 'Relationship Potential'}
                                    </h4>
                                </div>
                                <p className="text-sm font-light leading-relaxed text-astro-text whitespace-pre-wrap">
                                    {result.fullAnalysis.potential}
                                </p>
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    );
};
