/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  User, 
  Users, 
  Calendar, 
  ChevronRight, 
  Lock, 
  Info, 
  MapPin, 
  Clock,
  ArrowLeft,
  Star
} from 'lucide-react';
import { cn } from './lib/utils';
import { 
  getSoulMap, 
  NatalData, 
  SoulMapResponse, 
  getCompatibility, 
  UnionType, 
  getZodiacHoroscope, 
  getPersonalizedHoroscope 
} from './services/soulService';

// --- Types ---
type Tab = 'natal' | 'compatibility' | 'horoscope';

// --- Components ---

const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' }) => {
  const variants = {
    primary: 'bg-text-main text-white hover:bg-opacity-90',
    secondary: 'bg-accent-gold text-white hover:bg-opacity-90',
    outline: 'border border-text-main text-text-main hover:bg-text-main hover:text-white',
    ghost: 'text-text-muted hover:text-text-main hover:bg-black/5',
  };

  return (
    <button 
      className={cn(
        'px-6 py-3 rounded-full font-medium transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const Input = ({ label, icon: Icon, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; icon?: any }) => (
  <div className="space-y-1 w-full">
    <label className="text-[10px] uppercase tracking-[0.15em] font-bold text-text-muted/60 ml-1">
      {label}
    </label>
    <div className="relative">
      {Icon && <Icon className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/40" />}
      <input 
        className={cn(
          "w-full bg-transparent border-b border-black/5 py-3 focus:outline-none focus:border-accent-gold/30 transition-all text-sm placeholder:text-text-muted/30",
          Icon && "pl-7"
        )}
        {...props}
      />
    </div>
  </div>
);

const Card = ({ children, className }: { children: React.ReactNode; className?: string; key?: React.Key }) => (
  <div className={cn("glass-card rounded-[32px] p-6 airy-shadow", className)}>
    {children}
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('natal');
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SoulMapResponse | null>(null);
  const [compResult, setCompResult] = useState<any>(null);
  const [horoscopeResult, setHoroscopeResult] = useState<string | null>(null);
  const [selectedSign, setSelectedSign] = useState<string | null>(null);
  const [unionType, setUnionType] = useState<UnionType>('love');
  
  const [formData, setFormData] = useState<NatalData>({
    birthDate: '',
    birthTime: '',
    birthPlace: '',
  });

  const [partnerData, setPartnerData] = useState<NatalData>({
    birthDate: '',
    birthTime: '',
    birthPlace: '',
  });

  const zodiacSigns = [
    'Овен', 'Телец', 'Близнецы', 'Рак', 'Лев', 'Дева', 
    'Весы', 'Скорпион', 'Стрелец', 'Козерог', 'Водолей', 'Рыбы'
  ];

  const handleCalculate = async () => {
    if (!formData.birthDate || !formData.birthPlace) return;
    setLoading(true);
    try {
      const data = await getSoulMap(formData, isPremium);
      setResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCompatibility = async () => {
    if (!formData.birthDate || !partnerData.birthDate) return;
    setLoading(true);
    try {
      const data = await getCompatibility(formData, partnerData, unionType);
      setCompResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleZodiacHoroscope = async (sign: string) => {
    setSelectedSign(sign);
    setLoading(true);
    try {
      const text = await getZodiacHoroscope(sign);
      setHoroscopeResult(text);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePersonalizedHoroscope = async () => {
    if (!formData.birthDate) return;
    setLoading(true);
    try {
      const text = await getPersonalizedHoroscope(formData);
      setHoroscopeResult(text);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen max-w-md mx-auto relative px-6 pt-12 pb-20">
      {/* Header */}
      <header className="flex justify-between items-center mb-12">
        <div>
          <h1 className="serif text-4xl font-medium tracking-tight">LUMIA</h1>
          <p className="text-text-muted text-xs tracking-wide opacity-60">Твой путь к себе</p>
        </div>

        <button 
          onClick={() => setIsPremium(!isPremium)}
          className={cn(
            "p-2 rounded-full transition-all",
            isPremium ? "bg-accent-gold text-white" : "bg-white border border-black/5 text-text-muted"
          )}
        >
          {isPremium ? <Star className="w-5 h-5 fill-current" /> : <Lock className="w-5 h-5" />}
        </button>
      </header>

      {/* Main Content */}
      <main>
        <AnimatePresence mode="wait">
          {!result && !compResult ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Tabs */}
              <div className="flex bg-white/50 p-1 rounded-full border border-black/5">
                {(['natal', 'compatibility', 'horoscope'] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "flex-1 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all",
                      activeTab === tab ? "bg-white text-text-main shadow-sm" : "text-text-muted"
                    )}
                  >
                    {tab === 'natal' ? 'Карта' : tab === 'compatibility' ? 'Союз' : 'Гороскоп'}
                  </button>
                ))}
              </div>

              {activeTab === 'natal' && (
                <Card className="space-y-6">
                  <div className="space-y-4">
                    <Input 
                      label="Дата рождения" 
                      type="date" 
                      icon={Calendar} 
                      value={formData.birthDate}
                      onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
                    />
                    <Input 
                      label="Время (если знаешь)" 
                      type="time" 
                      icon={Clock} 
                      value={formData.birthTime}
                      onChange={(e) => setFormData({...formData, birthTime: e.target.value})}
                    />
                    <Input 
                      label="Место рождения" 
                      placeholder="Город..." 
                      icon={MapPin} 
                      value={formData.birthPlace}
                      onChange={(e) => setFormData({...formData, birthPlace: e.target.value})}
                    />
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={handleCalculate}
                    disabled={loading || !formData.birthDate}
                  >
                    {loading ? "Считываем..." : "Раскрыть карту"}
                  </Button>
                </Card>
              )}

              {activeTab === 'compatibility' && (
                <div className="space-y-10">
                  <div className="space-y-4 text-center">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-accent-gold">Характер вашей связи</label>
                    <div className="flex bg-white/40 p-1 rounded-full border border-black/5 max-w-[280px] mx-auto">
                      {(['love', 'business', 'friendship', 'family'] as UnionType[]).map((type) => (
                        <button
                          key={type}
                          onClick={() => setUnionType(type)}
                          className={cn(
                            "flex-1 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all",
                            unionType === type 
                              ? "bg-white text-text-main shadow-sm" 
                              : "text-text-muted"
                          )}
                        >
                          {type === 'love' ? '❤' : type === 'business' ? '💼' : type === 'friendship' ? '🤝' : '🏠'}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-text-muted font-medium italic">
                      {unionType === 'love' ? 'Романтика и чувства' : unionType === 'business' ? 'Дела и партнерство' : unionType === 'friendship' ? 'Дружба и поддержка' : 'Семейные узы'}
                    </p>
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-6">
                      <h3 className="serif text-2xl text-center">Твои ритмы</h3>
                      <div className="space-y-4 px-2">
                        <Input 
                          label="Дата рождения" 
                          type="date" 
                          value={formData.birthDate}
                          onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <Input 
                            label="Время" 
                            type="time" 
                            value={formData.birthTime}
                            onChange={(e) => setFormData({...formData, birthTime: e.target.value})}
                          />
                          <Input 
                            label="Место" 
                            placeholder="Город" 
                            value={formData.birthPlace}
                            onChange={(e) => setFormData({...formData, birthPlace: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="w-px h-12 bg-gradient-to-b from-black/5 to-transparent mx-auto" />

                    <div className="space-y-6">
                      <h3 className="serif text-2xl text-center">Ритмы партнера</h3>
                      <div className="space-y-4 px-2">
                        <Input 
                          label="Дата рождения" 
                          type="date" 
                          value={partnerData.birthDate}
                          onChange={(e) => setPartnerData({...partnerData, birthDate: e.target.value})}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <Input 
                            label="Время" 
                            type="time" 
                            value={partnerData.birthTime}
                            onChange={(e) => setPartnerData({...partnerData, birthTime: e.target.value})}
                          />
                          <Input 
                            label="Место" 
                            placeholder="Город" 
                            value={partnerData.birthPlace}
                            onChange={(e) => setPartnerData({...partnerData, birthPlace: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <Button 
                      className="w-full py-4 shadow-lg shadow-black/5" 
                      onClick={handleCompatibility}
                      disabled={loading || !formData.birthDate || !partnerData.birthDate}
                    >
                      {loading ? "Синхронизируем..." : "Узнать резонанс"}
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === 'horoscope' && (
                <div className="space-y-6">
                  {isPremium ? (
                    <Card className="text-center py-8 space-y-6">
                      <div className="w-16 h-16 bg-accent-gold/10 rounded-full flex items-center justify-center mx-auto">
                        <Sparkles className="w-8 h-8 text-accent-gold" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="serif text-2xl">Твой личный ритм</h3>
                        <p className="text-sm text-text-muted px-4">
                          Индивидуальный прогноз на основе твоей натальной карты и текущих транзитов.
                        </p>
                      </div>
                      
                      {horoscopeResult ? (
                        <div className="p-4 bg-bg-warm rounded-2xl text-left italic text-text-main leading-relaxed">
                          {horoscopeResult}
                        </div>
                      ) : (
                        <Button 
                          className="w-full" 
                          onClick={handlePersonalizedHoroscope}
                          disabled={loading || !formData.birthDate}
                        >
                          {loading ? "Считываем ритмы..." : "Получить прогноз"}
                        </Button>
                      )}
                    </Card>
                  ) : (
                    <div className="space-y-6">
                      <div className="text-center space-y-2">
                        <h3 className="serif text-2xl">Гороскоп по знакам</h3>
                        <p className="text-xs text-text-muted">Выбери свой знак зодиака</p>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        {zodiacSigns.map((sign) => (
                          <button
                            key={sign}
                            onClick={() => handleZodiacHoroscope(sign)}
                            className={cn(
                              "p-3 rounded-2xl border text-xs font-medium transition-all flex flex-col items-center gap-2",
                              selectedSign === sign 
                                ? "bg-text-main text-white border-text-main" 
                                : "bg-white text-text-muted border-black/5 hover:border-black/10"
                            )}
                          >
                            {sign}
                          </button>
                        ))}
                      </div>

                      {horoscopeResult && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                          <Card className="bg-accent-gold/5 border-accent-gold/20">
                            <h4 className="serif text-lg text-accent-gold mb-2">{selectedSign}</h4>
                            <p className="text-sm leading-relaxed italic">{horoscopeResult}</p>
                          </Card>
                        </motion.div>
                      )}

                      <Card className="bg-text-main text-white border-none text-center p-8 space-y-4">
                        <Lock className="w-8 h-8 mx-auto opacity-50" />
                        <h4 className="serif text-xl">Персональный прогноз</h4>
                        <p className="text-xs opacity-70">
                          Хочешь прогноз, рассчитанный точно по твоей карте? Переходи на Premium.
                        </p>
                        <Button variant="secondary" className="w-full" onClick={() => setIsPremium(true)}>
                          Активировать Premium
                        </Button>
                      </Card>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ) : result ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <button 
                onClick={() => setResult(null)}
                className="flex items-center gap-2 text-text-muted hover:text-text-main transition-colors mb-4"
              >
                <ArrowLeft className="w-4 h-4" /> Назад
              </button>

              <div className="text-center space-y-3 mb-12">
                <h2 className="serif text-4xl font-medium leading-tight">{result.core.title}</h2>
                <p className="text-base leading-relaxed text-text-main/80 px-4 text-justify">{result.core.description}</p>
              </div>

              <div className="space-y-10">
                {result.traits.map((trait, idx) => (
                  <div key={idx} className="space-y-3 text-center">
                    <h3 className="serif text-xl text-text-main opacity-90">{trait.label}</h3>
                    <p className="text-sm leading-relaxed text-text-muted/80 px-2 text-justify">
                      {trait.description}
                    </p>
                  </div>
                ))}
              </div>

              <Card className="bg-text-main text-white border-none">
                <h4 className="serif text-xl mb-2">Совет дня</h4>
                <p className="text-sm opacity-90">{result.advice}</p>
              </Card>

              {result.premiumPreview && (
                <div className="relative overflow-hidden rounded-[32px] p-8 bg-accent-gold text-white text-center space-y-4">
                  <div className="absolute top-0 right-0 p-4 opacity-20">
                    <Lock className="w-12 h-12" />
                  </div>
                  <h4 className="serif text-2xl">Хочешь знать больше?</h4>
                  <p className="text-sm opacity-90">{result.premiumPreview}</p>
                  <Button variant="primary" className="bg-white text-text-main hover:bg-white/90 w-full">
                    Открыть Premium
                  </Button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="comp-result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
               <button 
                onClick={() => setCompResult(null)}
                className="flex items-center gap-2 text-text-muted hover:text-text-main transition-colors mb-4"
              >
                <ArrowLeft className="w-4 h-4" /> Назад
              </button>

              <Card className="text-center space-y-6">
                <div className="relative inline-block">
                  <div className="text-6xl font-serif text-accent-gold">{compResult.score}%</div>
                  <div className="text-[10px] uppercase tracking-widest font-bold text-text-muted">Резонанс</div>
                </div>
                <p className="serif text-2xl px-4 leading-snug">{compResult.summary}</p>
              </Card>

              <div className="space-y-4">
                <Card className="bg-green-50/30 border-green-100/50">
                  <h5 className="text-[10px] uppercase tracking-widest font-bold text-green-700 mb-3 text-center">Сильные стороны</h5>
                  <ul className="text-sm space-y-2 text-green-900 px-2">
                    {compResult.strengths.map((s: string, i: number) => <li key={i} className="flex gap-2"><span>•</span> {s}</li>)}
                  </ul>
                </Card>
                <Card className="bg-orange-50/30 border-orange-100/50">
                  <h5 className="text-[10px] uppercase tracking-widest font-bold text-orange-700 mb-3 text-center">Вызовы</h5>
                  <ul className="text-sm space-y-2 text-orange-900 px-2">
                    {compResult.challenges.map((c: string, i: number) => <li key={i} className="flex gap-2"><span>•</span> {c}</li>)}
                  </ul>
                </Card>
                {compResult.advice && (
                  <Card className="bg-text-main text-white border-none text-center">
                    <h5 className="text-[10px] uppercase tracking-widest font-bold opacity-50 mb-2">Совет союзу</h5>
                    <p className="text-sm italic">{compResult.advice}</p>
                  </Card>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
