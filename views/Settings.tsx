
import React, { useState, useEffect } from 'react';
import { UserProfile, Language, NotificationFrequency } from '../types';
import { getText } from '../constants';
import { saveProfile } from '../services/storageService';
import { updateUserNotificationSettings, getUserNotificationSettings, getTelegramInitDataHeaders } from '../services/sessionService';
import { hasActivePremium } from '../lib/accessMatrix';
import { FreshInnerHeader } from '../components/fresh-ui/FreshHeaders';

/** Частота из UI → флаги движка уведомлений (реальная таблица user_notification_settings) */
function notificationFlagsFor(frequency: NotificationFrequency) {
  switch (frequency) {
    case 'quiet':
      return { enabled: false, morningEnabled: false, dayEnabled: false, eveningEnabled: false, reactivationEnabled: false };
    case 'important':
      return { enabled: true, morningEnabled: true, dayEnabled: false, eveningEnabled: false, reactivationEnabled: true };
    case 'daily':
      return { enabled: true, morningEnabled: true, dayEnabled: false, eveningEnabled: true, reactivationEnabled: true };
    case 'twice_daily':
      return { enabled: true, morningEnabled: true, dayEnabled: true, eveningEnabled: true, reactivationEnabled: true };
    default:
      return { enabled: true, morningEnabled: true, dayEnabled: false, eveningEnabled: false, reactivationEnabled: true };
  }
}

function localTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow'; } catch { return 'Europe/Moscow'; }
}

interface SettingsProps {
    profile: UserProfile;
    onUpdate: (profile: UserProfile) => void;
    onShowPremiumPreview?: () => void;
    onRequestPremium?: () => void;
    onOpenAdmin?: () => void;
    onOpenCharts?: () => void;
}

const NOTIFICATION_FREQUENCIES: NotificationFrequency[] = ['quiet', 'important', 'daily', 'twice_daily'];

const notificationPreferenceKey = (userId?: string) => `lumia.notificationFrequency.${userId || 'anonymous'}`;

function readStoredNotificationFrequency(userId?: string): NotificationFrequency | null {
    if (typeof window === 'undefined') return null;
    try {
        const value = window.localStorage.getItem(notificationPreferenceKey(userId));
        return NOTIFICATION_FREQUENCIES.includes(value as NotificationFrequency) ? (value as NotificationFrequency) : null;
    } catch {
        return null;
    }
}

// Лимит смены профиля: free — 1 раз всего, premium — 3 раза в календарный месяц.
// Журнал правок в localStorage (мягкий лимит на устройстве).
const profileEditsKey = (userId?: string) => `lumia.profileEdits.${userId || 'anonymous'}`;

function readProfileEdits(userId?: string): number[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(profileEditsKey(userId));
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr.filter((n): n is number => typeof n === 'number') : [];
    } catch {
        return [];
    }
}

function recordProfileEdit(userId?: string) {
    if (typeof window === 'undefined') return;
    try {
        const arr = readProfileEdits(userId);
        arr.push(Date.now());
        window.localStorage.setItem(profileEditsKey(userId), JSON.stringify(arr.slice(-60)));
    } catch {
        /* лимит держится в памяти на текущую сессию */
    }
}

