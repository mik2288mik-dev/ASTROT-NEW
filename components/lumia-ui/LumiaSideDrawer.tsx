import React from 'react';
import { BookOpen, HeartHandshake, Sparkles, Star } from 'lucide-react';
import type { UserProfile, ViewState } from '../../types';
import type { PersonalForecastPeriod } from '../../lib/personalForecastContract';

interface LumiaSideDrawerProps {
    open: boolean;
    currentView: ViewState;
    profile: UserProfile | null;
    onClose: () => void;
    onOpenDiary: () => void;
    activePeriod: PersonalForecastPeriod;
    onSelectPeriod: (period: PersonalForecastPeriod) => void;
    onOpenSignHoroscope: () => void;
    onOpenCompatibility: () => void;
    onOpenNatalChart: () => void;
    onOpenSettings: () => void;
}

export const LumiaSideDrawer: React.FC<LumiaSideDrawerProps> = ({
    open,
    currentView,
    profile,
    onClose,
    onOpenDiary,
    activePeriod,
    onSelectPeriod,
    onOpenSignHoroscope,
    onOpenCompatibility,
    onOpenNatalChart,
    onOpenSettings,
}) => {
    const isEnglish = profile?.language === 'en';
    const items = [
        { view: 'dashboard' as ViewState, label: isEnglish ? 'Diary' : 'Дневник', Icon: BookOpen, onClick: onOpenDiary },
        { view: 'horoscope' as ViewState, label: isEnglish ? 'Sign horoscope' : 'Гороскоп по знакам', Icon: Sparkles, onClick: onOpenSignHoroscope },
        { view: 'synastry' as ViewState, label: isEnglish ? 'Compatibility' : 'Совместимость', Icon: HeartHandshake, onClick: onOpenCompatibility },
        { view: 'chart' as ViewState, label: isEnglish ? 'Natal chart' : 'Натальная карта', Icon: Star, onClick: onOpenNatalChart },
    ];

    return (
        <div className={`lumia-side-drawer-root${open ? ' is-open' : ''}`} aria-hidden={!open}>
            <button
                type="button"
                className="lumia-side-drawer-backdrop"
                aria-label={isEnglish ? 'Close navigation' : 'Закрыть навигацию'}
                tabIndex={open ? 0 : -1}
                onClick={onClose}
            />
            <aside className="lumia-side-drawer" aria-label={isEnglish ? 'Main navigation' : 'Основная навигация'}>
                <nav className="lumia-side-drawer-nav">
                    {items.map(({ view, label, Icon, onClick }) => (
                        <button
                            key={view}
                            type="button"
                            className={`lumia-side-drawer-item${currentView === view ? ' is-active' : ''}`}
                            aria-current={currentView === view ? 'page' : undefined}
                            tabIndex={open ? 0 : -1}
                            onClick={onClick}
                        >
                            <Icon aria-hidden="true" size={24} strokeWidth={1.8} />
                            <span>{label}</span>
                        </button>
                    ))}
                    <div className="lumia-side-drawer-periods">
                        {(['day', 'week', 'month'] as const).map((period) => (
                            <button
                                key={period}
                                type="button"
                                className={`lumia-side-drawer-period${activePeriod === period ? ' is-active' : ''}`}
                                aria-current={activePeriod === period ? 'page' : undefined}
                                tabIndex={open ? 0 : -1}
                                onClick={() => onSelectPeriod(period)}
                            >
                                {period === 'day' ? (isEnglish ? 'Today' : 'Сегодня') : period === 'week' ? (isEnglish ? 'Week' : 'Неделя') : (isEnglish ? 'Month' : 'Месяц')}
                            </button>
                        ))}
                    </div>
                </nav>
                <button
                    type="button"
                    className="lumia-side-drawer-profile"
                    tabIndex={open ? 0 : -1}
                    onClick={onOpenSettings}
                >
                    <span className="lumia-side-drawer-profile-name">{profile?.name?.trim() || (isEnglish ? 'Profile' : 'Профиль')}</span>
                    <span className="lumia-side-drawer-profile-caption">{isEnglish ? 'Settings' : 'Настройки'}</span>
                </button>
            </aside>
        </div>
    );
};
