
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    BadgeCheck,
    Bell,
    Cake,
    Check,
    ChevronRight,
    Code2,
    Database,
    Eye,
    EyeOff,
    Files,
    Languages,
    LifeBuoy,
    LogIn,
    Scale,
    UserRound,
    VenusAndMars,
} from 'lucide-react';
import { UserProfile, Language, NotificationFrequency } from '../types';
import { getText } from '../constants';
import { saveProfile } from '../services/storageService';
import { updateUserNotificationSettings, getUserNotificationSettings, getTelegramInitDataHeaders } from '../services/sessionService';
import { hasActivePremium } from '../lib/accessMatrix';
import { describePremiumEntitlement } from '../lib/subscriptionPresentation';
import { AppTopBar } from '../components/lumia-ui/AppTopBar';
import { apiFetch } from '../services/apiClient';
import { STORE_RELEASE_CONFIG as releaseConfig } from '../lib/storeReleaseConfig';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../lib/nativeBack';
import {
    authenticateWithProvider,
    getAccountAuthCapabilities,
    getLinkedIdentities,
    linkCurrentTelegramIdentity,
    loginWithEmailPassword,
    registerEmailPassword,
    verifyEmailPasswordRegistration,
    type AccountAuthCapabilities,
    type LinkedIdentity,
} from '../services/accountAuthService';
import { hasTelegramMiniAppContext } from '../services/authSessionIntent';
import { meetsMinimumPasswordLength } from '../lib/auth/passwordPolicy';

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

function readableIdentityError(error: unknown, language: 'ru' | 'en'): string {
    const code = String((error as { code?: string; message?: string } | null)?.code
        || (error as { message?: string } | null)?.message
        || '');
    if (code.includes('AUTH_CANCELLED')) return '';
    if (code.includes('IDENTITY_ALREADY_LINKED') || code.includes('PROVIDER_ALREADY_LINKED')) {
        return language === 'en'
            ? 'This sign-in method already belongs to another account. Choose “Restore an existing account”; two filled profiles are never merged automatically.'
            : 'Этот способ уже привязан к другому аккаунту. Выбери «Восстановить существующий аккаунт»: два заполненных профиля автоматически не объединяются.';
    }
    if (code.includes('APP_SESSION') || code.includes('ACCOUNT_BLOCKED')) {
        return language === 'en'
            ? 'This session is no longer active. Sign in again before changing sign-in methods.'
            : 'Эта сессия больше не активна. Войди снова перед изменением способов входа.';
    }
    if (code.includes('RATE_LIMIT')) {
        return language === 'en'
            ? 'Too many attempts. Wait a little and try again.'
            : 'Слишком много попыток. Подожди немного и попробуй снова.';
    }
    return language === 'en'
        ? 'The sign-in method could not be updated. Try again.'
        : 'Не удалось обновить способ входа. Попробуй ещё раз.';
}

const IDENTITY_LABELS: Record<LinkedIdentity['provider'], string> = {
    vk: 'VK ID',
    yandex: 'Яндекс',
    google: 'Google',
    email: 'Email',
    telegram: 'Telegram',
};

type SettingsScreen =
    | 'root'
    | 'profile'
    | 'birth'
    | 'gender'
    | 'notifications'
    | 'language'
    | 'auth'
    | 'subscription'
    | 'legal'
    | 'account'
    | 'developer';

type SettingsRowProps = {
    label: string;
    value?: string;
    onClick: () => void;
    target?: Exclude<SettingsScreen, 'root'>;
    danger?: boolean;
    icon?: React.ReactNode;
};

function SettingsRow({ label, value, onClick, target, danger = false, icon }: SettingsRowProps) {
    return (
        <button
            type="button"
            className={`settings-list-row${danger ? ' settings-list-row--danger' : ''}`}
            data-settings-target={target}
            onClick={onClick}
        >
            <span className="settings-list-row-main">
                {icon ? <span className="settings-list-row-icon" aria-hidden>{icon}</span> : null}
                <span className="settings-list-row-label">{label}</span>
            </span>
            <span className="settings-list-row-end">
                {value ? <span className="settings-list-row-value">{value}</span> : null}
                <ChevronRight aria-hidden size={16} strokeWidth={1.8} />
            </span>
        </button>
    );
}

function formatSettingsBirthDate(value: string, language: Language): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!match) return value || '—';
    return language === 'ru'
        ? `${match[3]}.${match[2]}.${match[1]}`
        : `${match[2]}/${match[3]}/${match[1]}`;
}

function identityCountLabel(count: number, language: Language): string {
    if (language === 'en') return `${count} ${count === 1 ? 'method' : 'methods'}`;
    const mod10 = count % 10;
    const mod100 = count % 100;
    const noun = mod10 === 1 && mod100 !== 11
        ? 'способ'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
            ? 'способа'
            : 'способов';
    return `${count} ${noun}`;
}