function profileEditsThisMonth(userId?: string): number {
    const now = new Date();
    return readProfileEdits(userId).filter((t) => {
        const d = new Date(t);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
}

export const Settings: React.FC<SettingsProps> = ({ profile, onUpdate, onShowPremiumPreview, onRequestPremium, onOpenAdmin }) => {
    const [tgUser, setTgUser] = useState<{ first_name?: string; last_name?: string; photo_url?: string } | null>(null);
    const [editing, setEditing] = useState(false);
    const [tempName, setTempName] = useState(profile.name);
    const [tempPlace, setTempPlace] = useState(profile.birthPlace);
    const [selfTest, setSelfTest] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');
    const [dailyPush, setDailyPush] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');
    const [dailyPushInfo, setDailyPushInfo] = useState('');
    const [editsUsed, setEditsUsed] = useState(() =>
        hasActivePremium(profile) ? profileEditsThisMonth(profile.id) : readProfileEdits(profile.id).length
    );
    const [notifEnabled, setNotifEnabled] = useState(true);
    const [quietStart, setQuietStart] = useState('22:00');
    const [quietEnd, setQuietEnd] = useState('08:00');

    useEffect(() => {
        let alive = true;
        void getUserNotificationSettings().then((s) => {
            if (!alive || !s) return;
            setNotifEnabled(s.enabled !== false);
            if (s.quiet_hours_start) setQuietStart(s.quiet_hours_start);
            if (s.quiet_hours_end) setQuietEnd(s.quiet_hours_end);
        });
        return () => { alive = false; };
    }, []);

    const saveNotif = (patch: { enabled?: boolean; quietHoursStart?: string; quietHoursEnd?: string }) => {
        void updateUserNotificationSettings({
            enabled: notifEnabled,
            quietHoursStart: quietStart,
            quietHoursEnd: quietEnd,
            timezone: localTimezone(),
            ...patch,
        });
    };
    const toggleNotif = () => {
        const next = !notifEnabled;
        setNotifEnabled(next);
        saveNotif({ enabled: next });
    };
    const changeQuiet = (which: 'start' | 'end', value: string) => {
        if (which === 'start') setQuietStart(value); else setQuietEnd(value);
        saveNotif(which === 'start' ? { quietHoursStart: value } : { quietHoursEnd: value });
    };

    const sendSelfTest = async () => {
        if (selfTest === 'sending') return;
        setSelfTest('sending');
        try {
            const res = await fetch('/api/admin/notifications/send-self-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
            });
            setSelfTest(res.ok ? 'ok' : 'err');
        } catch {
            setSelfTest('err');
        }
        setTimeout(() => setSelfTest('idle'), 4000);
    };

    const sendDailyPush = async () => {
        if (dailyPush === 'sending') return;
        setDailyPush('sending');
        setDailyPushInfo('');
        try {
            const res = await fetch('/api/admin/notifications/run-self', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
            });
            const data = await res.json().catch(() => ({} as any));
            if (res.ok && data?.success) {
                setDailyPush('ok');
                const d = data.diagnostics || {};
                const hints: string[] = [];
                if (d.optInEnabled === false) hints.push('opt-in выключен');
                if (d.hasPrimaryChart === false) hints.push('нет карты — «карта дня» не сработает');
                if (d.inQuietHours) hints.push('сейчас тихие часы');
                if (d.buttonOpensApp === false) hints.push('кнопка без ссылки на мини-апп (нет username бота)');
                setDailyPushInfo(hints.length ? `Доставлено. Регулярные могут молчать: ${hints.join('; ')}.` : 'Доставлено — проверь чат с ботом.');
            } else {
                setDailyPush('err');
                setDailyPushInfo(data?.error ? String(data.error) : '');
            }
        } catch {
            setDailyPush('err');
        }
        setTimeout(() => { setDailyPush('idle'); setDailyPushInfo(''); }, 9000);
    };
    const sectionClass = 'rounded-mono-card border border-mono-line bg-mono-white p-4 sm:p-[18px]';
    const rowCardClass =
        'w-full rounded-mono-card border border-mono-line bg-mono-white p-4 text-left transition-transform active:scale-[0.99] sm:p-[18px]';
    const inlineActionClass = 'text-mono-muted text-[10px] uppercase tracking-wider hover:text-mono-ink transition-colors';
    const languageLabel = profile.language === 'ru'
        ? getText(profile.language, 'settings.language_ru')
        : getText(profile.language, 'settings.language_en');
    const activePremium = hasActivePremium(profile);
    const profileEditLimit = activePremium ? 3 : 1;
    const profileEditsLeft = Math.max(0, profileEditLimit - editsUsed);
    const canEditProfile = profileEditsLeft > 0;
    const trialDaysLeft = profile.premiumUntil
        ? Math.max(0, Math.ceil((new Date(profile.premiumUntil).getTime() - Date.now()) / 86_400_000))
        : 0;

    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.initDataUnsafe?.user) {
            setTgUser(tg.initDataUnsafe.user);
        }
    }, []);

    useEffect(() => {
        const freq = readStoredNotificationFrequency(profile.id) || profile.notificationFrequency || 'important';
        // Регистрируем пользователя в движке уведомлений (таймзона + флаги) — иначе планировщики его не видят
        void updateUserNotificationSettings({ ...notificationFlagsFor(freq), timezone: localTimezone() });
    }, [profile.id, profile.notificationFrequency]);

    const profileDisplayName = (() => {
        const u = tgUser;
        const fromTg = [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim();
        return fromTg || profile.name || '—';
    })();
    const profilePhotoUrl = tgUser?.photo_url;


    const handleLanguageToggle = () => {
        const newLang: Language = profile.language === 'ru' ? 'en' : 'ru';
        const updated = { ...profile, language: newLang };
        console.log('[Settings] Language changed to:', newLang);
        onUpdate(updated);
        saveProfile(updated).catch(error => {
            console.error('[Settings] Failed to save language:', error);
        });
    };

    const genderStorageKey = `lumia.gender.${profile.id || 'anonymous'}`;

    // Пол иногда терялся при перезагрузке профиля и сбрасывался на «не указывать».
    // Дублируем выбор в localStorage и восстанавливаем его — как частоту уведомлений.
    useEffect(() => {
        let stored: string | null = null;
        try { stored = window.localStorage.getItem(genderStorageKey); } catch { /* ignore */ }
        if (stored && ['male', 'female', 'unspecified'].includes(stored) && (profile.gender || null) !== stored) {
            const updated = { ...profile, gender: stored as 'male' | 'female' | 'unspecified' };
            onUpdate(updated);
            saveProfile(updated).catch(() => { /* ignore */ });
        }
    }, [profile.id, profile.gender, onUpdate]);

    const handleGenderChange = (gender: 'male' | 'female' | 'unspecified') => {
        try { window.localStorage.setItem(genderStorageKey, gender); } catch { /* ignore */ }
        const updated = { ...profile, gender };
        onUpdate(updated);
        saveProfile(updated).catch(error => {
            console.error('[Settings] Failed to save gender:', error);
        });
    };

    const handleSaveProfile = () => {
        const nameChanged = (tempName || '') !== (profile.name || '');
        const placeChanged = (tempPlace || '') !== (profile.birthPlace || '');
        if ((!nameChanged && !placeChanged) || !canEditProfile) {
            setEditing(false);
            return;
        }
        const updated = { ...profile, name: tempName, birthPlace: tempPlace };
        onUpdate(updated);
        saveProfile(updated).then(() => {
            console.log('[Settings] Profile saved successfully');
        }).catch(error => {
            console.error('[Settings] Failed to save profile:', error);
        });
        recordProfileEdit(profile.id);
        setEditsUsed((n) => n + 1);
        setEditing(false);
    };


    return (
        <div className="fresh-page">
          <FreshInnerHeader title={profile.language === 'en' ? 'Settings' : 'Настройки'} />
          <div className="mx-auto max-w-reading-wide px-4 pt-2 pb-28">
            <section className="rounded-mono-card border border-mono-line bg-mono-white p-5 mb-4">
                <div className="flex items-center gap-4">
                    {profilePhotoUrl ? (
                        <img
                            src={profilePhotoUrl}
                            alt=""
                            className="h-16 w-16 shrink-0 rounded-full object-cover border border-black/5"
                        />
                    ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-black/5 bg-white/60 text-xl font-serif text-text-muted">
                            {profileDisplayName.charAt(0).toUpperCase() || '?'}
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="serif text-2xl font-medium text-text-main truncate">{profileDisplayName}</p>
                        {profile.id && (
                            <p className="mt-0.5 text-xs text-text-muted/80">
                                Telegram · ID {profile.id}
                            </p>
                        )}
                    </div>
                </div>
            </section>

            {/* Тарифы / Premium — заметная карта вверху */}
            <button
                type="button"
                onClick={() => onRequestPremium?.()}
                className="mb-4 block w-full rounded-mono-card p-4 text-left text-white sm:p-[18px]"
                style={{ background: 'linear-gradient(135deg, #6D5BDF, #A855F7)' }}
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
                            {profile.language === 'ru' ? 'Тарифы' : 'Pricing'}
                        </div>
                        <div className="mt-1 text-[17px] font-bold">
                            {trialDaysLeft > 0
                                ? (profile.language === 'ru' ? `Premium активен — ${trialDaysLeft} дн.` : `Premium active — ${trialDaysLeft}d`)
                                : 'Lumia Premium'}
                        </div>
                        <div className="mt-0.5 text-[12.5px] text-white/85">
                            {profile.language === 'ru' ? 'Месяц · 3 месяца · Год' : 'Month · 3 months · Year'}
                        </div>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold">
                        {profile.language === 'ru' ? 'Смотреть →' : 'View →'}
                    </span>
                </div>
            </button>

            <section className={sectionClass}>
                <p className="lumia-label tracking-[0.2em]">{getText(profile.language, 'settings.subscription')}</p>
                <h2 className="mt-1.5 font-serif text-xl text-mono-ink sm:text-2xl">
                    {activePremium ? getText(profile.language, 'settings.plan_pro') : getText(profile.language, 'settings.plan_basic')}
                </h2>
                <p className="lumia-muted mt-2 text-sm leading-relaxed">
                    {getText(profile.language, 'settings.subscription_body')}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => { if (!activePremium) onRequestPremium?.(); }}
                        disabled={activePremium}
                        className="fresh-btn-primary"
                        style={{ flex: 1, width: 'auto', margin: 0 }}
                    >
                        {activePremium ? getText(profile.language, 'settings.plan_active') : getText(profile.language, 'dashboard.get_premium')}
                    </button>
                    {!activePremium && onShowPremiumPreview && (
                        <button
                            onClick={onShowPremiumPreview}
                            type="button"
                            className="fresh-btn-ghost"
                        >
                            Lumia Premium
                        </button>
                    )}
                </div>
            </section>

            <div className={`${sectionClass} flex items-center justify-between gap-3`}>
                <div className="min-w-0 pr-2">
                    <h3 className="font-serif text-lg text-mono-ink">{getText(profile.language, 'settings.language')}</h3>
                    <p className="lumia-muted mt-1 text-sm leading-snug">{getText(profile.language, 'settings.language_body')}</p>
                    <p className="lumia-label mt-1.5 tracking-wider">{languageLabel}</p>
                </div>
                <button
                    type="button"
                    onClick={handleLanguageToggle}
                    className="fresh-btn-ghost shrink-0"
                >
                    {getText(profile.language, 'settings.switch_lang')}
                </button>
            </div>

            <div className={sectionClass}>
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 pr-2">
                        <h3 className="font-serif text-lg text-mono-ink">{profile.language === 'en' ? 'Notifications' : 'Уведомления'}</h3>
                        <p className="lumia-muted mt-1 text-sm leading-snug">
                            {profile.language === 'en' ? 'Warm nudges from Lumia.' : 'Тёплые напоминания от Lumia.'}
                        </p>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={notifEnabled}
                        onClick={toggleNotif}
                        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${notifEnabled ? 'bg-mono-accent' : 'bg-mono-ink/15'}`}
                    >
                        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left] ${notifEnabled ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                </div>
                {notifEnabled && (
                    <div className="mt-4">
                        <p className="fresh-field-label">{profile.language === 'en' ? 'Quiet hours (do not disturb)' : 'Тихие часы (не беспокоить)'}</p>
                        <div className="mt-2 flex items-center gap-3">
                            <input type="time" value={quietStart} onChange={(e) => changeQuiet('start', e.target.value)} className="fresh-input" style={{ width: 'auto', minWidth: '6.5rem' }} />
                            <span className="text-mono-muted">—</span>
                            <input type="time" value={quietEnd} onChange={(e) => changeQuiet('end', e.target.value)} className="fresh-input" style={{ width: 'auto', minWidth: '6.5rem' }} />
                        </div>
                        <p className="lumia-muted mt-2 text-xs leading-snug">
                            {profile.language === 'en'
                                ? 'In this window we never send. Daily nudges: morning ~9:00, day ~13:00; win-backs by day.'
                                : 'В эти часы ничего не присылаем. Обычно: утро ~9:00, день ~13:00; возвраты — по дням.'}
                        </p>
                    </div>
                )}
            </div>

            <div className={sectionClass}>
                <div className="flex items-start justify-between gap-4">
                    <h3 className="font-serif text-lg text-mono-ink">{getText(profile.language, 'settings.profile')}</h3>
                    {!editing && (
                        canEditProfile ? (
                            <button onClick={() => setEditing(true)} className={inlineActionClass}>
                                {getText(profile.language, 'settings.edit')}
                            </button>
                        ) : (
                            <span className="text-[10px] uppercase tracking-wider text-mono-muted">
                                {profile.language === 'en'
                                    ? (activePremium ? 'Limit 3/mo' : 'Edit used')
                                    : (activePremium ? 'Лимит 3/мес' : 'Уже изменено')}
                            </span>
                        )
                    )}
                </div>

                <div className="mt-4 space-y-4">
                    <div>
                        <label className="fresh-field-label">
                            {getText(profile.language, 'settings.profile_name')}
                        </label>
                        <input 
                            type="text" 
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            disabled={!editing}
                            className="fresh-input"
                        />
                    </div>
                    <div>
                        <label className="fresh-field-label">
                            {getText(profile.language, 'settings.profile_birth_place')}
                        </label>
                        <input 
                            type="text" 
                            value={tempPlace}
                            onChange={(e) => setTempPlace(e.target.value)}
                            disabled={!editing}
                            className="fresh-input"
                        />
                    </div>
                    <div>
                         <label className="fresh-field-label">
                             {getText(profile.language, 'settings.profile_date_time')}
                         </label>
                         <p className="text-sm font-serif text-mono-ink/75">
                             {profile.birthDate} • {profile.birthTime}
                         </p>
                    </div>

                    {editing && (
                        <p className="text-xs leading-snug text-mono-muted">
                            {profile.language === 'en'
                                ? (activePremium ? `Profile edits left this month: ${profileEditsLeft}` : 'Free: you can change your profile once')
                                : (activePremium ? `Смен профиля в этом месяце осталось: ${profileEditsLeft}` : 'Free: профиль можно изменить один раз')}
                        </p>
                    )}

                    {editing && (
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleSaveProfile}
                                className="fresh-btn-primary"
                                style={{ flex: 1, width: 'auto', margin: 0 }}
                            >
                                {getText(profile.language, 'settings.save')}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setEditing(false);
                                    setTempName(profile.name);
                                    setTempPlace(profile.birthPlace);
                                }}
                                className="fresh-btn-ghost"
                            >
                                {getText(profile.language, 'settings.cancel')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className={sectionClass}>
                <h3 className="font-serif text-lg text-mono-ink">{profile.language === 'en' ? 'Gender' : 'Пол'}</h3>
                <p className="lumia-muted mt-1 text-sm">
                    {profile.language === 'en' ? 'So readings address you in the right grammatical gender.' : 'Чтобы тексты обращались к тебе в правильном роде.'}
                </p>
                <div className="mt-3 flex gap-2">
                    {([['male', 'Мужской', 'Male'], ['female', 'Женский', 'Female'], ['unspecified', 'Не указывать', 'Prefer not']] as const).map(([val, ru, en]) => {
                        const active = (profile.gender || 'unspecified') === val;
                        return (
                            <button
                                key={val}
                                type="button"
                                onClick={() => handleGenderChange(val)}
                                className={`min-h-[40px] flex-1 rounded-mono-pill border px-3 text-[13px] font-semibold transition-transform active:scale-[0.97] ${active ? 'border-mono-accent bg-mono-accent text-white' : 'border-mono-line bg-mono-white text-mono-muted'}`}
                            >
                                {profile.language === 'en' ? en : ru}
                            </button>
                        );
                    })}
                </div>
            </div>

            {profile.isAdmin && onOpenAdmin && (
                <button onClick={onOpenAdmin} className={rowCardClass}>
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h3 className="font-serif text-lg text-mono-ink">
                                {getText(profile.language, 'settings.admin')}
                            </h3>
                            <p className="lumia-muted mt-1 text-sm">{getText(profile.language, 'settings.admin_body')}</p>
                        </div>
                        <span className="text-mono-muted/70">→</span>
                    </div>
                </button>
            )}

            {profile.isAdmin && (
                <button type="button" onClick={sendSelfTest} disabled={selfTest === 'sending'} className={rowCardClass}>
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h3 className="font-serif text-lg text-mono-ink">
                                {profile.language === 'en' ? 'Send a test notification to me' : 'Прислать тест-уведомление себе'}
                            </h3>
                            <p className="lumia-muted mt-1 text-sm">
                                {selfTest === 'sending'
                                    ? (profile.language === 'en' ? 'Sending…' : 'Отправляю…')
                                    : selfTest === 'ok'
                                        ? (profile.language === 'en' ? 'Sent — check your chat with the bot.' : 'Отправлено — проверь чат с ботом.')
                                        : selfTest === 'err'
                                            ? (profile.language === 'en' ? 'Failed — check BOT_TOKEN in Railway.' : 'Не вышло — проверь BOT_TOKEN в Railway.')
                                            : (profile.language === 'en' ? 'Verifies Telegram delivery end-to-end (admin only).' : 'Проверяет доставку в Telegram end-to-end (только для админа).')}
                            </p>
                        </div>
                        <span className="text-mono-muted/70">{selfTest === 'ok' ? '✓' : selfTest === 'err' ? '✕' : '→'}</span>
                    </div>
                </button>
            )}

            {profile.isAdmin && (
                <button type="button" onClick={sendDailyPush} disabled={dailyPush === 'sending'} className={rowCardClass}>
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h3 className="font-serif text-lg text-mono-ink">
                                {profile.language === 'en' ? 'Send my daily push now' : 'Прислать дневной пуш себе сейчас'}
                            </h3>
                            <p className="lumia-muted mt-1 text-sm">
                                {dailyPush === 'sending'
                                    ? (profile.language === 'en' ? 'Sending…' : 'Отправляю…')
                                    : dailyPush === 'ok'
                                        ? (dailyPushInfo || (profile.language === 'en' ? 'Sent — check the bot chat.' : 'Отправлено — проверь чат с ботом.'))
                                        : dailyPush === 'err'
                                            ? (dailyPushInfo || (profile.language === 'en' ? 'Failed.' : 'Не вышло.'))
                                            : (profile.language === 'en' ? 'Real reminder with an app button + tells why the schedule may be silent (admin).' : 'Реальное напоминание с кнопкой в приложение + покажет, почему расписание может молчать (админ).')}
                            </p>
                        </div>
                        <span className="text-mono-muted/70">{dailyPush === 'ok' ? '✓' : dailyPush === 'err' ? '✕' : '→'}</span>
                    </div>
                </button>
            )}

            <div className="pt-1 text-center">
                 <button type="button" className="min-h-[44px] px-3 text-[10px] uppercase tracking-widest text-mono-muted transition-colors hover:text-mono-ink">
                     {getText(profile.language, 'settings.restore')}
                 </button>
            </div>
          </div>
        </div>
    );
};
