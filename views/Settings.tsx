
import React, { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { UserProfile, Language, NotificationFrequency } from '../types';
import { getText } from '../constants';
import { saveProfile } from '../services/storageService';
import { updateUserNotificationSettings, getUserNotificationSettings, getTelegramInitDataHeaders } from '../services/sessionService';
import { hasActivePremium } from '../lib/accessMatrix';
import { describePremiumEntitlement } from '../lib/subscriptionPresentation';
import { AppTopBar } from '../components/lumia-ui/AppTopBar';
import { EditorialProfileButton } from '../components/editorial/EditorialScreenChrome';
import { apiFetch } from '../services/apiClient';
import { STORE_RELEASE_CONFIG as releaseConfig } from '../lib/storeReleaseConfig';
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

interface SettingsProps {
    profile: UserProfile;
    onUpdate: (profile: UserProfile) => void;
    onRequestPremium?: () => void;
    canPromotePremium?: boolean;
    onRestorePurchase?: () => Promise<void>;
    onManageSubscription?: () => Promise<void> | void;
    onOpenAdmin?: () => void;
    onOpenCharts?: () => void;
    onOpenProfile: () => void;
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
    onOpenProfile,
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
    const [tempPlace, setTempPlace] = useState(profile.birthPlace);
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
    const sectionClass = 'settings-editorial-section';
    const rowCardClass =
        'settings-editorial-row w-full text-left transition-transform active:scale-[0.99]';
    const inlineActionClass = 'text-mono-muted text-[10px] uppercase tracking-wider hover:text-mono-ink transition-colors';
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
    const profilePhotoUrl = hasLinkedTelegram ? tgUser?.photo_url : undefined;


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

    const handleSaveProfile = () => {
        const nameChanged = (tempName || '') !== (profile.name || '');
        const placeChanged = (tempPlace || '') !== (profile.birthPlace || '');
        if ((!nameChanged && !placeChanged) || !canEditProfile) {
            setEditing(false);
            return;
        }
        const updated = { ...profile, name: tempName, birthPlace: tempPlace };
        onUpdate(updated);
        if (previewFixture) {
            setEditsUsed((n) => n + 1);
            setEditing(false);
            setPreviewNotice('Профиль изменён только в локальном Preview.');
            return;
        }
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
        <div className="fresh-page settings-editorial-page">
          <AppTopBar
            title={profile.language === 'en' ? 'Settings' : 'Настройки'}
            rightAction={(
              <EditorialProfileButton
                label={profile.language === 'en' ? 'Open profile' : 'Открыть профиль'}
                onClick={onOpenProfile}
              />
            )}
          />
          <div className="settings-editorial-content">
            {previewNotice ? (
                <p role="status" className="settings-editorial-section lumia-muted text-sm">
                    {previewNotice}
                </p>
            ) : null}
            <section className="settings-editorial-profile">
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
                        <p className="mt-0.5 text-xs text-text-muted/80">
                            {profile.isGuest
                                ? (profile.language === 'en' ? 'Guest account' : 'Гостевой аккаунт')
                                : hasLinkedTelegram
                                    ? (profile.language === 'en' ? 'Telegram linked' : 'Telegram подключён')
                                    : (profile.language === 'en' ? 'Account' : 'Аккаунт')}
                        </p>
                    </div>
                </div>
            </section>

            <section className={`${sectionClass} settings-editorial-premium`}>
                <p className="lumia-label tracking-[0.2em]">{getText(profile.language, 'settings.subscription')}</p>
                <h2 className="mt-1.5 font-serif text-xl text-mono-ink sm:text-2xl">
                    {subscriptionPresentation.title}
                </h2>
                <p className="lumia-muted mt-2 text-sm leading-relaxed">
                    {subscriptionPresentation.body}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                    {subscriptionPresentation.shouldPromote && canPromotePremium ? (
                        <button
                            type="button"
                            onClick={() => onRequestPremium?.()}
                            className="fresh-btn-primary"
                            style={{ flex: 1, width: 'auto', margin: 0 }}
                        >
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
                    <p role="status" className="lumia-muted mt-2 text-sm">
                        {profile.language === 'ru' ? 'Покупки проверены сервером.' : 'Purchases were checked by the server.'}
                    </p>
                ) : restoreState === 'error' ? (
                    <p role="alert" className="mt-2 text-sm text-red-700">
                        {profile.language === 'ru' ? 'Не удалось восстановить покупку. Проверь RuStore и интернет.' : 'Could not restore the purchase. Check RuStore and your connection.'}
                    </p>
                ) : null}
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
                            {profile.language === 'en' ? 'Forecast and update notifications.' : 'Уведомления о прогнозах и обновлениях.'}
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
                                            ? (selfTestInfo
                                                ? (profile.language === 'en' ? `Failed — ${selfTestInfo}` : `Не вышло — ${selfTestInfo}`)
                                                : (profile.language === 'en' ? 'Failed.' : 'Не вышло.'))
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

            <section id="recovery-identity" className={sectionClass}>
                <h3 className="font-serif text-lg text-mono-ink">
                    {profile.language === 'en' ? 'Sign-in methods' : 'Способы входа'}
                </h3>
                {recoveryIdentityRequired ? (
                    <p className="mt-2 rounded-2xl bg-[#eef5f1] px-4 py-3 text-sm leading-5 text-[#315348]" role="status">
                        {profile.language === 'en'
                            ? 'Link VK ID, Yandex or email to restore Premium on another device. Your selected subscription is saved.'
                            : 'Привяжи VK ID, Яндекс или email, чтобы Premium можно было восстановить на другом устройстве. Выбранный тариф сохранён.'}
                    </p>
                ) : null}
                <p className="lumia-muted mt-1 text-sm">
                    {profile.language === 'en'
                        ? 'Every linked method opens this same account with its chart, history, settings and Premium.'
                        : 'Каждый привязанный способ открывает этот же аккаунт с картой, историей, настройками и Premium.'}
                </p>
                <p className="mt-1 text-xs text-mono-muted">
                    {profile.language === 'en'
                        ? 'Two existing profiles are never merged automatically. To switch accounts, choose sign in below.'
                        : 'Два существующих профиля никогда не объединяются автоматически. Чтобы сменить аккаунт, выбери вход ниже.'}
                </p>
                <button
                    type="button"
                    className="mt-2 text-sm font-medium text-mono-accent"
                    onClick={() => setAuthPurpose((value) => value === 'link' ? 'login' : 'link')}
                >
                    {authPurpose === 'link'
                        ? (profile.language === 'en' ? 'Sign in to another account' : 'Войти в другой аккаунт')
                        : (profile.language === 'en' ? 'Link a method to this account' : 'Привязать способ к этому аккаунту')}
                </button>
                {authPurpose === 'login' ? (
                    <p className="mt-2 text-xs text-mono-muted">
                        {profile.language === 'en'
                            ? 'Signing in switches to the existing account; current data is not merged into it.'
                            : 'Вход переключит приложение на существующий аккаунт. Данные текущего профиля в него не переносятся.'}
                    </p>
                ) : null}
                {identities.length ? (
                    <div className="mt-2 flex flex-wrap gap-2 text-sm text-mono-ink">
                        {identities.map((identity) => (
                            <span key={identity.provider} className="rounded-full bg-black/5 px-3 py-1.5">
                                {IDENTITY_LABELS[identity.provider]}{identity.provider === 'email' && identity.email ? `: ${identity.email}` : ''} · {profile.language === 'en' ? 'linked' : 'подключён'}
                            </span>
                        ))}
                    </div>
                ) : null}
                {identityLoadFailed ? (
                    <div className="mt-2 text-sm text-red-700">
                        <p>{profile.language === 'en' ? 'Could not load sign-in methods.' : 'Не удалось загрузить способы входа.'}</p>
                        <button type="button" className="mt-1 font-medium underline" onClick={() => setIdentityReload((value) => value + 1)}>
                            {profile.language === 'en' ? 'Retry' : 'Повторить'}
                        </button>
                    </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
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
                    <div className="mt-3 grid gap-2">
                        <input
                            className="fresh-input"
                            type="email"
                            autoComplete="email"
                            value={emailValue}
                            onChange={(event) => setEmailValue(event.target.value)}
                            placeholder={profile.language === 'en' ? 'Email' : 'Email для входа'}
                            aria-label={profile.language === 'en' ? 'Email' : 'Email для входа'}
                        />
                        {!emailChallengeId ? (
                            <div className="relative">
                                <input
                                    className="fresh-input pr-12"
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
                                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-2xl text-mono-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-mono-accent disabled:opacity-50"
                                    aria-label={emailPasswordVisible
                                        ? (profile.language === 'en' ? 'Hide password' : 'Скрыть пароль')
                                        : (profile.language === 'en' ? 'Show password' : 'Показать пароль')}
                                    aria-pressed={emailPasswordVisible}
                                    disabled={identityBusy}
                                    onClick={() => setEmailPasswordVisible((visible) => !visible)}
                                >
                                    {emailPasswordVisible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                                </button>
                            </div>
                        ) : null}
                        {authPurpose === 'link' && !emailChallengeId ? (
                            <div className="relative">
                                <input
                                    className="fresh-input pr-12"
                                    type={emailPasswordConfirmationVisible ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    value={emailPasswordConfirmation}
                                    onChange={(event) => setEmailPasswordConfirmation(event.target.value)}
                                    placeholder={profile.language === 'en' ? 'Repeat password' : 'Повторите пароль'}
                                    aria-label={profile.language === 'en' ? 'Repeat password' : 'Повторите пароль'}
                                />
                                <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-2xl text-mono-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-mono-accent disabled:opacity-50"
                                    aria-label={emailPasswordConfirmationVisible
                                        ? (profile.language === 'en' ? 'Hide repeated password' : 'Скрыть повтор пароля')
                                        : (profile.language === 'en' ? 'Show repeated password' : 'Показать повтор пароля')}
                                    aria-pressed={emailPasswordConfirmationVisible}
                                    disabled={identityBusy}
                                    onClick={() => setEmailPasswordConfirmationVisible((visible) => !visible)}
                                >
                                    {emailPasswordConfirmationVisible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                                </button>
                            </div>
                        ) : null}
                        {emailChallengeId ? (
                            <div className="flex gap-2">
                                <input
                                    className="fresh-input min-w-0 flex-1"
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
                            <button type="button" className="text-left text-sm font-medium text-mono-accent" disabled={identityBusy} onClick={requestEmailCode}>
                                {profile.language === 'en' ? 'Send a new code' : 'Отправить новый код'}
                            </button>
                        ) : null}
                    </div>
                ) : null}
                {identityNotice ? <p role="status" className="mt-2 text-sm text-mono-muted">{identityNotice}</p> : null}
                {identityError ? <p role="alert" className="mt-2 text-sm text-red-700">{identityError}</p> : null}
            </section>

            <section className={sectionClass}>
                <h3 className="font-serif text-lg text-mono-ink">{profile.language === 'en' ? 'Legal and support' : 'Правовая информация и поддержка'}</h3>
                <div className="mt-3 grid gap-2 text-sm">
                    <a className="fresh-btn-ghost text-left" href={releaseConfig.privacyUrl} target="_blank" rel="noreferrer" onClick={blockPreviewLink}>{profile.language === 'en' ? 'Privacy Policy' : 'Политика конфиденциальности'}</a>
                    <a className="fresh-btn-ghost text-left" href={releaseConfig.termsUrl} target="_blank" rel="noreferrer" onClick={blockPreviewLink}>{profile.language === 'en' ? 'User Agreement' : 'Пользовательское соглашение'}</a>
                    <a className="fresh-btn-ghost text-left" href={`mailto:${releaseConfig.supportEmail}`} onClick={blockPreviewLink}>{profile.language === 'en' ? 'Support' : 'Поддержка'}</a>
                </div>
            </section>

            <section className={`${sectionClass} border border-red-200`}>
                <h3 className="font-serif text-lg text-mono-ink">{profile.language === 'en' ? 'Account and data' : 'Аккаунт и данные'}</h3>
                <p className="lumia-muted mt-1 text-sm">{profile.language === 'en' ? 'Sign out from this device or permanently delete your account and related data.' : 'Можно выйти с этого устройства или навсегда удалить аккаунт и связанные данные.'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                    <button
                        type="button"
                        className="fresh-btn-ghost"
                        disabled={loggingOut || deletingAccount}
                        onClick={() => {
                            if (previewFixture) {
                                setPreviewNotice('В Preview выход из аккаунта отключён.');
                                return;
                            }
                            if (!onLogout) return;
                            setLogoutError('');
                            setLoggingOut(true);
                            void onLogout().catch(() => {
                                setLogoutError(profile.language === 'en'
                                    ? 'Sign out did not complete. This account is still active on the device.'
                                    : 'Не удалось выйти. Аккаунт остаётся активным на этом устройстве.');
                            }).finally(() => setLoggingOut(false));
                        }}
                    >
                        {loggingOut
                            ? (profile.language === 'en' ? 'Signing out…' : 'Выходим…')
                            : (profile.language === 'en' ? 'Sign out' : 'Выйти')}
                    </button>
                    <button type="button" disabled={deletingAccount} className="fresh-btn-ghost text-red-700" onClick={() => {
                        if (previewFixture) {
                            setPreviewNotice('В Preview удаление аккаунта отключено.');
                            return;
                        }
                        if (!window.confirm(profile.language === 'en' ? 'Delete your account and related data permanently?' : 'Удалить аккаунт и связанные данные без возможности восстановления?')) return;
                        setDeletionError('');
                        setDeletingAccount(true);
                        void onDeleteAccount?.().catch(() => {
                            setDeletionError(profile.language === 'en'
                                ? 'Account deletion did not complete. Your account is still active.'
                                : 'Не удалось удалить аккаунт. Он остаётся активным.');
                        }).finally(() => setDeletingAccount(false));
                    }}>{deletingAccount ? (profile.language === 'en' ? 'Deleting…' : 'Удаляем…') : (profile.language === 'en' ? 'Delete account' : 'Удалить аккаунт')}</button>
                </div>
                {logoutError ? <p role="alert" className="mt-2 text-sm text-red-700">{logoutError}</p> : null}
                {deletionError ? <p role="alert" className="mt-2 text-sm text-red-700">{deletionError}</p> : null}
            </section>

          </div>
        </div>
    );
};
