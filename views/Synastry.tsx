import React, { useState, useMemo } from 'react';
import { UserProfile, SynastryResult } from '../types';
import { getOrGenerateSynastry } from '../services/contentGenerationService';
import { getText, getZodiacSign } from '../constants';
import { motion } from 'framer-motion';
import { Loading } from '../components/ui/Loading';
import { getApproximateSunSignByDate } from '../lib/zodiac-utils';

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
    
    // Вычисляем предполагаемый знак зодиака партнера
    const partnerZodiacSign = useMemo(() => {
        if (!partnerDate) return null;
        try {
            const [year, month, day] = partnerDate.split('-').map(Number);
            if (!year || !month || !day) return null;
            const sign = getApproximateSunSignByDate(year, month, day);
            const signTranslated = getZodiacSign(profile.language, sign);
            return { sign: signTranslated, signEn: sign };
        } catch {
            return null;
        }
    }, [partnerDate, profile.language]);

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
            // Используем новый сервис с кэшированием
            const data = await getOrGenerateSynastry(
                profile,
                partnerName,
                partnerDate,
                partnerTime || undefined,
                partnerPlace || undefined,
                relationshipType,
                mode
            );
            
            setResult(data);
        } catch (e) {
            console.error('[Synastry] Error calculating synastry:', e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        const loadingMessage = profile.language === 'ru' 
            ? 'Анализируем совместимость...' 
            : 'Analyzing compatibility...';
        return <Loading message={loadingMessage} />;
    }

    return (
        <div className="min-h-screen px-6 py-8 max-w-2xl mx-auto pb-32">
            {/* Заголовок страницы */}
            <h1 className="text-[32px] font-bold text-astro-text text-center mb-12 leading-tight">
                {getText(profile.language, 'synastry.title')}
            </h1>

            {!result ? (
                /* ФОРМА ВВОДА ДАННЫХ */
                <div className="space-y-8">
                    {/* Минималистичная форма */}
                    <div className="space-y-6">
                        {/* Имя партнера */}
                        <div>
                            <label className="block text-base font-medium text-astro-text mb-3">
                                {getText(profile.language, 'synastry.partner_name')}
                            </label>
                            <input 
                                type="text" 
                                value={partnerName}
                                onChange={(e) => setPartnerName(e.target.value)}
                                placeholder={profile.language === 'ru' ? 'Введите имя' : 'Enter name'}
                                className="w-full bg-astro-card border-2 border-astro-border rounded-2xl p-4 outline-none focus:border-astro-highlight transition-colors text-astro-text text-lg"
                            />
                        </div>

                        {/* Дата рождения */}
                        <div>
                            <label className="block text-base font-medium text-astro-text mb-3">
                                {profile.language === 'ru' ? 'Дата рождения' : 'Birth Date'}
                            </label>
                            <input 
                                type="date" 
                                value={partnerDate}
                                onChange={(e) => setPartnerDate(e.target.value)}
                                className="w-full bg-astro-card border-2 border-astro-border rounded-2xl p-4 outline-none focus:border-astro-highlight transition-colors text-astro-text text-lg"
                            />
                            {partnerZodiacSign && (
                                <motion.div 
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-3 text-sm text-astro-highlight"
                                >
                                    ✨ {profile.language === 'ru' ? 'Знак зодиака партнера:' : 'Partner\'s zodiac sign:'} <span className="font-bold">{partnerZodiacSign.sign}</span> ({partnerZodiacSign.signEn})
                                </motion.div>
                            )}
                        </div>

                        {/* Дополнительные поля */}
                        <div className="pt-6 border-t border-astro-border/30">
                            <p className="text-sm text-astro-subtext mb-6 text-center">
                                {profile.language === 'ru' ? 'Дополнительно (для более точного анализа)' : 'Optional (for more accurate analysis)'}
                            </p>
                            
                            <div className="space-y-6">
                                {/* Время рождения */}
                                <div>
                                    <label className="block text-base font-medium text-astro-text mb-3">
                                        {profile.language === 'ru' ? 'Время рождения' : 'Birth Time'}
                                    </label>
                                    <input 
                                        type="time" 
                                        value={partnerTime}
                                        onChange={(e) => setPartnerTime(e.target.value)}
                                        className="w-full bg-astro-card border-2 border-astro-border rounded-2xl p-4 outline-none focus:border-astro-highlight transition-colors text-astro-text text-lg"
                                    />
                                </div>

                                {/* Место рождения */}
                                <div>
                                    <label className="block text-base font-medium text-astro-text mb-3">
                                        {profile.language === 'ru' ? 'Место рождения' : 'Birth Place'}
                                    </label>
                                    <input 
                                        type="text" 
                                        value={partnerPlace}
                                        onChange={(e) => setPartnerPlace(e.target.value)}
                                        placeholder={profile.language === 'ru' ? 'Город, страна' : 'City, country'}
                                        className="w-full bg-astro-card border-2 border-astro-border rounded-2xl p-4 outline-none focus:border-astro-highlight transition-colors text-astro-text text-lg"
                                    />
                                </div>

                                {/* Тип отношений */}
                                <div>
                                    <label className="block text-base font-medium text-astro-text mb-3">
                                        {profile.language === 'ru' ? 'Тип отношений' : 'Relationship Type'}
                                    </label>
                                    <select 
                                        value={relationshipType}
                                        onChange={(e) => setRelationshipType(e.target.value)}
                                        className="w-full bg-astro-card border-2 border-astro-border rounded-2xl p-4 outline-none focus:border-astro-highlight transition-colors text-astro-text text-lg"
                                    >
                                        <option value="романтика">{profile.language === 'ru' ? 'Романтические отношения' : 'Romantic'}</option>
                                        <option value="дружба">{profile.language === 'ru' ? 'Дружба' : 'Friendship'}</option>
                                        <option value="работа">{profile.language === 'ru' ? 'Деловое партнёрство' : 'Business'}</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Кнопки расчета */}
                    <div className="space-y-4 pt-6">
                        {/* Краткий анализ (бесплатный) */}
                        <button 
                            onClick={() => handleCalculate('brief')}
                            disabled={!partnerName || !partnerDate}
                            className="w-full bg-astro-highlight text-white py-5 rounded-full text-base font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
                        >
                            {profile.language === 'ru' ? 'Краткий обзор (Бесплатно)' : 'Brief Overview (Free)'}
                        </button>

                        {/* Полный анализ (премиум) */}
                        <button 
                            onClick={() => handleCalculate('full')}
                            disabled={!partnerName || !partnerDate}
                            className="w-full bg-astro-card border-2 border-astro-border text-astro-text py-5 rounded-full text-base font-semibold disabled:opacity-40 hover:border-astro-highlight transition-colors"
                        >
                            {profile.language === 'ru' ? 'Глубокий разбор' : 'Deep Analysis'}
                            {!profile.isPremium && ' (Premium)'}
                        </button>
                    </div>
                </div>
            ) : (
                /* РЕЗУЛЬТАТ СОВМЕСТИМОСТИ */
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-12"
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
                            className="text-sm text-astro-subtext hover:text-astro-text transition-colors"
                        >
                            {profile.language === 'ru' ? 'Новый расчет' : 'New Calculation'}
                        </button>
                    </div>

                    {/* Визуализация партнеров - ДВЕ БОЛЬШИЕ ИКОНКИ + СЕРДЕЧКО */}
                    <div className="flex items-center justify-center gap-6 mb-12">
                        {/* Иконка пользователя - ЗАГЛУШКА */}
                        <div className="flex flex-col items-center">
                            <div className="w-28 h-28 rounded-full bg-astro-card border-2 border-astro-border flex items-center justify-center shadow-md mb-3">
                                <span className="text-5xl text-astro-highlight">
                                    {profile.name?.charAt(0).toUpperCase() || '?'}
                                </span>
                            </div>
                            <p className="text-base font-medium text-astro-text">
                                {profile.name}
                            </p>
                        </div>

                        {/* Сердечко между партнерами - ЗАГЛУШКА */}
                        <div className="text-4xl text-astro-highlight">
                            ♥
                        </div>

                        {/* Иконка партнера - ЗАГЛУШКА */}
                        <div className="flex flex-col items-center">
                            <div className="w-28 h-28 rounded-full bg-astro-card border-2 border-astro-border flex items-center justify-center shadow-md mb-3">
                                <span className="text-5xl text-astro-highlight">
                                    {partnerName?.charAt(0).toUpperCase() || '?'}
                                </span>
                            </div>
                            <p className="text-base font-medium text-astro-text">
                                {partnerName}
                            </p>
                        </div>
                    </div>

                    {/* Результаты анализа */}
                    <div className="max-w-[85%] mx-auto space-y-8">
                        {result.briefOverview && (
                            /* КРАТКИЙ РЕЖИМ (бесплатный) */
                            <>
                                {/* Вступление */}
                                <div>
                                    <h3 className="text-xl font-semibold text-astro-text mb-4 text-center">
                                        {profile.language === 'ru' ? 'Общее впечатление' : 'General Impression'}
                                    </h3>
                                    <p className="text-[18px] leading-relaxed text-astro-text text-center">
                                        {result.briefOverview.introduction}
                                    </p>
                                </div>

                                {/* Гармония */}
                                <div className="bg-astro-card rounded-3xl p-6 border border-astro-border">
                                    <h3 className="text-lg font-semibold text-astro-text mb-4 text-center">
                                        {profile.language === 'ru' ? 'Гармония' : 'Harmony'}
                                    </h3>
                                    <p className="text-[17px] leading-relaxed text-astro-text text-center">
                                        {result.briefOverview.harmony}
                                    </p>
                                </div>

                                {/* Точки роста */}
                                <div className="bg-astro-card rounded-3xl p-6 border border-astro-border">
                                    <h3 className="text-lg font-semibold text-astro-text mb-4 text-center">
                                        {profile.language === 'ru' ? 'Точки роста' : 'Growth Points'}
                                    </h3>
                                    <p className="text-[17px] leading-relaxed text-astro-text text-center">
                                        {result.briefOverview.challenges}
                                    </p>
                                </div>

                                {/* Подсказки */}
                                <div className="bg-astro-card rounded-3xl p-6 border border-astro-border">
                                    <h3 className="text-lg font-semibold text-astro-text mb-4 text-center">
                                        {profile.language === 'ru' ? 'Подсказки' : 'Tips'}
                                    </h3>
                                    <div className="space-y-4">
                                        {result.briefOverview.tips.map((tip, index) => (
                                            <p 
                                                key={index}
                                                className="text-[17px] leading-relaxed text-astro-text text-center"
                                            >
                                                {tip}
                                            </p>
                                        ))}
                                    </div>
                                </div>

                                {/* CTA для премиум */}
                                {!profile.isPremium && (
                                    <div className="pt-8 text-center space-y-6">
                                        <p className="text-[17px] text-astro-text">
                                            {profile.language === 'ru' 
                                                ? 'Хотите узнать больше? Получите глубокий разбор вашей совместимости!'
                                                : 'Want to know more? Get a deep analysis of your compatibility!'
                                            }
                                        </p>
                                        <button 
                                            onClick={requestPremium}
                                            className="bg-astro-highlight text-white px-8 py-4 rounded-full text-base font-semibold hover:opacity-90 transition-opacity"
                                        >
                                            {profile.language === 'ru' ? 'Получить полный разбор' : 'Get Full Analysis'}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        {result.fullAnalysis && (
                            /* ПОЛНЫЙ РЕЖИМ (премиум) */
                            <>
                                {/* Общая тема */}
                                <div>
                                    <h3 className="text-xl font-semibold text-astro-text mb-4 text-center">
                                        {profile.language === 'ru' ? 'Общая тема вашей связи' : 'General Theme of Your Connection'}
                                    </h3>
                                    <p className="text-[18px] leading-relaxed text-astro-text text-center whitespace-pre-wrap">
                                        {result.fullAnalysis.generalTheme}
                                    </p>
                                </div>

                                {/* Что притягивает */}
                                <div className="bg-astro-card rounded-3xl p-6 border border-astro-border">
                                    <h3 className="text-lg font-semibold text-astro-text mb-4 text-center">
                                        {profile.language === 'ru' ? 'Что вас притягивает' : 'What Attracts You'}
                                    </h3>
                                    <p className="text-[17px] leading-relaxed text-astro-text text-center whitespace-pre-wrap">
                                        {result.fullAnalysis.attraction}
                                    </p>
                                </div>

                                {/* Сложности */}
                                <div className="bg-astro-card rounded-3xl p-6 border border-astro-border">
                                    <h3 className="text-lg font-semibold text-astro-text mb-4 text-center">
                                        {profile.language === 'ru' ? 'Сложности и трения' : 'Difficulties and Friction'}
                                    </h3>
                                    <p className="text-[17px] leading-relaxed text-astro-text text-center whitespace-pre-wrap">
                                        {result.fullAnalysis.difficulties}
                                    </p>
                                </div>

                                {/* Рекомендации */}
                                <div className="bg-astro-card rounded-3xl p-6 border border-astro-border">
                                    <h3 className="text-lg font-semibold text-astro-text mb-4 text-center">
                                        {profile.language === 'ru' ? 'Как выстраивать отношения' : 'How to Build the Relationship'}
                                    </h3>
                                    <div className="space-y-4">
                                        {result.fullAnalysis.recommendations.map((rec, index) => (
                                            <p 
                                                key={index}
                                                className="text-[17px] leading-relaxed text-astro-text text-center"
                                            >
                                                {rec}
                                            </p>
                                        ))}
                                    </div>
                                </div>

                                {/* Потенциал */}
                                <div>
                                    <h3 className="text-xl font-semibold text-astro-text mb-4 text-center">
                                        {profile.language === 'ru' ? 'Потенциал отношений' : 'Relationship Potential'}
                                    </h3>
                                    <p className="text-[18px] leading-relaxed text-astro-text text-center whitespace-pre-wrap">
                                        {result.fullAnalysis.potential}
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </motion.div>
            )}
        </div>
    );
};
