import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, HeartHandshake, Sparkles, Star } from 'lucide-react';
import { getZodiacSign } from '../../constants';
import type { UserProfile, ViewState } from '../../types';
import type { PersonalForecastPeriod } from '../../lib/personalForecastContract';
import { getApproximateSunSignByDate } from '../../lib/zodiac-utils';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../../lib/nativeBack';
import { CosmicSurface } from './CosmicSurface';

const DRAWER_TOGGLE_EVENT = 'lumia:toggle-side-drawer';
const DRAWER_STATE_EVENT = 'lumia:side-drawer-state';

interface LumiaSideDrawerProps {
    open: boolean;
    currentView: ViewState;
    profile: UserProfile | null;
    onClose: () => void;
    onOpenDiary: () => void;
    activePeriod: PersonalForecastPeriod;
    /** Exact calculated Sun sign from the active natal chart when available. */
    sunSign?: string | null;
    todayLabel?: string;
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
    sunSign,
    todayLabel,
    onSelectPeriod,
    onOpenSignHoroscope,
    onOpenCompatibility,
    onOpenNatalChart,
    onOpenSettings,
}) => {
    const isEnglish = profile?.language === 'en';
    const [externalOpen, setExternalOpen] = useState(false);
    const effectiveOpen = open || externalOpen;
    const drawerRef = useRef<HTMLElement | null>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    const closeDrawer = useCallback(() => {
        setExternalOpen(false);
        onCloseRef.current();
    }, []);

    const runDrawerAction = useCallback((action: () => void) => {
        setExternalOpen(false);
        action();
    }, []);

    const displayDate = useMemo(() => {
        const supplied = todayLabel?.split('\n').map((part) => part.trim()).filter(Boolean) || [];
        const locale = isEnglish ? 'en-GB' : 'ru-RU';
        const now = new Date();
        const weekday = new Intl.DateTimeFormat(locale, {
            weekday: 'long',
            timeZone: 'Europe/Moscow',
        }).format(now);
        if (supplied.length > 1) {
            return { weekday: supplied[0], date: supplied.slice(1).join(' ') };
        }
        if (supplied.length === 1) return { weekday, date: supplied[0] };
        return {
            date: new Intl.DateTimeFormat(locale, {
                day: 'numeric',
                month: 'long',
                timeZone: 'Europe/Moscow',
            }).format(now),
            weekday,
        };
    }, [isEnglish, todayLabel]);
    const resolvedSunSign = useMemo(() => {
        if (sunSign?.trim()) return sunSign.trim();
        const match = profile?.birthDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return null;
        return getApproximateSunSignByDate(Number(match[1]), Number(match[2]), Number(match[3]));
    }, [profile?.birthDate, sunSign]);
    const sunSignLabel = resolvedSunSign
        ? getZodiacSign(isEnglish ? 'en' : 'ru', resolvedSunSign)
        : null;

    useEffect(() => {
        if (open) setExternalOpen(false);
    }, [open]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleToggle = () => setExternalOpen((current) => !current);
        window.addEventListener(DRAWER_TOGGLE_EVENT, handleToggle);
        return () => window.removeEventListener(DRAWER_TOGGLE_EVENT, handleToggle);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent(DRAWER_STATE_EVENT, {
            detail: { open: effectiveOpen },
        }));
    }, [effectiveOpen]);

    useEffect(() => {
        if (!externalOpen || typeof document === 'undefined') return;
        const shell = document.querySelector<HTMLElement>('.lumia-app-shell');
        const main = shell?.querySelector<HTMLElement>(':scope > main') || null;
        const previousAriaHidden = main?.getAttribute('aria-hidden') ?? null;
        const previousInert = main?.inert ?? false;

        shell?.classList.add('side-drawer-open');
        if (main) {
            main.setAttribute('aria-hidden', 'true');
            main.inert = true;
        }

        return () => {
            if (open) return;
            shell?.classList.remove('side-drawer-open');
            if (!main) return;
            if (previousAriaHidden == null) main.removeAttribute('aria-hidden');
            else main.setAttribute('aria-hidden', previousAriaHidden);
            main.inert = previousInert;
        };
    }, [externalOpen, open]);

    useEffect(() => {
        if (!effectiveOpen || typeof document === 'undefined') return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        previousFocusRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const frame = window.requestAnimationFrame(() => {
            drawerRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus({ preventScroll: true });
        });
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeDrawer();
                return;
            }
            if (event.key !== 'Tab') return;
            const focusable = Array.from(
                drawerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') || [],
            );
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        const handleNativeBack = (event: Event) => {
            const nativeEvent = event as CustomEvent<NativeBackEventDetail>;
            if (!nativeEvent.detail || nativeEvent.detail.handled) return;
            nativeEvent.detail.handled = true;
            closeDrawer();
        };
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener(NATIVE_BACK_EVENT, handleNativeBack);
        return () => {
            window.cancelAnimationFrame(frame);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener(NATIVE_BACK_EVENT, handleNativeBack);
            document.body.style.overflow = previousOverflow;
            previousFocusRef.current?.focus({ preventScroll: true });
            previousFocusRef.current = null;
        };
    }, [closeDrawer, effectiveOpen]);

    const items = [
        {
            view: 'dashboard' as ViewState,
            label: isEnglish ? 'Personal horoscope' : 'Личный гороскоп',
            Icon: BookOpen,
            onClick: onOpenDiary,
        },
        {
            view: 'horoscope' as ViewState,
            label: isEnglish ? 'Sign horoscope' : 'Гороскоп по знакам',
            Icon: Sparkles,
            onClick: onOpenSignHoroscope,
        },
        {
            view: 'synastry' as ViewState,
            label: isEnglish ? 'Compatibility' : 'Совместимость',
            Icon: HeartHandshake,
            onClick: onOpenCompatibility,
        },
        {
            view: 'chart' as ViewState,
            label: isEnglish ? 'Natal chart' : 'Натальная карта',
            Icon: Star,
            onClick: onOpenNatalChart,
        },
    ];

    return (
        <div
            className={`lumia-side-drawer-root${effectiveOpen ? ' is-open' : ''}`}
            aria-hidden={!effectiveOpen}
            data-drawer-enabled={profile ? 'true' : 'false'}
            data-current-view={currentView}
            data-language={isEnglish ? 'en' : 'ru'}
        >
            <button
                type="button"
                className="lumia-side-drawer-backdrop"
                aria-label={isEnglish ? 'Close navigation' : 'Закрыть навигацию'}
                tabIndex={effectiveOpen ? 0 : -1}
                onClick={closeDrawer}
            />
            <CosmicSurface
                ref={drawerRef}
                as="aside"
                variant="drawer"
                className="lumia-side-drawer"
                planeClassName="lumia-side-drawer-plane"
                role="dialog"
                aria-modal="true"
                aria-label={isEnglish ? 'Main navigation' : 'Основная навигация'}
            >
                <header className="lumia-side-drawer-context">
                    <strong className="lumia-side-drawer-date">{displayDate.date}</strong>
                    <span className="lumia-side-drawer-weekday">{displayDate.weekday}</span>
                    {sunSignLabel ? (
                        <span className="lumia-side-drawer-sun-sign">
                            {isEnglish ? 'Sun' : 'Солнце'} · {sunSignLabel}
                        </span>
                    ) : null}
                </header>
                <nav className="lumia-side-drawer-nav">
                    {items.slice(0, 1).map(({ view, label, Icon, onClick }) => (
                        <button
                            key={view}
                            type="button"
                            className={`lumia-side-drawer-item${currentView === view ? ' is-active' : ''}`}
                            aria-current={currentView === view ? 'page' : undefined}
                            tabIndex={effectiveOpen ? 0 : -1}
                            onClick={() => runDrawerAction(onClick)}
                        >
                            <Icon aria-hidden="true" size={24} strokeWidth={1.8} />
                            <span>{label}</span>
                        </button>
                    ))}
                    <div
                        className="lumia-side-drawer-periods"
                        role="group"
                        aria-label={isEnglish ? 'Personal forecast period' : 'Период личного прогноза'}
                    >
                        {(['day', 'week', 'month'] as const).map((period) => (
                            <button
                                key={period}
                                type="button"
                                className={`lumia-side-drawer-period${
                                    currentView === 'dashboard' && activePeriod === period ? ' is-active' : ''
                                }`}
                                aria-pressed={currentView === 'dashboard' && activePeriod === period}
                                tabIndex={effectiveOpen ? 0 : -1}
                                onClick={() => runDrawerAction(() => onSelectPeriod(period))}
                            >
                                {period === 'day'
                                    ? (isEnglish ? 'Today' : 'Сегодня')
                                    : period === 'week'
                                        ? (isEnglish ? 'Week' : 'Неделя')
                                        : (isEnglish ? 'Month' : 'Месяц')}
                            </button>
                        ))}
                    </div>
                    {items.slice(1).map(({ view, label, Icon, onClick }) => (
                        <button
                            key={view}
                            type="button"
                            className={`lumia-side-drawer-item${currentView === view ? ' is-active' : ''}`}
                            aria-current={currentView === view ? 'page' : undefined}
                            tabIndex={effectiveOpen ? 0 : -1}
                            onClick={() => runDrawerAction(onClick)}
                        >
                            <Icon aria-hidden="true" size={24} strokeWidth={1.8} />
                            <span>{label}</span>
                        </button>
                    ))}
                </nav>
                <button
                    type="button"
                    className="lumia-side-drawer-profile"
                    tabIndex={effectiveOpen ? 0 : -1}
                    onClick={() => runDrawerAction(onOpenSettings)}
                >
                    <span className="lumia-side-drawer-profile-name">
                        {profile?.name?.trim() || (isEnglish ? 'Profile' : 'Профиль')}
                    </span>
                    <span className="lumia-side-drawer-profile-caption">
                        {isEnglish ? 'Settings' : 'Настройки'}
                    </span>
                </button>
            </CosmicSurface>
        </div>
    );
};