export interface SettingsProps {
    profile: UserProfile;
    onUpdate: (profile: UserProfile) => void;
    onRequestPremium?: () => void;
    canPromotePremium?: boolean;
    onRestorePurchase?: () => Promise<void>;
    onManageSubscription?: () => Promise<void> | void;
    onOpenAdmin?: () => void;
    onOpenCharts?: () => void;
    onBack?: () => void;
    onLogout?: () => Promise<void>;
    onDeleteAccount?: () => Promise<void>;
    recoveryIdentityRequired?: boolean;
    onRecoveryIdentityReady?: () => void;
    uiPreview?: {
        notificationEnabled: boolean;
        quietStart: string;
        quietEnd: string;
        identities: LinkedIdentity[];
        authCapabilities: AccountAuthCapabilities;
    };
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

export const Settings: React.FC<SettingsProps> = ({
    profile,
    onUpdate,
    onRequestPremium,
    canPromotePremium = true,
    onRestorePurchase,
    onManageSubscription,
    onOpenAdmin,
    onOpenCharts,
    onBack,
    onLogout,
    onDeleteAccount,
    recoveryIdentityRequired = false,
    onRecoveryIdentityReady,
    uiPreview,
}) => {
    const previewFixture = process.env.NODE_ENV === 'development' ? uiPreview : undefined;
    const [tgUser, setTgUser] = useState<{ first_name?: string; last_name?: string; photo_url?: string } | null>(null);
    const [editing, setEditing] = useState(false);
    const [tempName, setTempName] = useState(profile.name);
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileSaveError, setProfileSaveError] = useState('');
    const [selfTest, setSelfTest] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');
    const [selfTestInfo, setSelfTestInfo] = useState('');
    const [dailyPush, setDailyPush] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');
    const [dailyPushInfo, setDailyPushInfo] = useState('');
    const [editsUsed, setEditsUsed] = useState(() =>
        previewFixture ? 0 : hasActivePremium(profile) ? profileEditsThisMonth(profile.id) : readProfileEdits(profile.id).length
    );
    const [notifEnabled, setNotifEnabled] = useState(previewFixture?.notificationEnabled ?? true);
    const [quietStart, setQuietStart] = useState(previewFixture?.quietStart || '22:00');
    const [quietEnd, setQuietEnd] = useState(previewFixture?.quietEnd || '08:00');
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [deletionError, setDeletionError] = useState('');
    const [loggingOut, setLoggingOut] = useState(false);
    const [logoutError, setLogoutError] = useState('');
    const [identities, setIdentities] = useState<LinkedIdentity[]>(previewFixture?.identities || []);
    const [identityError, setIdentityError] = useState('');
    const [identityNotice, setIdentityNotice] = useState('');
    const [identityLoadFailed, setIdentityLoadFailed] = useState(false);
    const [identityReload, setIdentityReload] = useState(0);
    const [emailValue, setEmailValue] = useState('');
    const [emailChallengeId, setEmailChallengeId] = useState('');
    const [emailCode, setEmailCode] = useState('');
    const [emailPassword, setEmailPassword] = useState('');
    const [emailPasswordConfirmation, setEmailPasswordConfirmation] = useState('');
    const [emailPasswordVisible, setEmailPasswordVisible] = useState(false);
    const [emailPasswordConfirmationVisible, setEmailPasswordConfirmationVisible] = useState(false);
    const [identityBusy, setIdentityBusy] = useState(false);
    const [authPurpose, setAuthPurpose] = useState<'link' | 'login'>('link');
    const [authCapabilities, setAuthCapabilities] = useState<AccountAuthCapabilities | null>(previewFixture?.authCapabilities || null);
    const [restoreState, setRestoreState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
    const [entitlementNow, setEntitlementNow] = useState(() => Date.now());
    const [previewNotice, setPreviewNotice] = useState('');
    const [settingsScreen, setSettingsScreen] = useState<SettingsScreen>('root');
    const settingsContentRef = useRef<HTMLDivElement | null>(null);
    const lastRootTargetRef = useRef<Exclude<SettingsScreen, 'root'> | null>(null);
    const settingsDetailBusy = savingProfile
        || identityBusy
        || restoreState === 'running'
        || loggingOut
        || deletingAccount;

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            settingsContentRef.current?.focus({ preventScroll: true });
        });
        return () => window.cancelAnimationFrame(frame);
    }, []);

    const updateLinkedIdentitiesAfterAuth = async (fresh: UserProfile): Promise<void> => {
        onUpdate(fresh);
        try {
            const result = await getLinkedIdentities();
            setIdentities(result.identities);
        } finally {
            // A successful provider/email auth response already proves the
            // recovery identity. The backend will enforce it again at checkout.
            if (recoveryIdentityRequired) onRecoveryIdentityReady?.();
        }
    };

    useEffect(() => {
        if (!recoveryIdentityRequired) return;
        setAuthPurpose('link');
        setSettingsScreen('auth');
        const frame = window.requestAnimationFrame(() => {
            document.getElementById('recovery-identity')?.scrollIntoView({ block: 'start' });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [recoveryIdentityRequired]);

    useEffect(() => {
        const end = profile.premiumEntitlement?.endsAt || profile.premiumUntil;
        const endMs = end ? new Date(end).getTime() : Number.NaN;
        setEntitlementNow(Date.now());
        if (!Number.isFinite(endMs) || endMs <= Date.now()) return;
        let timer = 0;
        const scheduleBoundary = () => {
            const remaining = endMs - Date.now() + 50;
            if (remaining <= 0) {
                setEntitlementNow(Date.now());
                return;
            }
            timer = window.setTimeout(
                scheduleBoundary,
                Math.min(2_147_000_000, Math.max(1, remaining)),
            );
        };
        scheduleBoundary();
        return () => window.clearTimeout(timer);
    }, [profile.premiumEntitlement?.endsAt, profile.premiumUntil]);

    useEffect(() => {
        if (previewFixture) return;
        let alive = true;
        void getUserNotificationSettings().then((s) => {
            if (!alive || !s) return;
            setNotifEnabled(s.enabled !== false);
            if (s.quiet_hours_start) setQuietStart(s.quiet_hours_start);
            if (s.quiet_hours_end) setQuietEnd(s.quiet_hours_end);
        });
        return () => { alive = false; };
    }, [previewFixture]);

    useEffect(() => {
        if (previewFixture) return;
        let alive = true;
        void Promise.all([getLinkedIdentities(), getAccountAuthCapabilities()])
            .then(([result, capabilities]) => {
                if (!alive) return;
                setIdentities(result.identities);
                setAuthCapabilities(capabilities);
                setIdentityLoadFailed(false);
            })
            .catch(() => {
                if (!alive) return;
                setIdentityLoadFailed(true);
            });
        return () => { alive = false; };
    }, [identityReload, profile.id, previewFixture]);

    const linkOAuth = (provider: 'vk' | 'yandex' | 'google') => {
        if (previewFixture) {
            setPreviewNotice(`В Preview вход через ${provider === 'vk' ? 'VK ID' : provider === 'yandex' ? 'Яндекс' : 'Google'} отключён.`);
            return;
        }
        setIdentityError('');
        setIdentityNotice('');
        setIdentityBusy(true);
        void authenticateWithProvider(provider, authPurpose)
            .then(async (fresh) => {
                if (fresh) await updateLinkedIdentitiesAfterAuth(fresh);
            })
            .catch((error) => setIdentityError(readableIdentityError(error, profile.language === 'en' ? 'en' : 'ru')))
            .finally(() => setIdentityBusy(false));
    };

    const linkTelegram = () => {
        if (previewFixture) {
            setPreviewNotice('В Preview привязка Telegram отключена.');
            return;
        }
        setIdentityError('');
        setIdentityNotice('');
        setIdentityBusy(true);
        void linkCurrentTelegramIdentity()
            .then(async (fresh) => {
                onUpdate(fresh);
                const result = await getLinkedIdentities();
                setIdentities(result.identities);
            })
            .catch((error) => setIdentityError(readableIdentityError(error, profile.language === 'en' ? 'en' : 'ru')))
            .finally(() => setIdentityBusy(false));
    };

    const requestEmailCode = () => {
        if (previewFixture) {
            setPreviewNotice('В Preview вход и отправка кода отключены.');
            return;
        }
        setIdentityError('');
        setIdentityNotice('');
        setIdentityBusy(true);
        const action = authPurpose === 'login'
            ? loginWithEmailPassword(emailValue, emailPassword).then(async (fresh) => {
                await updateLinkedIdentitiesAfterAuth(fresh);
            })
            : registerEmailPassword({
                email: emailValue,
                password: emailPassword,
                passwordConfirmation: emailPasswordConfirmation,
                purpose: 'link',
            }).then((result) => {
                setEmailChallengeId(result.challengeId);
                setIdentityNotice(profile.language === 'en'
                    ? 'If this email can be linked, a six-digit code was sent. Existing accounts are never merged automatically.'
                    : 'Если этот email можно привязать, шестизначный код отправлен. Существующие аккаунты автоматически не объединяются.');
            });
        void action
            .catch((error) => setIdentityError(readableIdentityError(error, profile.language === 'en' ? 'en' : 'ru')))
            .finally(() => setIdentityBusy(false));
    };

    const confirmEmailCode = () => {
        if (previewFixture) {
            setPreviewNotice('В Preview подтверждение аккаунта отключено.');
            return;
        }
        setIdentityError('');
        setIdentityNotice('');
        setIdentityBusy(true);
        void verifyEmailPasswordRegistration(emailChallengeId, emailCode)
            .then(async (fresh) => {
                if (fresh) await updateLinkedIdentitiesAfterAuth(fresh);
                setEmailChallengeId('');
                setEmailCode('');
                setEmailPassword('');
                setEmailPasswordConfirmation('');
            })
            .catch((error) => setIdentityError(readableIdentityError(error, profile.language === 'en' ? 'en' : 'ru')))
            .finally(() => setIdentityBusy(false));
    };

    const saveNotif = (patch: { enabled?: boolean; quietHoursStart?: string; quietHoursEnd?: string }) => {
        if (previewFixture) return;
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
        if (previewFixture) {
            setPreviewNotice('В Preview тестовые уведомления не отправляются.');
            return;
        }
        if (selfTest === 'sending') return;
        setSelfTest('sending');
        setSelfTestInfo('');
        try {
            // Admin v2: реальный сквозной пуш себе через движок. Старый /api/admin/notifications/*
            // удалён при перестройке Admin V2 (27 июня) — отсюда и «не вышло».
            const res = await apiFetch('/api/admin/v2/notifications/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
                body: JSON.stringify({ action: 'selftest' }),
            });
            const data = await res.json().catch(() => ({} as any));
            const result = data?.result || {};
            if (res.ok && result.ok) {
                setSelfTest('ok');
            } else {
                setSelfTest('err');
                setSelfTestInfo(String(result.error || data?.message || data?.error || (res.status === 404 ? 'эндпоинт не найден' : `ошибка ${res.status}`)));
            }
        } catch (e: any) {
            setSelfTest('err');
            setSelfTestInfo(String(e?.message || 'сеть недоступна'));
        }
        setTimeout(() => { setSelfTest('idle'); setSelfTestInfo(''); }, 8000);
    };

    const sendDailyPush = async () => {
        if (previewFixture) {
            setPreviewNotice('В Preview push-уведомления не отправляются.');
            return;
        }
        if (dailyPush === 'sending') return;
        setDailyPush('sending');
        setDailyPushInfo('');
        try {
            const headers = { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() };
            // Гарантированная доставка (selftest) + honest-диагностика, почему регулярные могут молчать.
            const res = await apiFetch('/api/admin/v2/notifications/run', {
                method: 'POST', headers, body: JSON.stringify({ action: 'selftest' }),
            });
            const data = await res.json().catch(() => ({} as any));
            const result = data?.result || {};
            if (res.ok && result.ok) {
                setDailyPush('ok');
                const diag = await apiFetch('/api/admin/v2/notifications/diagnostics', { headers: getTelegramInitDataHeaders() })
                    .then((x) => x.json()).catch(() => null);
                const hints: string[] = [];
                if (diag?.env?.dryRun) hints.push('отправка выключена (нет токена)');
                if (diag?.ownerProbe && !diag.ownerProbe.candidateNow) hints.push('по расписанию сейчас тебе ничего не подходит (окно/лимит/тихие часы)');
                if (Array.isArray(diag?.problems)) hints.push(...diag.problems);
                setDailyPushInfo(hints.length ? `Доставлено. Регулярные могут молчать: ${hints.slice(0, 3).join('; ')}.` : 'Доставлено — проверь чат с ботом.');
            } else {
                setDailyPush('err');
                setDailyPushInfo(String(result.error || data?.message || data?.error || (res.status === 404 ? 'эндпоинт не найден' : `ошибка ${res.status}`)));
            }
        } catch (e: any) {
            setDailyPush('err');
            setDailyPushInfo(String(e?.message || ''));
        }
        setTimeout(() => { setDailyPush('idle'); setDailyPushInfo(''); }, 9000);
    };
    const languageLabel = profile.language === 'ru'
        ? getText(profile.language, 'settings.language_ru')
        : getText(profile.language, 'settings.language_en');
    const activePremium = hasActivePremium(profile, entitlementNow);
    const profileEditLimit = activePremium ? 3 : 1;
    const profileEditsLeft = Math.max(0, profileEditLimit - editsUsed);
    const canEditProfile = profileEditsLeft > 0;
    const legacyGiftEntitlement = activePremium && !profile.premiumEntitlement && profile.premiumUntil
        ? {
            state: 'gift' as const,
            isPremium: true,
            source: 'legacy_gift',
            startsAt: null,
            endsAt: profile.premiumUntil,
            autoRenew: false,
            productId: null,
            period: null,
        }
        : null;
    const subscriptionPresentation = describePremiumEntitlement(
        profile.premiumEntitlement || legacyGiftEntitlement,
        profile.language,
        entitlementNow,
    );
    const hasActiveRuStoreAutoRenewal = profile.premiumEntitlement?.source === 'rustore'
        && profile.premiumEntitlement.autoRenew === true;

    const restorePurchase = () => {
        if (previewFixture) {
            setRestoreState('success');
            setPreviewNotice('В Preview восстановление покупок отключено.');
            return;
        }
        if (!onRestorePurchase || restoreState === 'running') return;
        setRestoreState('running');
        void onRestorePurchase()
            .then(() => setRestoreState('success'))
            .catch(() => setRestoreState('error'));
    };

    const manageSubscription = () => {
        if (previewFixture) {
            setPreviewNotice('В Preview управление подпиской отключено.');
            return;
        }
        void onManageSubscription?.();
    };

    const blockPreviewLink = (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (!previewFixture) return;
        event.preventDefault();
        setPreviewNotice('Внешние ссылки отключены в локальном Preview.');
    };

    useEffect(() => {
        if (previewFixture) return;
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.initDataUnsafe?.user) {
            setTgUser(tg.initDataUnsafe.user);
        }
    }, [previewFixture]);

    useEffect(() => {
        if (previewFixture) return;
        const freq = readStoredNotificationFrequency(profile.id) || profile.notificationFrequency || 'important';
        // Регистрируем пользователя в движке уведомлений (таймзона + флаги) — иначе планировщики его не видят
        void updateUserNotificationSettings({ ...notificationFlagsFor(freq), timezone: localTimezone() });
    }, [profile.id, profile.notificationFrequency, previewFixture]);

    const hasLinkedTelegram = identities.some((identity) => identity.provider === 'telegram');
    const profileDisplayName = (() => {
        const u = hasLinkedTelegram ? tgUser : null;
        const fromTg = [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim();
        return fromTg || profile.name || '—';
    })();
    const handleLanguageToggle = () => {
        const newLang: Language = profile.language === 'ru' ? 'en' : 'ru';
        const updated = { ...profile, language: newLang };
        console.log('[Settings] Language changed to:', newLang);
        onUpdate(updated);
        if (previewFixture) {
            setPreviewNotice('Язык изменён только в локальном Preview.');
            return;
        }
        saveProfile(updated).catch(error => {
            console.error('[Settings] Failed to save language:', error);
        });
    };

    const genderStorageKey = `lumia.gender.${profile.id || 'anonymous'}`;

    // Пол иногда терялся при перезагрузке профиля и сбрасывался на «не указывать».
    // Дублируем выбор в localStorage и восстанавливаем его — как частоту уведомлений.
    useEffect(() => {
        if (previewFixture) return;
        let stored: string | null = null;
        try { stored = window.localStorage.getItem(genderStorageKey); } catch { /* ignore */ }
        if (stored && ['male', 'female', 'unspecified'].includes(stored) && (profile.gender || null) !== stored) {
            const updated = { ...profile, gender: stored as 'male' | 'female' | 'unspecified' };
            onUpdate(updated);
            saveProfile(updated).catch(() => { /* ignore */ });
        }
    }, [profile.id, profile.gender, onUpdate, previewFixture]);

    const handleGenderChange = (gender: 'male' | 'female' | 'unspecified') => {
        if (previewFixture) {
            onUpdate({ ...profile, gender });
            setPreviewNotice('Пол изменён только в локальном Preview.');
            return;
        }
        try { window.localStorage.setItem(genderStorageKey, gender); } catch { /* ignore */ }
        const updated = { ...profile, gender };
        onUpdate(updated);
        saveProfile(updated).catch(error => {
            console.error('[Settings] Failed to save gender:', error);
        });
    };

    const handleSaveProfile = async () => {
        if (savingProfile) return;
        const normalizedName = (tempName || '').trim();
        if (!normalizedName) {
            setProfileSaveError(profile.language === 'en' ? 'Enter a name.' : 'Укажи имя.');
            return;
        }
        const nameChanged = normalizedName !== (profile.name || '').trim();
        if (!nameChanged || !canEditProfile) {
            setTempName(profile.name);
            setProfileSaveError('');
            setEditing(false);
            return;
        }
        const updated = { ...profile, name: normalizedName };
        if (previewFixture) {
            onUpdate(updated);
            setEditsUsed((n) => n + 1);
            setTempName(normalizedName);
            setProfileSaveError('');
            setEditing(false);
            setPreviewNotice('Профиль изменён только в локальном Preview.');
            return;
        }
        setSavingProfile(true);
        setProfileSaveError('');
        try {
            await saveProfile(updated);
            onUpdate(updated);
            recordProfileEdit(profile.id);
            setEditsUsed((n) => n + 1);
            setTempName(normalizedName);
            setEditing(false);
            console.log('[Settings] Profile saved successfully');
        } catch (error) {
            console.error('[Settings] Failed to save profile:', error);
            setProfileSaveError(profile.language === 'en'
                ? 'The profile was not saved. Check your connection and try again.'
                : 'Не удалось сохранить профиль. Проверь соединение и попробуй ещё раз.');
        } finally {
            setSavingProfile(false);
        }
    };

    const handleDeleteAccount = () => {
        if (previewFixture) {
            setPreviewNotice('В Preview удаление аккаунта отключено.');
            return;
        }
        if (!onDeleteAccount || deletingAccount) return;
        if (hasActiveRuStoreAutoRenewal) {
            const continueDeletion = window.confirm(profile.language === 'en'
                ? 'Auto-renewal is active in RuStore. Deleting this account will not cancel it automatically. Select OK to continue deleting, or Cancel to manage the subscription in RuStore first.'
                : 'В RuStore включено автопродление. Удаление аккаунта не отменит его автоматически. Нажми «ОК», чтобы продолжить удаление, или «Отмена», чтобы сначала открыть управление подпиской в RuStore.');
            if (!continueDeletion) {
                manageSubscription();
                return;
            }
        }
        if (!window.confirm(profile.language === 'en'
            ? 'Delete your account and related data permanently?'
            : 'Удалить аккаунт и связанные данные без возможности восстановления?')) return;
        setDeletionError('');
        setDeletingAccount(true);
        void onDeleteAccount().catch(() => {
            setDeletionError(profile.language === 'en'
                ? 'Account deletion did not complete. Your account is still active.'
                : 'Не удалось удалить аккаунт. Он остаётся активным.');
        }).finally(() => setDeletingAccount(false));
    };

    const handleLogout = () => {
        if (previewFixture) {
            setPreviewNotice('В Preview выход из аккаунта отключён.');
            return;
        }
        if (!onLogout || loggingOut || deletingAccount) return;
        setLogoutError('');
        setLoggingOut(true);
        void onLogout().catch(() => {
            setLogoutError(profile.language === 'en'
                ? 'Sign out did not complete. This account is still active on the device.'
                : 'Не удалось выйти. Аккаунт остаётся активным на этом устройстве.');
        }).finally(() => setLoggingOut(false));
    };

    const returnToSettingsRoot = useCallback(() => {
        if (settingsDetailBusy) return;
        setSettingsScreen('root');
        setEditing(false);
        setTempName(profile.name);
        setProfileSaveError('');
        window.requestAnimationFrame(() => {
            const target = lastRootTargetRef.current;
            if (!target) return;
            document.querySelector<HTMLButtonElement>(`[data-settings-target="${target}"]`)
                ?.focus({ preventScroll: true });
        });
    }, [profile.name, settingsDetailBusy]);

    useEffect(() => {
        if (settingsScreen === 'root') return;
        const handleNativeBack = (event: Event) => {
            returnToSettingsRoot();
            (event as CustomEvent<NativeBackEventDetail>).detail.handled = true;
        };
        window.addEventListener(NATIVE_BACK_EVENT, handleNativeBack);
        return () => window.removeEventListener(NATIVE_BACK_EVENT, handleNativeBack);
    }, [returnToSettingsRoot, settingsScreen]);

    const openSettingsScreen = (screen: Exclude<SettingsScreen, 'root'>) => {
        lastRootTargetRef.current = screen;
        setPreviewNotice('');
        setSettingsScreen(screen);
        window.requestAnimationFrame(() => {
            settingsContentRef.current?.focus({ preventScroll: true });
        });
    };

    const settingsTitle: Record<SettingsScreen, string> = profile.language === 'en'
        ? {
            root: 'Settings',
            profile: 'Profile',
            birth: 'Birth details',
            gender: 'Gender',
            notifications: 'Notifications',
            language: 'Language',
            auth: 'Sign-in methods',
            subscription: 'Subscription',
            legal: 'Legal information',
            account: 'Account and data',
            developer: 'For developers',
        }
        : {
            root: 'Настройки',
            profile: 'Профиль',
            birth: 'Данные рождения',
            gender: 'Пол',
            notifications: 'Уведомления',
            language: 'Язык',
            auth: 'Способы входа',
            subscription: 'Подписка',
            legal: 'Правовая информация',
            account: 'Аккаунт и данные',
            developer: 'Для разработчика',
        };

    const genderValue = profile.gender === 'male'
        ? (profile.language === 'en' ? 'Male' : 'Мужской')
        : profile.gender === 'female'
            ? (profile.language === 'en' ? 'Female' : 'Женский')
            : (profile.language === 'en' ? 'Not specified' : 'Не указан');


    const renderSettingsContent = () => {
        switch (settingsScreen) {
            case 'profile':
                return (
                    <section className="settings-detail-panel" aria-label={settingsTitle.profile}>
                        <div className="settings-detail-section">
                            <div className="settings-detail-heading">
                                <p className="settings-detail-kicker">
                                    {profile.isGuest
                                        ? (profile.language === 'en' ? 'Guest account' : 'Гостевой аккаунт')
                                        : hasLinkedTelegram
                                            ? (profile.language === 'en' ? 'Telegram linked' : 'Telegram подключён')
                                            : (profile.language === 'en' ? 'Account' : 'Аккаунт')}
                                </p>
                                <p className="settings-detail-name">{profileDisplayName}</p>
                            </div>
                            <div className="settings-form-field">
                                <label htmlFor="settings-profile-name">{getText(profile.language, 'settings.profile_name')}</label>
                                <input
                                    id="settings-profile-name"
                                    name="profileName"
                                    type="text"
                                    value={tempName}
                                    onChange={(event) => setTempName(event.target.value)}
                                    readOnly={!editing}
                                    aria-readonly={!editing}
                                    className="fresh-input"
                                />
                            </div>
                            {!editing ? (
                                canEditProfile ? (
                                    <button
                                        type="button"
                                        className="settings-secondary-action"
                                        onClick={() => {
                                            setTempName(profile.name);
                                            setProfileSaveError('');
                                            setEditing(true);
                                        }}
                                    >
                                        {getText(profile.language, 'settings.edit')}
                                    </button>
                                ) : (
                                    <p className="settings-helper-text">
                                        {profile.language === 'en'
                                            ? (activePremium ? 'Monthly edit limit reached.' : 'The Free profile edit was already used.')
                                            : (activePremium ? 'Лимит изменений на этот месяц исчерпан.' : 'Изменение профиля в Free уже использовано.')}
                                    </p>
                                )
                            ) : (
                                <>
                                    <p className="settings-helper-text">
                                        {profile.language === 'en'
                                            ? (activePremium ? 'Profile edits left this month: ' + profileEditsLeft : 'Free: you can change your profile once.')
                                            : (activePremium ? 'Изменений в этом месяце осталось: ' + profileEditsLeft : 'В Free профиль можно изменить один раз.')}
                                    </p>
                                    {profileSaveError ? <p role="alert" className="settings-error-text">{profileSaveError}</p> : null}
                                    <div className="settings-form-actions">
                                        <button
                                            type="button"
                                            className="fresh-btn-primary"
                                            disabled={savingProfile}
                                            aria-busy={savingProfile}
                                            onClick={() => { void handleSaveProfile(); }}
                                        >
                                            {savingProfile
                                                ? (profile.language === 'en' ? 'Saving…' : 'Сохраняем…')
                                                : getText(profile.language, 'settings.save')}
                                        </button>
                                        <button
                                            type="button"
                                            className="fresh-btn-ghost"
                                            disabled={savingProfile}
                                            onClick={() => {
                                                setEditing(false);
                                                setTempName(profile.name);
                                                setProfileSaveError('');
                                            }}
                                        >
                                            {getText(profile.language, 'settings.cancel')}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </section>
                );

            case 'birth':
                return (
                    <section className="settings-detail-panel" aria-label={settingsTitle.birth}>
                        <dl className="settings-readonly-list">
                            <div>
                                <dt>{profile.language === 'en' ? 'Birth date' : 'Дата рождения'}</dt>
                                <dd>{formatSettingsBirthDate(profile.birthDate, profile.language)}</dd>
                            </div>
                            <div>
                                <dt>{profile.language === 'en' ? 'Birth time' : 'Время рождения'}</dt>
                                <dd>{profile.birthTime || '—'}</dd>
                            </div>
                            <div>
                                <dt>{profile.language === 'en' ? 'Birth place' : 'Место рождения'}</dt>
                                <dd>{profile.birthPlace || '—'}</dd>
                            </div>
                        </dl>
                        <p className="settings-helper-text settings-helper-text--spaced">
                            {profile.language === 'en'
                                ? 'Birth details are shown as saved in your primary profile.'
                                : 'Здесь показаны данные, сохранённые в основном профиле.'}
                        </p>
                    </section>
                );

            case 'gender':
                return (
                    <section className="settings-detail-panel" aria-label={settingsTitle.gender}>
                        <p className="settings-detail-intro">
                            {profile.language === 'en'
                                ? 'This only changes grammatical forms in generated text.'
                                : 'Этот выбор нужен только для правильных форм слов в текстах.'}
                        </p>
                        <div className="settings-selection-list">
                            {([
                                ['male', 'Мужской', 'Male'],
                                ['female', 'Женский', 'Female'],
                                ['unspecified', 'Не указывать', 'Prefer not to say'],
                            ] as const).map(([value, ru, en]) => {
                                const selected = (profile.gender || 'unspecified') === value;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        className="settings-selection-row"
                                        aria-pressed={selected}
                                        onClick={() => handleGenderChange(value)}
                                    >
                                        <span>{profile.language === 'en' ? en : ru}</span>
                                        {selected ? <Check aria-hidden size={16} strokeWidth={2} /> : null}
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                );

            case 'notifications':
                return (
                    <section className="settings-detail-panel" aria-label={settingsTitle.notifications}>
                        <div className="settings-toggle-row">
                            <label htmlFor="settings-notifications-toggle">{profile.language === 'en' ? 'Notifications' : 'Уведомления'}</label>
                            <button
                                id="settings-notifications-toggle"
                                type="button"
                                role="switch"
                                aria-checked={notifEnabled}
                                className={'settings-switch' + (notifEnabled ? ' settings-switch--on' : '')}
                                onClick={toggleNotif}
                            >
                                <span aria-hidden />
                            </button>
                        </div>
                        {notifEnabled ? (
                            <div className="settings-detail-section settings-detail-section--separated">
                                <h2>{profile.language === 'en' ? 'Quiet hours' : 'Тихие часы'}</h2>
                                <div className="settings-time-grid">
                                    <label htmlFor="settings-quiet-start">{profile.language === 'en' ? 'From' : 'С'}</label>
                                    <label htmlFor="settings-quiet-end">{profile.language === 'en' ? 'Until' : 'До'}</label>
                                    <input
                                        id="settings-quiet-start"
                                        name="quietStart"
                                        type="time"
                                        value={quietStart}
                                        onChange={(event) => changeQuiet('start', event.target.value)}
                                        className="fresh-input"
                                    />
                                    <input
                                        id="settings-quiet-end"
                                        name="quietEnd"
                                        type="time"
                                        value={quietEnd}
                                        onChange={(event) => changeQuiet('end', event.target.value)}
                                        className="fresh-input"
                                    />
                                </div>
                                <p className="settings-helper-text">
                                    {profile.language === 'en'
                                        ? 'We do not send notifications during this interval.'
                                        : 'В этот промежуток уведомления не приходят.'}
                                </p>
                            </div>
                        ) : null}
                    </section>
                );

            case 'language':
                return (
                    <section className="settings-detail-panel" aria-label={settingsTitle.language}>
                        <div className="settings-selection-list">
                            {([
                                ['ru', 'Русский'],
                                ['en', 'English'],
                            ] as const).map(([value, label]) => {
                                const selected = profile.language === value;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        className="settings-selection-row"
                                        aria-pressed={selected}
                                        onClick={() => {
                                            if (!selected) handleLanguageToggle();
                                        }}
                                    >
                                        <span>{label}</span>
                                        {selected ? <Check aria-hidden size={16} strokeWidth={2} /> : null}
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                );

            case 'auth':
                return (
                    <section id="recovery-identity" className="settings-detail-panel" aria-label={settingsTitle.auth}>
                        {recoveryIdentityRequired ? (
                            <p className="settings-recovery-notice" role="status">
                                {profile.language === 'en'
                                    ? 'Link VK ID, Yandex or email to restore Premium on another device. Your selected subscription is saved.'
                                    : 'Привяжи VK ID, Яндекс или email, чтобы Premium можно было восстановить на другом устройстве. Выбранный тариф сохранён.'}
                            </p>
                        ) : null}
                        <p className="settings-detail-intro">
                            {profile.language === 'en'
                                ? 'Every linked method opens this same account with its chart, history, settings and Premium.'
                                : 'Каждый способ входа открывает этот же аккаунт с картой, историей, настройками и Premium.'}
                        </p>
                        <p className="settings-helper-text">
                            {profile.language === 'en'
                                ? 'Two existing profiles are never merged automatically.'
                                : 'Два существующих профиля автоматически не объединяются.'}
                        </p>
                        <button
                            type="button"
                            className="settings-text-action"
                            onClick={() => setAuthPurpose((value) => value === 'link' ? 'login' : 'link')}
                        >
                            {authPurpose === 'link'
                                ? (profile.language === 'en' ? 'Sign in to another account' : 'Войти в другой аккаунт')
                                : (profile.language === 'en' ? 'Link a method to this account' : 'Привязать способ к этому аккаунту')}
                        </button>
                        {authPurpose === 'login' ? (
                            <p className="settings-helper-text">
                                {profile.language === 'en'
                                    ? 'Signing in switches to the existing account; current data is not merged into it.'
                                    : 'Вход переключит приложение на существующий аккаунт. Данные текущего профиля в него не переносятся.'}
                            </p>
                        ) : null}
                        {identities.length ? (
                            <div className="settings-identity-list" aria-label={profile.language === 'en' ? 'Linked methods' : 'Подключённые способы'}>
                                {identities.map((identity) => (
                                    <div className="settings-identity-row" key={identity.provider}>
                                        <span>{IDENTITY_LABELS[identity.provider]}</span>
                                        <span>{identity.provider === 'email' && identity.email ? identity.email : (profile.language === 'en' ? 'Linked' : 'Подключён')}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        {identityLoadFailed ? (
                            <div className="settings-inline-error">
                                <p>{profile.language === 'en' ? 'Could not load sign-in methods.' : 'Не удалось загрузить способы входа.'}</p>
                                <button type="button" onClick={() => setIdentityReload((value) => value + 1)}>
                                    {profile.language === 'en' ? 'Retry' : 'Повторить'}
                                </button>
                            </div>
                        ) : null}
                        <div className="settings-auth-actions">
                            {!previewFixture && hasTelegramMiniAppContext() && !identities.some((identity) => identity.provider === 'telegram') ? (
                                <button
                                    type="button"
                                    className="fresh-btn-ghost"
                                    disabled={identityBusy || authPurpose === 'login'}
                                    onClick={linkTelegram}
                                >
                                    Telegram
                                </button>
                            ) : null}
                            {(['vk', 'yandex', 'google'] as const)
                                .filter((provider) => authCapabilities?.[provider] === true)
                                .filter((provider) => authPurpose === 'login' || !identities.some((identity) => identity.provider === provider))
                                .map((provider) => (
                                    <button
                                        key={provider}
                                        type="button"
                                        className="fresh-btn-ghost"
                                        disabled={identityBusy}
                                        onClick={() => linkOAuth(provider)}
                                    >
                                        {provider === 'vk' ? 'VK ID' : provider === 'yandex' ? 'Яндекс ID' : 'Google'}
                                    </button>
                                ))}
                        </div>
                        {(authPurpose === 'login'
                            ? authCapabilities?.emailPassword
                            : authCapabilities?.emailDelivery)
                            && (authPurpose === 'login' || !identities.some((identity) => identity.provider === 'email')) ? (
                            <div className="settings-auth-form">
                                <input
                                    className="fresh-input"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    value={emailValue}
                                    onChange={(event) => setEmailValue(event.target.value)}
                                    placeholder={profile.language === 'en' ? 'Email' : 'Email для входа'}
                                    aria-label={profile.language === 'en' ? 'Email' : 'Email для входа'}
                                />
                                {!emailChallengeId ? (
                                    <div className="settings-password-field">
                                        <input
                                            className="fresh-input"
                                            name="password"
                                            type={emailPasswordVisible ? 'text' : 'password'}
                                            autoComplete={authPurpose === 'login' ? 'current-password' : 'new-password'}
                                            value={emailPassword}
                                            onChange={(event) => setEmailPassword(event.target.value)}
                                            placeholder={authPurpose === 'login'
                                                ? (profile.language === 'en' ? 'Password' : 'Пароль')
                                                : (profile.language === 'en' ? 'At least 8 characters' : 'Не менее 8 символов')}
                                            aria-label={profile.language === 'en' ? 'Password' : 'Пароль'}
                                        />
                                        <button
                                            type="button"
                                            aria-label={emailPasswordVisible
                                                ? (profile.language === 'en' ? 'Hide password' : 'Скрыть пароль')
                                                : (profile.language === 'en' ? 'Show password' : 'Показать пароль')}
                                            aria-pressed={emailPasswordVisible}
                                            disabled={identityBusy}
                                            onClick={() => setEmailPasswordVisible((visible) => !visible)}
                                        >
                                            {emailPasswordVisible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                                        </button>
                                    </div>
                                ) : null}
                                {authPurpose === 'link' && !emailChallengeId ? (
                                    <div className="settings-password-field">
                                        <input
                                            className="fresh-input"
                                            name="passwordConfirmation"
                                            type={emailPasswordConfirmationVisible ? 'text' : 'password'}
                                            autoComplete="new-password"
                                            value={emailPasswordConfirmation}
                                            onChange={(event) => setEmailPasswordConfirmation(event.target.value)}
                                            placeholder={profile.language === 'en' ? 'Repeat password' : 'Повторите пароль'}
                                            aria-label={profile.language === 'en' ? 'Repeat password' : 'Повторите пароль'}
                                        />
                                        <button
                                            type="button"
                                            aria-label={emailPasswordConfirmationVisible
                                                ? (profile.language === 'en' ? 'Hide repeated password' : 'Скрыть повтор пароля')
                                                : (profile.language === 'en' ? 'Show repeated password' : 'Показать повтор пароля')}
                                            aria-pressed={emailPasswordConfirmationVisible}
                                            disabled={identityBusy}
                                            onClick={() => setEmailPasswordConfirmationVisible((visible) => !visible)}
                                        >
                                            {emailPasswordConfirmationVisible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                                        </button>
                                    </div>
                                ) : null}
                                {emailChallengeId ? (
                                    <div className="settings-code-row">
                                        <input
                                            className="fresh-input"
                                            name="emailCode"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            value={emailCode}
                                            onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                            placeholder={profile.language === 'en' ? '6-digit code' : 'Код из письма'}
                                            aria-label={profile.language === 'en' ? '6-digit code' : 'Код из письма'}
                                        />
                                        <button type="button" className="fresh-btn-ghost" disabled={identityBusy || emailCode.length !== 6} onClick={confirmEmailCode}>
                                            {profile.language === 'en' ? 'Confirm' : 'Подтвердить'}
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        className="fresh-btn-ghost"
                                        disabled={identityBusy || !emailValue.trim() || !emailPassword || (authPurpose === 'link' && (!meetsMinimumPasswordLength(emailPassword) || emailPassword !== emailPasswordConfirmation))}
                                        onClick={requestEmailCode}
                                    >
                                        {authPurpose === 'login'
                                            ? (profile.language === 'en' ? 'Sign in' : 'Войти')
                                            : (profile.language === 'en' ? 'Send code' : 'Отправить код')}
                                    </button>
                                )}
                                {emailChallengeId ? (
                                    <button type="button" className="settings-text-action" disabled={identityBusy} onClick={requestEmailCode}>
                                        {profile.language === 'en' ? 'Send a new code' : 'Отправить новый код'}
                                    </button>
                                ) : null}
                            </div>
                        ) : null}
                        {identityNotice ? <p role="status" className="settings-helper-text">{identityNotice}</p> : null}
                        {identityError ? <p role="alert" className="settings-error-text">{identityError}</p> : null}
                    </section>
                );

            case 'subscription':
                return (
                    <section className="settings-detail-panel" aria-label={settingsTitle.subscription}>
                        <div className="settings-subscription-status">
                            <span>{activePremium ? 'Premium' : 'Free'}</span>
                            <h2>{subscriptionPresentation.title}</h2>
                            <p>{subscriptionPresentation.body}</p>
                        </div>
                        <div className="settings-detail-actions">
                            {subscriptionPresentation.shouldPromote && canPromotePremium ? (
                                <button type="button" className="fresh-btn-primary" onClick={() => onRequestPremium?.()}>
                                    {profile.language === 'ru' ? 'Посмотреть Premium' : 'View Premium'}
                                </button>
                            ) : null}
                            {subscriptionPresentation.canManageInStore && onManageSubscription ? (
                                <button type="button" className="fresh-btn-ghost" onClick={manageSubscription}>
                                    {profile.language === 'ru' ? 'Управлять в RuStore' : 'Manage in RuStore'}
                                </button>
                            ) : null}
                            <button
                                type="button"
                                className="fresh-btn-ghost"
                                disabled={!onRestorePurchase || restoreState === 'running'}
                                aria-busy={restoreState === 'running'}
                                onClick={restorePurchase}
                            >
                                {restoreState === 'running'
                                    ? (profile.language === 'ru' ? 'Проверяем…' : 'Checking…')
                                    : (profile.language === 'ru' ? 'Восстановить покупку' : 'Restore purchase')}
                            </button>
                        </div>
                        {restoreState === 'success' ? (
                            <p role="status" className="settings-helper-text">
                                {profile.language === 'ru' ? 'Покупки проверены сервером.' : 'Purchases were checked by the server.'}
                            </p>
                        ) : restoreState === 'error' ? (
                            <p role="alert" className="settings-error-text">
                                {profile.language === 'ru' ? 'Не удалось восстановить покупку. Проверь RuStore и интернет.' : 'Could not restore the purchase. Check RuStore and your connection.'}
                            </p>
                        ) : null}
                    </section>
                );

            case 'legal':
                return (
                    <section className="settings-detail-panel" aria-label={settingsTitle.legal}>
                        <div className="settings-list">
                            <a className="settings-list-row" href={releaseConfig.privacyUrl} target="_blank" rel="noreferrer" onClick={blockPreviewLink}>
                                <span className="settings-list-row-main">
                                    <span className="settings-list-row-label">{profile.language === 'en' ? 'Privacy Policy' : 'Политика конфиденциальности'}</span>
                                </span>
                                <span className="settings-list-row-end"><ChevronRight aria-hidden size={16} strokeWidth={1.8} /></span>
                            </a>
                            <a className="settings-list-row" href={releaseConfig.termsUrl} target="_blank" rel="noreferrer" onClick={blockPreviewLink}>
                                <span className="settings-list-row-main">
                                    <span className="settings-list-row-label">{profile.language === 'en' ? 'User Agreement' : 'Пользовательское соглашение'}</span>
                                </span>
                                <span className="settings-list-row-end"><ChevronRight aria-hidden size={16} strokeWidth={1.8} /></span>
                            </a>
                        </div>
                    </section>
                );

            case 'account':
                return (
                    <section className="settings-detail-panel" aria-label={settingsTitle.account}>
                        <div className="settings-account-actions">
                            <button type="button" disabled={loggingOut || deletingAccount} onClick={handleLogout}>
                                {loggingOut
                                    ? (profile.language === 'en' ? 'Signing out…' : 'Выходим…')
                                    : (profile.language === 'en' ? 'Sign out' : 'Выйти')}
                            </button>
                            <button type="button" className="settings-danger-action" disabled={loggingOut || deletingAccount} onClick={handleDeleteAccount}>
                                {deletingAccount
                                    ? (profile.language === 'en' ? 'Deleting…' : 'Удаляем…')
                                    : (profile.language === 'en' ? 'Delete account' : 'Удалить аккаунт')}
                            </button>
                        </div>
                        <p className="settings-helper-text settings-helper-text--spaced">
                            {profile.language === 'en'
                                ? 'Deleting an account permanently removes its related data. Active RuStore auto-renewal must be managed separately.'
                                : 'Удаление аккаунта навсегда удаляет связанные с ним данные. Активным автопродлением RuStore нужно управлять отдельно.'}
                        </p>
                        {logoutError ? <p role="alert" className="settings-error-text">{logoutError}</p> : null}
                        {deletionError ? <p role="alert" className="settings-error-text">{deletionError}</p> : null}
                    </section>
                );

            case 'developer':
                return (
                    <section className="settings-detail-panel" aria-label={settingsTitle.developer}>
                        {onOpenAdmin ? (
                            <div className="settings-list">
                                <SettingsRow
                                    label={getText(profile.language, 'settings.admin')}
                                    icon={<Code2 size={16} strokeWidth={1.8} />}
                                    onClick={onOpenAdmin}
                                />
                            </div>
                        ) : null}
                        <div className="settings-developer-actions">
                            <button type="button" onClick={sendSelfTest} disabled={selfTest === 'sending'}>
                                <span>{profile.language === 'en' ? 'Send a test notification' : 'Прислать тест-уведомление'}</span>
                                <small>
                                    {selfTest === 'sending'
                                        ? (profile.language === 'en' ? 'Sending…' : 'Отправляю…')
                                        : selfTest === 'ok'
                                            ? (profile.language === 'en' ? 'Sent' : 'Отправлено')
                                            : selfTest === 'err'
                                                ? (selfTestInfo || (profile.language === 'en' ? 'Failed' : 'Не вышло'))
                                                : (profile.language === 'en' ? 'Telegram end-to-end check' : 'Проверка доставки в Telegram')}
                                </small>
                            </button>
                            <button type="button" onClick={sendDailyPush} disabled={dailyPush === 'sending'}>
                                <span>{profile.language === 'en' ? 'Send my daily push now' : 'Прислать дневной пуш сейчас'}</span>
                                <small>
                                    {dailyPush === 'sending'
                                        ? (profile.language === 'en' ? 'Sending…' : 'Отправляю…')
                                        : dailyPush === 'ok'
                                            ? (dailyPushInfo || (profile.language === 'en' ? 'Sent' : 'Отправлено'))
                                            : dailyPush === 'err'
                                                ? (dailyPushInfo || (profile.language === 'en' ? 'Failed' : 'Не вышло'))
                                                : (profile.language === 'en' ? 'Admin-only delivery check' : 'Проверка доставки для администратора')}
                                </small>
                            </button>
                        </div>
                    </section>
                );

            case 'root':
            default:
                return (
                    <div className="settings-root">
                        <section className="settings-group" aria-labelledby="settings-account-heading">
                            <h2 id="settings-account-heading">{profile.language === 'en' ? 'Account' : 'Аккаунт'}</h2>
                            <div className="settings-list">
                                <SettingsRow
                                    icon={<UserRound size={16} strokeWidth={1.8} />}
                                    label={profile.language === 'en' ? 'Profile' : 'Профиль'}
                                    value={profileDisplayName}
                                    target="profile"
                                    onClick={() => openSettingsScreen('profile')}
                                />
                                <SettingsRow
                                    icon={<Cake size={16} strokeWidth={1.8} />}
                                    label={profile.language === 'en' ? 'Birth details' : 'Данные рождения'}
                                    value={formatSettingsBirthDate(profile.birthDate, profile.language)}
                                    target="birth"
                                    onClick={() => openSettingsScreen('birth')}
                                />
                                <SettingsRow
                                    icon={<VenusAndMars size={16} strokeWidth={1.8} />}
                                    label={profile.language === 'en' ? 'Gender' : 'Пол'}
                                    value={genderValue}
                                    target="gender"
                                    onClick={() => openSettingsScreen('gender')}
                                />
                                <SettingsRow
                                    icon={<LogIn size={16} strokeWidth={1.8} />}
                                    label={profile.language === 'en' ? 'Sign-in methods' : 'Способы входа'}
                                    value={identityLoadFailed ? (profile.language === 'en' ? 'Unavailable' : 'Не загружены') : identityCountLabel(identities.length, profile.language)}
                                    target="auth"
                                    onClick={() => openSettingsScreen('auth')}
                                />
                            </div>
                        </section>

                        <section className="settings-group" aria-labelledby="settings-app-heading">
                            <h2 id="settings-app-heading">{profile.language === 'en' ? 'Application' : 'Приложение'}</h2>
                            <div className="settings-list">
                                <SettingsRow
                                    icon={<Bell size={16} strokeWidth={1.8} />}
                                    label={profile.language === 'en' ? 'Notifications' : 'Уведомления'}
                                    value={notifEnabled ? (profile.language === 'en' ? 'On' : 'Включены') : (profile.language === 'en' ? 'Off' : 'Выключены')}
                                    target="notifications"
                                    onClick={() => openSettingsScreen('notifications')}
                                />
                                <SettingsRow
                                    icon={<Languages size={16} strokeWidth={1.8} />}
                                    label={profile.language === 'en' ? 'Language' : 'Язык'}
                                    value={languageLabel}
                                    target="language"
                                    onClick={() => openSettingsScreen('language')}
                                />
                                {onOpenCharts ? (
                                    <SettingsRow
                                        icon={<Files size={16} strokeWidth={1.8} />}
                                        label={profile.language === 'en' ? 'Saved charts' : 'Сохранённые карты'}
                                        onClick={onOpenCharts}
                                    />
                                ) : null}
                            </div>
                        </section>

                        <section className="settings-group" aria-labelledby="settings-premium-heading">
                            <h2 id="settings-premium-heading">Premium</h2>
                            <div className="settings-list">
                                <SettingsRow
                                    icon={<BadgeCheck size={16} strokeWidth={1.8} />}
                                    label={profile.language === 'en' ? 'Subscription' : 'Подписка'}
                                    value={activePremium ? 'Premium' : 'Free'}
                                    target="subscription"
                                    onClick={() => openSettingsScreen('subscription')}
                                />
                            </div>
                        </section>

                        <section className="settings-group" aria-labelledby="settings-help-heading">
                            <h2 id="settings-help-heading">{profile.language === 'en' ? 'Help' : 'Помощь'}</h2>
                            <div className="settings-list">
                                <a className="settings-list-row" href={'mailto:' + releaseConfig.supportEmail} onClick={blockPreviewLink}>
                                    <span className="settings-list-row-main">
                                        <span className="settings-list-row-icon" aria-hidden><LifeBuoy size={16} strokeWidth={1.8} /></span>
                                        <span className="settings-list-row-label">{profile.language === 'en' ? 'Support' : 'Поддержка'}</span>
                                    </span>
                                    <span className="settings-list-row-end"><ChevronRight aria-hidden size={16} strokeWidth={1.8} /></span>
                                </a>
                                <SettingsRow
                                    icon={<Scale size={16} strokeWidth={1.8} />}
                                    label={profile.language === 'en' ? 'Legal information' : 'Правовая информация'}
                                    target="legal"
                                    onClick={() => openSettingsScreen('legal')}
                                />
                            </div>
                        </section>

                        <section className="settings-group settings-group--last" aria-labelledby="settings-data-heading">
                            <h2 id="settings-data-heading">{profile.language === 'en' ? 'Account actions' : 'Действия с аккаунтом'}</h2>
                            <div className="settings-list">
                                {profile.isAdmin ? (
                                    <SettingsRow
                                        icon={<Code2 size={16} strokeWidth={1.8} />}
                                        label={profile.language === 'en' ? 'For developers' : 'Для разработчика'}
                                        target="developer"
                                        onClick={() => openSettingsScreen('developer')}
                                    />
                                ) : null}
                                <SettingsRow
                                    icon={<Database size={16} strokeWidth={1.8} />}
                                    label={profile.language === 'en' ? 'Account and data' : 'Аккаунт и данные'}
                                    target="account"
                                    onClick={() => openSettingsScreen('account')}
                                />
                            </div>
                        </section>
                    </div>
                );
        }
    };

    return (
        <div className="fresh-page settings-editorial-page">
            <AppTopBar
                title={settingsTitle[settingsScreen]}
                onBack={settingsScreen === 'root'
                    ? onBack
                    : settingsDetailBusy
                        ? undefined
                        : returnToSettingsRoot}
            />
            <div
                ref={settingsContentRef}
                className="settings-editorial-content"
                tabIndex={-1}
                aria-label={settingsTitle[settingsScreen]}
            >
                {previewNotice ? <p role="status" className="settings-preview-notice">{previewNotice}</p> : null}
                {renderSettingsContent()}
            </div>
        </div>
    );
};
