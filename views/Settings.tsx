
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Check,
    ChevronLeft,
    ChevronDown,
    ChevronRight,
    Code2,
    Eye,
    EyeOff,
    Trash2,
    X,
} from 'lucide-react';
import { UserProfile, Language, NotificationFrequency } from '../types';
import { getText } from '../constants';
import { saveProfile } from '../services/storageService';
import { saveServerAuthoritativeGender } from '../lib/settingsGender';
import {
    clearQueuedUserAppEvents,
    updateUserNotificationSettings,
    getUserNotificationSettings,
    getTelegramInitDataHeaders,
} from '../services/sessionService';
import { hasActivePremium } from '../lib/accessMatrix';
import { describePremiumEntitlement } from '../lib/subscriptionPresentation';
import { AppTopBar } from '../components/lumia-ui/AppTopBar';
import { AvatarCircle, AvatarPicker } from '../components/nebo/AvatarPicker';
import { useCtaStyle, useThemePref, type CtaStyle } from '../lib/theme';
import { useAvatar } from '../lib/avatar';
import { PurchasesList } from '../components/nebo/PurchasesList';
import { ACTION_FEEDBACK, showActionFeedback } from '../components/lumia-ui/ActionFeedback';
import { apiFetch } from '../services/apiClient';
import { STORE_RELEASE_CONFIG as releaseConfig } from '../lib/storeReleaseConfig';
import type { PurchaseRestoreStatus } from '../services/paymentProvider';
import { paymentFailureCopy } from '../lib/paymentFailureCopy';
import { canUseRuStorePay, resolveDistributionChannel } from '../lib/distributionChannel';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../lib/nativeBack';
import {
    authenticateWithProvider,
    getAccountAuthCapabilities,
    getLocalAccountAuthCapabilities,
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
import { isNativeAndroidRuntime } from '../services/nativeRuntime';
import {
    getNativeNotificationSettings, openNativeNotificationSettings, saveNativeNotificationSettings,
} from '../services/nativeNotifications';
import type { NativeNotificationSettings } from '../lib/nativeNotificationPolicy';
import { DictationButton } from '../components/lumia-ui/DictationButton';
import { appendDictatedText } from '../services/dictation';

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
    | 'feedback'
    | 'legal'
    | 'account'
    | 'developer';

type FeedbackCategory = 'problem' | 'idea' | 'payment' | 'question' | 'other';
type FeedbackStatus = 'idle' | 'submitting' | 'success' | 'error';

const FEEDBACK_CATEGORIES: Array<{ value: FeedbackCategory; ru: string; en: string }> = [
    { value: 'problem', ru: 'Ошибка', en: 'Problem' },
    { value: 'idea', ru: 'Пожелание', en: 'Idea' },
    { value: 'payment', ru: 'Оплата', en: 'Payment' },
    { value: 'question', ru: 'Вопрос', en: 'Question' },
    { value: 'other', ru: 'Другое', en: 'Other' },
];

const FEEDBACK_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

class FeedbackSubmissionError extends Error {}

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

const CTA_CHOICES: ReadonlyArray<[CtaStyle, string, string, string, string]> = [
    ['night', 'Ночное небо', 'Тёмно-синие со звёздами, по умолчанию', 'Night sky', 'Deep blue with stars, the default'],
    ['ink', 'Чёрные', 'Строго и спокойно. В тёмной теме светлые', 'Black', 'Strict and calm. Light in the dark theme'],
    ['gold', 'Золото', 'Тёплые, с тёмным текстом', 'Gold', 'Warm, with dark text'],
    ['light', 'Светлые', 'Белые с тёмным текстом, легко и воздушно', 'Light', 'White with dark text, light and airy'],
];

function ctaStyleLabel(style: CtaStyle, en: boolean): string {
    const choice = CTA_CHOICES.find(([key]) => key === style) || CTA_CHOICES[0];
    return en ? choice[3] : choice[1];
}

/** «Цвет кнопок» from the canvas: four samples, the choice applies to the main buttons everywhere. */
function CtaStylePicker({ value, onPick, onClose, en }: { value: CtaStyle; onPick: (style: CtaStyle) => void; onClose: () => void; en: boolean }) {
    return (
        <div className="nebo-sheet-scrim" role="presentation" onClick={onClose}>
            <div className="nebo-why" role="dialog" aria-modal="true" aria-label={en ? 'Button colour' : 'Цвет кнопок'} onClick={(event) => event.stopPropagation()}>
                <h2>{en ? 'Button colour' : 'Цвет кнопок'}</h2>
                <p className="nebo-numbers-pop-text">{en ? 'This is how the main buttons look across the app. You can change it any time.' : 'Так будут выглядеть главные кнопки во всём приложении. Поменять можно в любой момент.'}</p>
                <div className="nebo-cta-pick">
                    {CTA_CHOICES.map(([key, ru, ruSub, enLabel, enSub]) => (
                        <button key={key} type="button" aria-pressed={value === key} onClick={() => onPick(key)}>
                            <span className="nebo-cta-pick-sample" data-cta-sample={key}>{en ? 'Continue' : 'Продолжить'}</span>
                            <span className="nebo-cta-pick-row">
                                <span className="nebo-cta-pick-radio" aria-hidden />
                                <span><strong>{en ? enLabel : ru}</strong><small>{en ? enSub : ruSub}</small></span>
                            </span>
                        </button>
                    ))}
                </div>
                <button type="button" className="nebo-period-cta" onClick={onClose}>{en ? 'Done' : 'Готово'}</button>
            </div>
        </div>
    );
}

const SUPPORT_FAQ: ReadonlyArray<[string, string, string, string]> = [
    ['Откуда вы знаете мой день?', 'Считаем, где планеты сегодня, и сравниваем с твоей картой рождения. Чем точнее время рождения, тем точнее день.', 'How do you know my day?', 'We calculate where the planets are today and compare it with your birth chart. The more exact the birth time, the more exact the day.'],
    ['Зачем время и город рождения?', 'По ним считаются Асцендент и дома. Без времени карта тоже будет, но без этих деталей.', 'Why the birth time and city?', 'They give the Ascendant and the houses. Without the time you still get a chart, just without these details.'],
    ['Как отменить Plus?', 'Профиль, затем «Покупки» и «Управлять подпиской в RuStore». Доступ останется до конца оплаченного срока.', 'How do I cancel Plus?', 'Profile, then «Purchases» and «Manage subscription in RuStore». Access stays until the end of the paid period.'],
    ['Где хранятся мои данные?', 'На серверах в России, третьим лицам не передаём. Удалить аккаунт и данные можно в профиле.', 'Where is my data kept?', 'On servers in Russia, never shared with third parties. You can delete the account and data in the profile.'],
    ['Не приходят уведомления', 'Проверь, что уведомления NEBO включены в настройках телефона и в профиле. Иногда их режет экономия батареи.', 'Notifications do not arrive', 'Check that NEBO notifications are on in the phone settings and in the profile. Battery saving sometimes blocks them.'],
];

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
    onRestorePurchase?: () => Promise<PurchaseRestoreStatus>;
    onManageSubscription?: () => Promise<boolean> | boolean;
    onOpenAdmin?: () => void;
    onOpenCharts?: () => void;
    onOpenFriends?: () => void;
    onBack?: () => void;
    onLogout?: () => Promise<void>;
    onDeleteAccount?: () => Promise<void>;
    recoveryIdentityRequired?: boolean;
    onRecoveryIdentityReady?: () => void;
    embedded?: boolean;
    initialScreen?: 'root' | 'feedback' | 'notifications' | 'profile';
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
    onOpenFriends,
    onBack,
    onLogout,
    onDeleteAccount,
    recoveryIdentityRequired = false,
    onRecoveryIdentityReady,
    embedded = false,
    initialScreen = 'root',
}) => {

    const [avatarOpen, setAvatarOpen] = useState(false);
    const [themePref, setThemePref] = useThemePref();
    const [avatar] = useAvatar(String(profile.id || ''));
    const [ctaStyle, setCtaStyle] = useCtaStyle();
    const [ctaPickOpen, setCtaPickOpen] = useState(false);
    const [supportFormOpen, setSupportFormOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteAck, setDeleteAck] = useState(false);
    const nativeNotifications = isNativeAndroidRuntime();
    const rustorePurchaseControlsAvailable = canUseRuStorePay(resolveDistributionChannel());
    const [tgUser, setTgUser] = useState<{ first_name?: string; last_name?: string; photo_url?: string } | null>(null);
    const [editing, setEditing] = useState(false);
    const [tempName, setTempName] = useState(profile.name);
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileSaveError, setProfileSaveError] = useState('');
    const [savingGender, setSavingGender] = useState(false);
    const [genderSaveError, setGenderSaveError] = useState('');
    const [selfTest, setSelfTest] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');
    const [selfTestInfo, setSelfTestInfo] = useState('');
    const [dailyPush, setDailyPush] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');
    const [dailyPushInfo, setDailyPushInfo] = useState('');
    const [editsUsed, setEditsUsed] = useState(() =>
        hasActivePremium(profile) ? profileEditsThisMonth(profile.id) : readProfileEdits(profile.id).length
    );
    const [notifEnabled, setNotifEnabled] = useState(!nativeNotifications);
    const [notificationMode, setNotificationMode] = useState<'important' | 'daily'>('important');
    const [nativeExtras, setNativeExtras] = useState<Pick<NativeNotificationSettings, 'morningTime' | 'special' | 'answers' | 'quietEnabled'>>({ morningTime: null, special: true, answers: true, quietEnabled: true });
    const [notificationBusy, setNotificationBusy] = useState(false);
    const [notificationError, setNotificationError] = useState('');
    const [notificationPermission, setNotificationPermission] = useState('prompt');
    const [quietStart, setQuietStart] = useState('22:00');
    const [quietEnd, setQuietEnd] = useState(nativeNotifications ? '09:00' : '08:00');
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [deletionError, setDeletionError] = useState('');
    const [loggingOut, setLoggingOut] = useState(false);
    const [logoutError, setLogoutError] = useState('');
    const [identities, setIdentities] = useState<LinkedIdentity[]>([]);
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
    const [authCapabilities, setAuthCapabilities] = useState<AccountAuthCapabilities | null>(
        () => getLocalAccountAuthCapabilities(),
    );
    const [authCapabilitiesLoadFailed, setAuthCapabilitiesLoadFailed] = useState(false);
    const [restoreState, setRestoreState] = useState<'idle' | 'running' | 'success' | 'pending' | 'error'>('idle');
    const [restoreFailureReason, setRestoreFailureReason] = useState('');
    const [managingSubscription, setManagingSubscription] = useState(false);
    const [manageSubscriptionError, setManageSubscriptionError] = useState(false);
    const [entitlementNow, setEntitlementNow] = useState(() => Date.now());
    const [settingsScreen, setSettingsScreen] = useState<SettingsScreen>(initialScreen);
    const [feedbackCategory, setFeedbackCategory] = useState<FeedbackCategory>('problem');
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [feedbackReplyEmail, setFeedbackReplyEmail] = useState('');
    const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>('idle');
    const [feedbackTicketId, setFeedbackTicketId] = useState<number | null>(null);
    const [feedbackSubmitError, setFeedbackSubmitError] = useState('');
    const [feedbackErrors, setFeedbackErrors] = useState<{ message?: string; email?: string }>({});
    const settingsContentRef = useRef<HTMLDivElement | null>(null);
    const feedbackMessageRef = useRef<HTMLTextAreaElement | null>(null);
    const feedbackEmailRef = useRef<HTMLInputElement | null>(null);
    const feedbackReplyEmailTouchedRef = useRef(false);
    const lastRootTargetRef = useRef<Exclude<SettingsScreen, 'root'> | null>(null);
    const settingsDetailBusy = savingProfile
        || savingGender
        || identityBusy
        || restoreState === 'running'
        || managingSubscription
        || feedbackStatus === 'submitting'
        || loggingOut
        || deletingAccount;

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            const content = settingsContentRef.current;
            if (settingsScreen !== 'root') {
                const scrollRoot = content?.closest<HTMLElement>('.lumia-main-scroll');
                scrollRoot?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
                window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
            }
            content?.focus({ preventScroll: true });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [settingsScreen]);

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
            const recoveryIdentity = document.getElementById('recovery-identity');
            recoveryIdentity?.focus({ preventScroll: true });
            recoveryIdentity?.scrollIntoView({ block: 'start' });
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
        let alive = true;
        if (nativeNotifications) {
            const refresh = () => void getNativeNotificationSettings(String(profile.id)).then((settings) => {
                if (!alive) return;
                setNotifEnabled(settings.enabled && settings.permission === 'granted');
                setNotificationMode(settings.mode);
                setNativeExtras({ morningTime: settings.morningTime, special: settings.special, answers: settings.answers, quietEnabled: settings.quietEnabled });
                setQuietStart(settings.quietStart);
                setQuietEnd(settings.quietEnd);
                setNotificationPermission(settings.permission);
            });
            refresh();
            document.addEventListener('visibilitychange', refresh);
            return () => { alive = false; document.removeEventListener('visibilitychange', refresh); };
        }
        void getUserNotificationSettings().then((s) => {
            if (!alive || !s) return;
            setNotifEnabled(s.enabled !== false);
            if (s.quiet_hours_start) setQuietStart(s.quiet_hours_start);
            if (s.quiet_hours_end) setQuietEnd(s.quiet_hours_end);
        });
        return () => { alive = false; };
    }, [nativeNotifications, profile.id]);

    useEffect(() => {
        let alive = true;
        const localCapabilities = getLocalAccountAuthCapabilities();

        if (localCapabilities) {
            setAuthCapabilities(localCapabilities);
            setAuthCapabilitiesLoadFailed(false);
        }
        // Native Yandex/VK come from the APK, while email readiness comes from
        // the server. Always merge the remote result so email linking is not
        // hidden on Android; keep the compiled providers if discovery fails.
        void getAccountAuthCapabilities()
            .then((capabilities) => {
                if (!alive) return;
                setAuthCapabilities(capabilities);
                setAuthCapabilitiesLoadFailed(false);
            })
            .catch(() => {
                if (!alive) return;
                setAuthCapabilities((current) => current || localCapabilities);
                setAuthCapabilitiesLoadFailed(true);
            });

        void getLinkedIdentities()
            .then((result) => {
                if (!alive) return;
                setIdentities(result.identities);
                setIdentityLoadFailed(false);
            })
            .catch(() => {
                if (!alive) return;
                setIdentityLoadFailed(true);
            });
        return () => { alive = false; };
    }, [identityReload, profile.id]);

    useEffect(() => {
        if (feedbackReplyEmailTouchedRef.current || feedbackReplyEmail) return;
        const linkedEmail = identities.find((identity) => identity.provider === 'email')?.email?.trim();
        if (linkedEmail) setFeedbackReplyEmail(linkedEmail);
    }, [feedbackReplyEmail, identities]);

    const linkOAuth = (provider: 'vk' | 'yandex' | 'google') => {
        setIdentityError('');
        setIdentityNotice('');
        setIdentityBusy(true);
        if (authPurpose === 'login') clearQueuedUserAppEvents();
        void authenticateWithProvider(provider, authPurpose)
            .then(async (fresh) => {
                if (fresh) await updateLinkedIdentitiesAfterAuth(fresh);
            })
            .catch((error) => setIdentityError(readableIdentityError(error, profile.language === 'en' ? 'en' : 'ru')))
            .finally(() => setIdentityBusy(false));
    };

    const linkTelegram = () => {
        setIdentityError('');
        setIdentityNotice('');
        setIdentityBusy(true);
        void linkCurrentTelegramIdentity()
            .then(async (fresh) => {
                onUpdate(fresh);
                const result = await getLinkedIdentities();
                setIdentities(result.identities);
                showActionFeedback(ACTION_FEEDBACK.accountSaved);
            })
            .catch((error) => setIdentityError(readableIdentityError(error, profile.language === 'en' ? 'en' : 'ru')))
            .finally(() => setIdentityBusy(false));
    };

    const requestEmailCode = () => {
        setIdentityError('');
        setIdentityNotice('');
        setIdentityBusy(true);
        if (authPurpose === 'login') clearQueuedUserAppEvents();
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
        setIdentityError('');
        setIdentityNotice('');
        setIdentityBusy(true);
        void verifyEmailPasswordRegistration(emailChallengeId, emailCode)
            .then(async (fresh) => {
                if (fresh) await updateLinkedIdentitiesAfterAuth(fresh);
                if (fresh) showActionFeedback(ACTION_FEEDBACK.accountSaved);
                setEmailChallengeId('');
                setEmailCode('');
                setEmailPassword('');
                setEmailPasswordConfirmation('');
            })
            .catch((error) => setIdentityError(readableIdentityError(error, profile.language === 'en' ? 'en' : 'ru')))
            .finally(() => setIdentityBusy(false));
    };

    const saveNativeNotif = async (patch: Partial<NativeNotificationSettings>, requestPermission = false) => {
        if (notificationBusy) return;
        setNotificationBusy(true);
        setNotificationError('');
        try {
            await saveNativeNotificationSettings(String(profile.id), patch, requestPermission);
            const settings = await getNativeNotificationSettings(String(profile.id));
            setNotifEnabled(settings.enabled && settings.permission === 'granted');
            setNotificationMode(settings.mode);
            setNativeExtras({ morningTime: settings.morningTime, special: settings.special, answers: settings.answers, quietEnabled: settings.quietEnabled });
            setQuietStart(settings.quietStart);
            setQuietEnd(settings.quietEnd);
            setNotificationPermission(settings.permission);
            showActionFeedback(ACTION_FEEDBACK.settingsUpdated);
        } catch (error) {
            const permissionRequired = error instanceof Error && error.message === 'permission_required';
            if (permissionRequired) setNotificationPermission('denied');
            setNotificationError(profile.language === 'en'
                ? permissionRequired ? 'Allow NEBO notifications in Android settings, then turn this on.' : 'Could not save notifications. Please try again.'
                : permissionRequired ? 'Разреши уведомления NEBO в настройках Android, затем включи их здесь.' : 'Не удалось сохранить настройки. Попробуй ещё раз.');
        } finally { setNotificationBusy(false); }
    };
    const saveNotif = (patch: { enabled?: boolean; quietHoursStart?: string; quietHoursEnd?: string }) => {
        void updateUserNotificationSettings({
            enabled: notifEnabled,
            quietHoursStart: quietStart,
            quietHoursEnd: quietEnd,
            timezone: localTimezone(),
            ...patch,
        }).then(() => showActionFeedback(ACTION_FEEDBACK.settingsUpdated));
    };
    const toggleNotif = () => {
        const next = !notifEnabled;
        if (nativeNotifications) { void saveNativeNotif({ enabled: next }, next); return; }
        setNotifEnabled(next);
        saveNotif({ enabled: next });
    };
    const changeQuiet = (which: 'start' | 'end', value: string) => {
        if (nativeNotifications) {
            void saveNativeNotif(which === 'start' ? { quietStart: value } : { quietEnd: value });
            return;
        }
        if (which === 'start') setQuietStart(value); else setQuietEnd(value);
        saveNotif(which === 'start' ? { quietHoursStart: value } : { quietHoursEnd: value });
    };

    const sendSelfTest = async () => {
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
                setDailyPushInfo(hints.length ? `Доставлено. Регулярные могут молчать: ${hints.slice(0, 3).join('; ')}.` : 'Доставлено, проверь чат с ботом.');
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
        if (!rustorePurchaseControlsAvailable) return;
        if (!onRestorePurchase || restoreState === 'running' || managingSubscription) return;
        setRestoreFailureReason('');
        setRestoreState('running');
        void onRestorePurchase()
            .then((result) => {
                setRestoreState(result === 'pending' ? 'pending' : 'success');
                if (result !== 'pending') showActionFeedback(ACTION_FEEDBACK.premiumRestored);
            })
            .catch((error) => {
                setRestoreFailureReason(error instanceof Error ? error.message : '');
                setRestoreState('error');
            });
    };

    const manageSubscription = async () => {
        if (!onManageSubscription || managingSubscription || restoreState === 'running') return;
        setManageSubscriptionError(false);
        setManagingSubscription(true);
        try {
            const opened = await onManageSubscription();
            if (!opened) setManageSubscriptionError(true);
        } catch {
            setManageSubscriptionError(true);
        } finally {
            setManagingSubscription(false);
        }
    };

    const submitFeedback = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (feedbackStatus === 'submitting') return;

        const normalizedMessage = feedbackMessage.trim();
        const normalizedReplyEmail = feedbackReplyEmail.trim().toLowerCase();
        const errors: { message?: string; email?: string } = {};
        if (normalizedMessage.length < 10 || normalizedMessage.length > 4000) {
            errors.message = profile.language === 'en'
                ? 'Write between 10 and 4,000 characters.'
                : 'Напиши от 10 до 4000 символов.';
        }
        if (normalizedReplyEmail && !FEEDBACK_EMAIL_PATTERN.test(normalizedReplyEmail)) {
            errors.email = profile.language === 'en'
                ? 'Enter a valid email address.'
                : 'Укажи корректный email.';
        }
        setFeedbackErrors(errors);
        setFeedbackSubmitError('');
        if (errors.message || errors.email) {
            window.requestAnimationFrame(() => {
                if (errors.message) feedbackMessageRef.current?.focus();
                else feedbackEmailRef.current?.focus();
            });
            return;
        }


        setFeedbackStatus('submitting');
        try {
            const response = await apiFetch('/api/support/ticket', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: feedbackCategory,
                    message: normalizedMessage,
                    replyEmail: normalizedReplyEmail || null,
                }),
            });
            const result = await response.json().catch(() => ({})) as { ticketId?: unknown };
            const ticketId = Number(result.ticketId);
            if (!response.ok || !Number.isSafeInteger(ticketId) || ticketId < 1) {
                const responseMessage = response.status === 429
                    ? (profile.language === 'en'
                        ? 'Too many requests. Wait a little and try again.'
                        : 'Слишком много обращений. Подожди немного и попробуй снова.')
                    : response.status === 401 || response.status === 403
                        ? (profile.language === 'en'
                            ? 'Sign in again, then retry.'
                            : 'Войди в аккаунт заново и повтори отправку.')
                        : (profile.language === 'en'
                            ? 'Could not send the request. Check your connection and try again.'
                            : 'Не удалось отправить обращение. Проверь интернет и попробуй снова.');
                throw new FeedbackSubmissionError(responseMessage);
            }
            setFeedbackTicketId(ticketId);
            setFeedbackStatus('success');
        } catch (error) {
            setFeedbackStatus('error');
            setFeedbackSubmitError(error instanceof FeedbackSubmissionError
                ? error.message
                : (profile.language === 'en'
                    ? 'Could not send the request. Check your connection and try again.'
                    : 'Не удалось отправить обращение. Проверь интернет и попробуй снова.'));
        }
    };

    const startNewFeedback = () => {
        setFeedbackCategory('problem');
        setFeedbackMessage('');
        setFeedbackStatus('idle');
        setFeedbackTicketId(null);
        setFeedbackSubmitError('');
        setFeedbackErrors({});
        window.requestAnimationFrame(() => feedbackMessageRef.current?.focus());
    };

    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.initDataUnsafe?.user) {
            setTgUser(tg.initDataUnsafe.user);
        }
    }, []);

    useEffect(() => {
        if (nativeNotifications) return;
        const freq = readStoredNotificationFrequency(profile.id) || profile.notificationFrequency || 'important';
        // Регистрируем пользователя в движке уведомлений (таймзона + флаги) — иначе планировщики его не видят
        void updateUserNotificationSettings({ ...notificationFlagsFor(freq), timezone: localTimezone() });
    }, [profile.id, profile.notificationFrequency, nativeNotifications]);

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
        saveProfile(updated).catch(error => {
            console.error('[Settings] Failed to save language:', error);
        });
    };

    const handleGenderChange = async (gender: 'male' | 'female' | 'unspecified') => {
        if (savingGender || gender === (profile.gender || 'unspecified')) return;
        setSavingGender(true);
        setGenderSaveError('');
        try {
            // The server is authoritative across devices. Update visible state
            // only after persistence succeeds, so a failed save cannot stick.
            await saveServerAuthoritativeGender(profile, gender, saveProfile, onUpdate);
            showActionFeedback(ACTION_FEEDBACK.dataUpdated);
        } catch (error) {
            console.error('[Settings] Failed to save gender:', error);
            setGenderSaveError(profile.language === 'en'
                ? 'Gender was not saved. Check your connection and try again.'
                : 'Не удалось сохранить пол. Проверь соединение и попробуй ещё раз.');
        } finally {
            setSavingGender(false);
        }
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
        setSavingProfile(true);
        setProfileSaveError('');
        try {
            await saveProfile(updated);
            onUpdate(updated);
            recordProfileEdit(profile.id);
            setEditsUsed((n) => n + 1);
            setTempName(normalizedName);
            setEditing(false);
            showActionFeedback(ACTION_FEEDBACK.settingsSaved);
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

    const deleteAccount = () => {
        if (!onDeleteAccount || deletingAccount || loggingOut) return;
        setDeletionError('');
        setDeletingAccount(true);
        void onDeleteAccount().catch(() => {
            setDeletionError(profile.language === 'en'
                ? 'Account deletion did not complete. Your account is still active.'
                : 'Не удалось удалить аккаунт. Он остаётся активным.');
        }).finally(() => setDeletingAccount(false));
    };

    const handleDeleteAccount = () => {
        if (!onDeleteAccount || deletingAccount) return;

        if (hasActiveRuStoreAutoRenewal) {
            const continueDeletion = window.confirm(profile.language === 'en'
                ? 'Auto-renewal is active in RuStore. Deleting this account will not cancel it automatically. Select OK to continue deleting, or Cancel to manage the subscription in RuStore first.'
                : 'В RuStore включено автопродление. Удаление аккаунта не отменит его автоматически. Нажми «ОК», чтобы продолжить удаление, или «Отмена», чтобы сначала открыть управление подпиской в RuStore.');
            if (!continueDeletion) {
                void manageSubscription();
                return;
            }
        }
        // The final «Удалить аккаунт навсегда?» question is the canvas dialog with the «Понимаю» checkbox.
        setDeleteAck(false);
        setDeleteDialogOpen(true);
    };

    const handleLogout = () => {
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
    }, [initialScreen, onBack, profile.name, settingsDetailBusy]);

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
        setSettingsScreen(screen);
    };

    const settingsTitle: Record<SettingsScreen, string> = profile.language === 'en'
        ? {
            root: 'Profile',
            profile: 'Profile',
            birth: 'Birth details',
            gender: 'Gender',
            notifications: 'Notifications',
            language: 'Language',
            auth: 'Sign-in methods',
            subscription: 'Purchases',
            feedback: 'Support',
            legal: 'Legal information',
            account: 'Account and data',
            developer: 'For developers',
        }
        : {
            root: 'Профиль',
            profile: 'Профиль',
            birth: 'Данные рождения',
            gender: 'Пол',
            notifications: 'Уведомления',
            language: 'Язык',
            auth: 'Способы входа',
            subscription: 'Покупки',
            feedback: 'Обратная связь',
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
                                        aria-busy={savingGender && !selected}
                                        aria-describedby={genderSaveError ? 'settings-gender-save-error' : undefined}
                                        disabled={savingGender}
                                        onClick={() => { void handleGenderChange(value); }}
                                    >
                                        <span>{profile.language === 'en' ? en : ru}</span>
                                        {selected ? <Check aria-hidden size={16} strokeWidth={2} /> : null}
                                    </button>
                                );
                            })}
                        </div>
                        {genderSaveError ? (
                            <p id="settings-gender-save-error" role="alert" className="settings-error-text">
                                {genderSaveError}
                            </p>
                        ) : null}
                    </section>
                );

            case 'notifications':
                return (
                    <section className="settings-detail-panel" aria-label={settingsTitle.notifications}>
                        {nativeNotifications ? <p className="settings-helper-text">
                            {profile.language === 'en'
                                ? 'Morning horoscope, holidays, full moons and news. Usually one or two a day, only while NEBO is closed.'
                                : 'Гороскоп по утрам, праздники, полнолуния и новости. Обычно одно-два в день и только пока NEBO свёрнуто.'}
                        </p> : null}
                        <div className="settings-toggle-row">
                            <label htmlFor="settings-notifications-toggle">{profile.language === 'en' ? 'Notifications' : nativeNotifications ? 'Уведомлять по делу' : 'Уведомления'}</label>
                            <button
                                id="settings-notifications-toggle"
                                type="button"
                                role="switch"
                                aria-checked={notifEnabled}
                                className={'settings-switch' + (notifEnabled ? ' settings-switch--on' : '')}
                                onClick={toggleNotif}
                                disabled={notificationBusy}
                                aria-busy={notificationBusy}
                            >
                                <span aria-hidden />
                            </button>
                        </div>
                        {notificationError ? <p className="settings-helper-text" role="alert">{notificationError}</p> : null}
                        {nativeNotifications && notificationPermission === 'denied' ? <button type="button" className="settings-selection-row"
                            onClick={() => void openNativeNotificationSettings().catch(() => setNotificationError(profile.language === 'en'
                                ? 'Open Android settings → Apps → NEBO → Notifications.' : 'Открой настройки Android → Приложения → NEBO → Уведомления.'))}>
                            {profile.language === 'en' ? 'Open Android settings' : 'Открыть настройки Android'}
                        </button> : null}
                        {nativeNotifications && notifEnabled ? (
                            <div className="nebo-notif">
                                <div className="nebo-notif-preview" aria-hidden="true">
                                    <img src="/assets/brand/nebo-mark.webp" alt="" width={40} height={40} />
                                    <span>
                                        <small>NEBO <i>{nativeExtras.morningTime || '9:00'}</i></small>
                                        <strong>{profile.language === 'en' ? 'An easy day for talking' : 'Сегодня легко договориться'}</strong>
                                        <em>{profile.language === 'en' ? 'If you need to write someone something important, better do it before lunch.' : 'Если нужно написать кому-то важное сообщение, лучше сделай это до обеда.'}</em>
                                    </span>
                                </div>
                                <p className="settings-helper-text">{profile.language === 'en' ? 'This is how the morning notification looks' : 'Так выглядит утреннее уведомление'}</p>
                                <div className="nebo-notif-list">
                                    {([
                                        ['daily', profile.language === 'en' ? 'Name of the day in the morning' : 'Утром название дня', profile.language === 'en' ? 'a short line and what it means for you' : 'короткая фраза и что это значит для тебя', notificationMode === 'daily'],
                                        ['special', profile.language === 'en' ? 'Special days' : 'Особые дни', profile.language === 'en' ? 'retrograde planets, full moon, birthdays' : 'ретроградные планеты, полнолуние, твой день рождения', nativeExtras.special],
                                        ['answers', profile.language === 'en' ? 'Answers' : 'Ответы на вопросы', profile.language === 'en' ? 'when a reading is ready' : 'когда ответ по карте готов', nativeExtras.answers],
                                    ] as const).map(([id, label, hint, on]) => (
                                        <div key={id} className="nebo-notif-row">
                                            <span><strong>{label}</strong><small>{hint}</small></span>
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={on}
                                                aria-label={label}
                                                className={'settings-switch' + (on ? ' settings-switch--on' : '')}
                                                disabled={notificationBusy}
                                                onClick={() => void saveNativeNotif(id === 'daily' ? { mode: on ? 'important' : 'daily' } : { [id]: !on })}
                                            >
                                                <span aria-hidden />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                {notificationMode === 'daily' ? (
                                    <>
                                        <h2 className="nebo-notif-head">{profile.language === 'en' ? 'Morning notification time' : 'Время утреннего уведомления'}</h2>
                                        <div className="nebo-notif-times" role="radiogroup">
                                            {['06:30', '07:00', '08:00', '09:00'].map((time) => (
                                                <button
                                                    key={time}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={nativeExtras.morningTime === time}
                                                    className={nativeExtras.morningTime === time ? 'is-active' : ''}
                                                    disabled={notificationBusy}
                                                    onClick={() => void saveNativeNotif({ morningTime: time })}
                                                >
                                                    {time.replace(/^0/, '')}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : null}
                                <div className="nebo-notif-list">
                                    <div className="nebo-notif-row">
                                        <span><strong>{profile.language === 'en' ? 'Quiet hours' : 'Тихие часы'}</strong><small>{profile.language === 'en' ? `from ${quietStart} to ${quietEnd}, no disturbing` : `с ${quietStart} до ${quietEnd} не беспокоим`}</small></span>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={nativeExtras.quietEnabled}
                                            aria-label={profile.language === 'en' ? 'Quiet hours' : 'Тихие часы'}
                                            className={'settings-switch' + (nativeExtras.quietEnabled ? ' settings-switch--on' : '')}
                                            disabled={notificationBusy}
                                            onClick={() => void saveNativeNotif({ quietEnabled: !nativeExtras.quietEnabled })}
                                        >
                                            <span aria-hidden />
                                        </button>
                                    </div>
                                </div>
                                <p className="settings-helper-text">{profile.language === 'en'
                                    ? 'No more than two notifications a day. On special days, like a full moon or your birthday, a third may come.'
                                    : 'Не больше двух уведомлений в день. В особые дни, например в полнолуние или в твой день рождения, может прийти третье.'}</p>
                            </div>
                        ) : null}
                        {notifEnabled && (!nativeNotifications || nativeExtras.quietEnabled) ? (
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
                                        disabled={notificationBusy}
                                        onChange={(event) => changeQuiet('start', event.target.value)}
                                        className="fresh-input"
                                    />
                                    <input
                                        id="settings-quiet-end"
                                        name="quietEnd"
                                        type="time"
                                        value={quietEnd}
                                        disabled={notificationBusy}
                                        onChange={(event) => changeQuiet('end', event.target.value)}
                                        className="fresh-input"
                                    />
                                </div>
                                <p className="settings-helper-text">
                                    {nativeNotifications && quietStart === quietEnd
                                        ? profile.language === 'en' ? 'Matching times mean a full day of quiet.' : 'Одинаковое время, тишина на весь день.'
                                        : profile.language === 'en'
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
                    <section
                        id="recovery-identity"
                        className="settings-detail-panel"
                        aria-label={settingsTitle.auth}
                        tabIndex={-1}
                    >
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
                                {identities.filter(identity => identity.provider !== 'google').map((identity) => (
                                    <div className="settings-identity-row" key={identity.provider}>
                                        <span>{IDENTITY_LABELS[identity.provider]}</span>
                                        <span>{identity.provider === 'email' && identity.email ? identity.email : (profile.language === 'en' ? 'Linked' : 'Подключён')}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        {identityLoadFailed || authCapabilitiesLoadFailed ? (
                            <div className="settings-inline-error">
                                <p>{profile.language === 'en' ? 'Could not load sign-in methods.' : 'Не удалось загрузить способы входа.'}</p>
                                <button type="button" onClick={() => setIdentityReload((value) => value + 1)}>
                                    {profile.language === 'en' ? 'Retry' : 'Повторить'}
                                </button>
                            </div>
                        ) : null}
                        <div className="settings-auth-actions">
                            {hasTelegramMiniAppContext() && !identities.some((identity) => identity.provider === 'telegram') ? (
                                <button
                                    type="button"
                                    className="fresh-btn-ghost"
                                    disabled={identityBusy || authPurpose === 'login'}
                                    onClick={linkTelegram}
                                >
                                    Telegram
                                </button>
                            ) : null}
                            {(['vk', 'yandex'] as const)
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
                    <section className="settings-detail-panel nebo-purchases" aria-label={settingsTitle.subscription}>
                        <PurchasesList userId={String(profile.id || '')} plus={activePremium} premiumUntil={profile.premiumUntil} en={profile.language === 'en'} />
                        {!activePremium ? <p className="nebo-purchases-note">{subscriptionPresentation.body}</p> : null}
                        <div className="nebo-purchases-actions">
                            {subscriptionPresentation.shouldPromote && canPromotePremium ? (
                                <button type="button" className="nebo-period-cta" onClick={() => onRequestPremium?.()}>
                                    {profile.language === 'ru' ? 'Оформить Plus' : 'Get Plus'}
                                </button>
                            ) : null}
                            {rustorePurchaseControlsAvailable ? (
                                <button
                                    type="button"
                                    className="nebo-purchases-restore"
                                    disabled={!onRestorePurchase || restoreState === 'running' || managingSubscription}
                                    aria-busy={restoreState === 'running'}
                                    onClick={restorePurchase}
                                >
                                    {restoreState === 'running'
                                        ? (profile.language === 'ru' ? 'Проверяем…' : 'Checking…')
                                        : (profile.language === 'ru' ? 'Восстановить покупки' : 'Restore purchases')}
                                </button>
                            ) : null}
                            {rustorePurchaseControlsAvailable
                            && subscriptionPresentation.canManageInStore
                            && onManageSubscription ? (
                                <button
                                    type="button"
                                    className="nebo-purchases-link"
                                    onClick={() => void manageSubscription()}
                                    disabled={managingSubscription || restoreState === 'running'}
                                    aria-busy={managingSubscription}
                                >
                                    {managingSubscription
                                        ? (profile.language === 'ru' ? 'Открываем RuStore…' : 'Opening RuStore…')
                                        : (profile.language === 'ru' ? 'Управлять подпиской в RuStore' : 'Manage subscription in RuStore')}
                                </button>
                            ) : null}
                        </div>
                        {rustorePurchaseControlsAvailable ? (
                            <p className="nebo-purchases-foot">{profile.language === 'ru' ? 'Чеки RuStore присылает на почту твоего аккаунта RuStore.' : 'RuStore sends receipts to the email of your RuStore account.'}</p>
                        ) : null}
                        {rustorePurchaseControlsAvailable && restoreState === 'success' ? (
                            <p role="status" className="settings-helper-text">
                                {profile.language === 'ru' ? 'Покупки проверены сервером.' : 'Purchases were checked by the server.'}
                            </p>
                        ) : rustorePurchaseControlsAvailable && restoreState === 'pending' ? (
                            <p role="status" className="settings-helper-text">
                                {profile.language === 'ru'
                                    ? 'RuStore ещё подтверждает покупку. Подожди немного и проверь снова, повторно покупать не нужно.'
                                    : 'RuStore is still confirming the purchase. Wait a moment and check again, do not buy it again.'}
                            </p>
                        ) : rustorePurchaseControlsAvailable && restoreState === 'error' ? (
                            <p role="alert" className="settings-error-text">
                                {paymentFailureCopy(restoreFailureReason, profile.language)
                                    || (profile.language === 'ru' ? 'Не удалось восстановить покупку. Проверь RuStore и интернет.' : 'Could not restore the purchase. Check RuStore and your connection.')}
                            </p>
                        ) : null}
                        {manageSubscriptionError ? (
                            <p role="alert" className="settings-error-text">
                                {profile.language === 'ru'
                                    ? 'Не удалось открыть управление подпиской. Открой раздел подписок в RuStore.'
                                    : 'Could not open subscription management. Open Subscriptions in RuStore.'}
                            </p>
                        ) : null}
                    </section>
                );

            case 'feedback':
                return (
                    <section className="settings-detail-panel" aria-label={settingsTitle.feedback}>
                        {!supportFormOpen && feedbackStatus !== 'success' ? (
                            <div className="nebo-support">
                                <div className="nebo-support-head">
                                    <img src="/assets/nebo-icons/help.svg" alt="" width={64} height={64} />
                                    <span><strong>{profile.language === 'en' ? 'Common questions' : 'Частые вопросы'}</strong><small>{profile.language === 'en' ? 'If the answer is not here, write to us' : 'Если ответа нет, напиши нам'}</small></span>
                                </div>
                                <div className="nebo-support-faq">
                                    {SUPPORT_FAQ.map(([qRu, aRu, qEn, aEn], index) => (
                                        <details key={qRu} open={index === 0}>
                                            <summary>{profile.language === 'en' ? qEn : qRu}<ChevronDown aria-hidden size={18} strokeWidth={2} /></summary>
                                            <p>{profile.language === 'en' ? aEn : aRu}</p>
                                        </details>
                                    ))}
                                </div>
                                <button type="button" className="nebo-period-cta" onClick={() => setSupportFormOpen(true)}>
                                    {profile.language === 'en' ? 'Write to support' : 'Написать в поддержку'}
                                </button>
                                <p className="nebo-support-note">{profile.language === 'en' ? 'Describe what happened and attach a screenshot if you can.' : 'Опиши, что случилось. Если можешь, приложи скриншот.'}</p>
                            </div>
                        ) : feedbackStatus === 'success' && feedbackTicketId ? (
                            <div className="settings-feedback-success">
                                <div role="status" aria-live="polite">
                                    <p>{profile.language === 'en' ? `Request #${feedbackTicketId}` : `Обращение №${feedbackTicketId}`}</p>
                                    <h2>{profile.language === 'en' ? 'Request saved' : 'Обращение сохранено'}</h2>
                                    <span>
                                        {profile.language === 'en'
                                            ? 'We will reply by email if you provided one.'
                                            : 'Если указан email, ответ придёт туда.'}
                                    </span>
                                </div>
                                <button type="button" className="fresh-btn-primary" onClick={startNewFeedback}>
                                    {profile.language === 'en' ? 'New request' : 'Новое обращение'}
                                </button>
                            </div>
                        ) : (
                            <form className="settings-feedback-form" noValidate onSubmit={submitFeedback}>
                                <fieldset className="settings-feedback-categories">
                                    <legend>{profile.language === 'en' ? 'Topic' : 'Тема'}</legend>
                                    <div>
                                        {FEEDBACK_CATEGORIES.map((category) => (
                                            <label
                                                key={category.value}
                                            >
                                                <input
                                                    type="radio"
                                                    name="supportCategory"
                                                    value={category.value}
                                                    checked={feedbackCategory === category.value}
                                                    onChange={() => {
                                                        setFeedbackCategory(category.value);
                                                        if (feedbackStatus === 'error') setFeedbackStatus('idle');
                                                    }}
                                                />
                                                <span>{profile.language === 'en' ? category.en : category.ru}</span>
                                            </label>
                                        ))}
                                    </div>
                                </fieldset>

                                <div className="settings-form-field">
                                    <label htmlFor="settings-feedback-message">
                                        {profile.language === 'en' ? 'Message' : 'Сообщение'}
                                    </label>
                                    <textarea
                                        ref={feedbackMessageRef}
                                        id="settings-feedback-message"
                                        name="supportMessage"
                                        className="settings-feedback-textarea"
                                        value={feedbackMessage}
                                        minLength={10}
                                        maxLength={4000}
                                        rows={6}
                                        required
                                        aria-invalid={!!feedbackErrors.message}
                                        aria-describedby={`settings-feedback-message-hint${feedbackErrors.message ? ' settings-feedback-message-error' : ''}`}
                                        placeholder={profile.language === 'en'
                                            ? 'Tell us what happened or what could be improved'
                                            : 'Расскажи, что случилось или что можно улучшить'}
                                        onChange={(event) => {
                                            setFeedbackMessage(event.target.value);
                                            if (feedbackErrors.message) setFeedbackErrors((current) => ({ ...current, message: undefined }));
                                            if (feedbackStatus === 'error') setFeedbackStatus('idle');
                                            setFeedbackSubmitError('');
                                        }}
                                    />
                                    <div id="settings-feedback-message-hint" className="settings-feedback-field-meta">
                                        <DictationButton
                                            language={profile.language === 'en' ? 'en' : 'ru'}
                                            className="settings-feedback-dictation"
                                            onText={(text) => setFeedbackMessage((current) => appendDictatedText(current, text, 4000))}
                                        />
                                        <span>{profile.language === 'en' ? 'At least 10 characters' : 'Минимум 10 символов'}</span>
                                        <span>{feedbackMessage.length}/4000</span>
                                    </div>
                                    {feedbackErrors.message ? (
                                        <p id="settings-feedback-message-error" className="settings-error-text" role="alert">
                                            {feedbackErrors.message}
                                        </p>
                                    ) : null}
                                </div>

                                <div className="settings-form-field">
                                    <label htmlFor="settings-feedback-email">
                                        {profile.language === 'en' ? 'Email for a reply (optional)' : 'Email для ответа (необязательно)'}
                                    </label>
                                    <input
                                        ref={feedbackEmailRef}
                                        id="settings-feedback-email"
                                        name="replyEmail"
                                        type="email"
                                        inputMode="email"
                                        autoComplete="email"
                                        className="fresh-input"
                                        value={feedbackReplyEmail}
                                        maxLength={254}
                                        aria-invalid={!!feedbackErrors.email}
                                        aria-describedby={feedbackErrors.email ? 'settings-feedback-email-error' : undefined}
                                        onChange={(event) => {
                                            feedbackReplyEmailTouchedRef.current = true;
                                            setFeedbackReplyEmail(event.target.value);
                                            if (feedbackErrors.email) setFeedbackErrors((current) => ({ ...current, email: undefined }));
                                            if (feedbackStatus === 'error') setFeedbackStatus('idle');
                                            setFeedbackSubmitError('');
                                        }}
                                    />
                                    {feedbackErrors.email ? (
                                        <p id="settings-feedback-email-error" className="settings-error-text" role="alert">
                                            {feedbackErrors.email}
                                        </p>
                                    ) : null}
                                </div>

                                <p className="settings-feedback-warning">
                                    {profile.language === 'en'
                                        ? 'The NEBO team will receive this message. Do not include passwords, codes, payment details, birth data or health information.'
                                        : 'Сообщение получит команда NEBO. Не указывай пароли, коды, платёжные данные, данные рождения или сведения о здоровье.'}
                                </p>

                                <button
                                    type="submit"
                                    className="fresh-btn-primary settings-feedback-submit"
                                    disabled={feedbackStatus === 'submitting'}
                                    aria-busy={feedbackStatus === 'submitting'}
                                >
                                    {feedbackStatus === 'submitting'
                                        ? (profile.language === 'en' ? 'Sending…' : 'Отправляем…')
                                        : (profile.language === 'en' ? 'Send' : 'Отправить')}
                                </button>
                                <div className="settings-feedback-result" aria-live="polite">
                                    {feedbackSubmitError ? <p className="settings-error-text" role="alert">{feedbackSubmitError}</p> : null}
                                </div>
                            </form>
                        )}
                    </section>
                );

            case 'legal':
                return (
                    <section className="settings-detail-panel" aria-label={settingsTitle.legal}>
                        <div className="settings-list">
                            <a className="settings-list-row" href={releaseConfig.privacyUrl} target="_blank" rel="noreferrer">
                                <span className="settings-list-row-main">
                                    <span className="settings-list-row-label">{profile.language === 'en' ? 'Privacy Policy' : 'Политика конфиденциальности'}</span>
                                </span>
                                <span className="settings-list-row-end"><ChevronRight aria-hidden size={16} strokeWidth={1.8} /></span>
                            </a>
                            <a className="settings-list-row" href={releaseConfig.termsUrl} target="_blank" rel="noreferrer">
                                <span className="settings-list-row-main">
                                    <span className="settings-list-row-label">{profile.language === 'en' ? 'User Agreement' : 'Пользовательское соглашение'}</span>
                                </span>
                                <span className="settings-list-row-end"><ChevronRight aria-hidden size={16} strokeWidth={1.8} /></span>
                            </a>
                            <a className="settings-list-row" href={releaseConfig.consentUrl} target="_blank" rel="noreferrer">
                                <span className="settings-list-row-main">
                                    <span className="settings-list-row-label">{profile.language === 'en' ? 'Personal data consent' : 'Согласие на обработку данных'}</span>
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
                        {deleteDialogOpen ? (
                            <div className="nebo-sheet-scrim" role="presentation" onClick={() => setDeleteDialogOpen(false)}>
                                <div className="nebo-soft-pop nebo-delete-pop" role="alertdialog" aria-modal="true" aria-label={profile.language === 'en' ? 'Delete the account forever?' : 'Удалить аккаунт навсегда?'} onClick={(event) => event.stopPropagation()}>
                                    <button type="button" className="nebo-day-pop-close" onClick={() => setDeleteDialogOpen(false)} aria-label={profile.language === 'en' ? 'Close' : 'Закрыть'}><X size={18} aria-hidden /></button>
                                    <img src="/assets/nebo-icons/trash.svg" alt="" width={80} height={80} />
                                    <h2>{profile.language === 'en' ? 'Delete the account forever?' : 'Удалить аккаунт навсегда?'}</h2>
                                    <p>{profile.language === 'en'
                                        ? 'We will delete your chart, questions, purchases and saved people. Cancel the subscription in RuStore separately, or it will keep renewing.'
                                        : 'Удалим карту, вопросы, покупки и близких. Подписку отмени в RuStore отдельно, иначе она продолжит списываться.'}</p>
                                    <label className="nebo-delete-ack">
                                        <input type="checkbox" checked={deleteAck} onChange={(event) => setDeleteAck(event.target.checked)} />
                                        <span>{profile.language === 'en' ? 'I understand the data cannot be restored' : 'Понимаю, что вернуть данные будет нельзя'}</span>
                                    </label>
                                    <button type="button" className="nebo-delete-confirm" disabled={!deleteAck || deletingAccount} onClick={() => { setDeleteDialogOpen(false); deleteAccount(); }}>
                                        {profile.language === 'en' ? 'Delete account' : 'Удалить аккаунт'}
                                    </button>
                                    <button type="button" className="nebo-inbox-close" onClick={() => setDeleteDialogOpen(false)}>{profile.language === 'en' ? 'Cancel' : 'Отмена'}</button>
                                </div>
                            </div>
                        ) : null}
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
            default: {
                const en = profile.language === 'en';
                const icon = (name: string) => <img src={`/assets/nebo-icons/${name}.svg`} alt="" width={34} height={34} />;
                const plusUntil = activePremium && profile.premiumUntil ? new Date(profile.premiumUntil) : null;
                const plusUntilLabel = plusUntil && !Number.isNaN(plusUntil.getTime()) ? plusUntil.toLocaleDateString(en ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'long' }) : '';
                const planBadge = profile.isGuest ? (en ? 'Guest · not signed in' : 'Гость · без входа') : activePremium ? (plusUntilLabel ? (en ? `Plus until ${plusUntilLabel}` : `Plus до ${plusUntilLabel}`) : 'Plus') : 'Free';
                return (
                    <div className="settings-root">
                        <div className="nebo-profile-head">
                            <button type="button" className="nebo-profile-avatar-button" onClick={() => setAvatarOpen(true)} aria-label={en ? 'Change avatar' : 'Сменить аватарку'}>
                                <AvatarCircle userId={profile.id || ''} name={profileDisplayName || ''} className="nebo-profile-avatar" />
                            </button>
                            <strong>{profile.isGuest ? (en ? 'Guest' : 'Гость') : profileDisplayName}</strong>
                            <span className={activePremium ? 'nebo-profile-plan is-plus' : profile.isGuest ? 'nebo-profile-plan is-guest' : 'nebo-profile-plan'}>{planBadge}</span>
                        </div>
                        {ctaPickOpen ? <CtaStylePicker value={ctaStyle} onPick={setCtaStyle} onClose={() => setCtaPickOpen(false)} en={en} /> : null}
                        <AvatarPicker
                            open={avatarOpen}
                            onClose={() => setAvatarOpen(false)}
                            userId={profile.id || ''}
                            name={profileDisplayName || ''}
                            birthDate={profile.birthDate}
                            plus={activePremium}
                            onRequestPlus={() => { setAvatarOpen(false); onRequestPremium?.(); }}
                        />

                        {profile.isGuest ? (
                            <section className="nebo-profile-signin">
                                <strong>{en ? 'Sign in so nothing gets lost' : 'Войди, чтобы ничего не потерять'}</strong>
                                <p>{en ? 'Your chart and settings live only on this phone for now.' : 'Сейчас карта и настройки хранятся только на этом телефоне.'}</p>
                                <div className="nebo-profile-signin-buttons">
                                    <button type="button" className="is-yandex" onClick={() => openSettingsScreen('auth')}><span aria-hidden>Я</span>{en ? 'Yandex' : 'Яндекс'}</button>
                                    <button type="button" className="is-vk" onClick={() => openSettingsScreen('auth')}>VK ID</button>
                                    <button type="button" className="is-mail" onClick={() => openSettingsScreen('auth')}>{en ? 'Email' : 'Почта'}</button>
                                </div>
                            </section>
                        ) : null}

                        <section className="settings-group" aria-labelledby="settings-premium-heading">
                            <h2 id="settings-premium-heading">{en ? 'Subscription and purchases' : 'Подписка и покупки'}</h2>
                            <div className="settings-list">
                                <SettingsRow
                                    icon={icon('plus')}
                                    label={activePremium ? 'NEBO Plus' : (en ? 'Get Plus' : 'Оформить Plus')}
                                    value={activePremium ? (en ? 'active' : 'активна') : (en ? 'from 399 ₽' : 'от 399 ₽')}
                                    target="subscription"
                                    onClick={() => (activePremium || !onRequestPremium ? openSettingsScreen('subscription') : onRequestPremium())}
                                />
                                {onRequestPremium ? (
                                    <SettingsRow icon={icon('gift')} label={en ? 'Store and gifts' : 'Магазин и подарки'} onClick={() => onRequestPremium()} />
                                ) : null}
                                <SettingsRow icon={icon('bag')} label={en ? 'Purchases' : 'Покупки'} onClick={() => openSettingsScreen('subscription')} />
                                {onRequestPremium ? (
                                    <SettingsRow icon={icon('star')} label={en ? 'Enter a code' : 'Ввести код'} value={en ? 'gift or promo code' : 'подарок или промокод'} onClick={() => onRequestPremium()} />
                                ) : null}
                            </div>
                        </section>

                        <section className="settings-group" aria-labelledby="settings-look-heading">
                            <h2 id="settings-look-heading">{en ? 'Appearance' : 'Внешний вид'}</h2>
                            <div className="settings-list">
                                <div className="settings-list-row settings-theme-row">
                                    <span className="settings-list-row-main">
                                        <span className="settings-list-row-icon" aria-hidden>{icon('theme')}</span>
                                        <span className="settings-list-row-label">{en ? 'Theme' : 'Тема'}</span>
                                    </span>
                                    <span className="nebo-theme-seg" role="radiogroup" aria-label={en ? 'Theme' : 'Тема'}>
                                        {([['light', en ? 'Light' : 'Светлая'], ['dark', en ? 'Dark' : 'Тёмная'], ['system', en ? 'Auto' : 'Авто']] as const).map(([key, label]) => (
                                            <button key={key} type="button" role="radio" aria-checked={themePref === key} className={themePref === key ? 'is-on' : ''} onClick={() => setThemePref(key)}>{label}</button>
                                        ))}
                                    </span>
                                </div>
                                <SettingsRow icon={icon('roller')} label={en ? 'Buttons' : 'Кнопки'} value={ctaStyleLabel(ctaStyle, en)} onClick={() => setCtaPickOpen(true)} />
                                <SettingsRow icon={icon('person')} label={en ? 'Avatar' : 'Аватарка'} value={avatar.kind === 'photo' ? (en ? 'own photo' : 'своё фото') : avatar.kind === 'set' ? (avatar.set === 'cats' ? (en ? 'cat' : 'котик') : (en ? 'animal' : 'зверёк')) : (en ? 'letter' : 'буква')} onClick={() => setAvatarOpen(true)} />
                                <div className="settings-list-row settings-theme-row" data-settings-target="language">
                                    <span className="settings-list-row-main">
                                        <span className="settings-list-row-icon" aria-hidden>{icon('globe')}</span>
                                        <span className="settings-list-row-label">{en ? 'Language' : 'Язык'}</span>
                                    </span>
                                    <span className="nebo-theme-seg" role="radiogroup" aria-label={en ? 'Language' : 'Язык'}>
                                        {(['ru', 'en'] as const).map((value) => (
                                            <button key={value} type="button" role="radio" aria-checked={profile.language === value} className={profile.language === value ? 'is-on' : ''} onClick={() => { if (profile.language !== value) handleLanguageToggle(); }}>{value.toUpperCase()}</button>
                                        ))}
                                    </span>
                                </div>
                            </div>
                        </section>

                        <section className="settings-group" aria-labelledby="settings-data-heading">
                            <h2 id="settings-data-heading">{en ? 'My data' : 'Мои данные'}</h2>
                            <div className="settings-list">
                                <SettingsRow
                                    icon={icon('bell')}
                                    label={en ? 'Notifications' : 'Уведомления'}
                                    value={notifEnabled ? (nativeExtras.morningTime || (en ? 'On' : 'Включены')) : (en ? 'Off' : 'Выключены')}
                                    target="notifications"
                                    onClick={() => openSettingsScreen('notifications')}
                                />
                                <SettingsRow
                                    icon={icon('shield')}
                                    label={en ? 'Date, time, city' : 'Дата, время, город'}
                                    value={formatSettingsBirthDate(profile.birthDate, profile.language)}
                                    target="birth"
                                    onClick={() => openSettingsScreen('birth')}
                                />
                                <SettingsRow icon={icon('person')} label={en ? 'Gender' : 'Пол'} value={genderValue} target="gender" onClick={() => openSettingsScreen('gender')} />
                                {onOpenCharts ? <SettingsRow icon={icon('star')} label={en ? 'My charts' : 'Мои карты'} onClick={onOpenCharts} /> : null}
                                {onOpenFriends ? <SettingsRow icon={icon('person')} label={en ? 'My people' : 'Мои люди'} value={en ? 'friends and chat' : 'друзья и переписка'} onClick={onOpenFriends} /> : null}
                                {!profile.isGuest ? (
                                    <SettingsRow
                                        icon={icon('envelope')}
                                        label={en ? 'Sign-in methods' : 'Способы входа'}
                                        value={identityLoadFailed ? (en ? 'Unavailable' : 'Не загружены') : identityCountLabel(identities.length, profile.language)}
                                        target="auth"
                                        onClick={() => openSettingsScreen('auth')}
                                    />
                                ) : null}
                                <SettingsRow icon={icon('person')} label={en ? 'Name' : 'Имя'} value={profileDisplayName} target="profile" onClick={() => openSettingsScreen('profile')} />
                            </div>
                        </section>

                        <section className="settings-group settings-group--last" aria-labelledby="settings-nebo-heading">
                            <h2 id="settings-nebo-heading">NEBO</h2>
                            <div className="settings-list">
                                <SettingsRow
                                    icon={icon('star')}
                                    label={en ? 'Rate the app' : 'Оценить приложение'}
                                    onClick={() => { window.open('https://www.rustore.ru/catalog/app/ru.tvoygoroskop.app', '_blank', 'noopener'); }}
                                />
                                <SettingsRow icon={icon('help')} label={en ? 'Support and questions' : 'Поддержка и вопросы'} target="feedback" onClick={() => openSettingsScreen('feedback')} />
                                <SettingsRow icon={icon('shield')} label={en ? 'Legal information' : 'Правовая информация'} target="legal" onClick={() => openSettingsScreen('legal')} />
                                {profile.isAdmin ? (
                                    <SettingsRow icon={icon('roller')} label={en ? 'For developers' : 'Для разработчика'} target="developer" onClick={() => openSettingsScreen('developer')} />
                                ) : null}
                                {!profile.isGuest ? <SettingsRow icon={icon('door')} label={en ? 'Sign out' : 'Выйти'} danger onClick={handleLogout} /> : null}
                                <SettingsRow icon={icon('trash')} label={en ? 'Delete account' : 'Удалить аккаунт'} target="account" danger onClick={() => { openSettingsScreen('account'); handleDeleteAccount(); }} />
                            </div>
                        </section>
                    </div>
                );
            }
        }
    };

    return (
        <div className={`fresh-page settings-editorial-page${embedded ? ' settings-editorial-page--embedded' : ''}`}>
            {!embedded ? (
                <AppTopBar
                    title={settingsTitle[settingsScreen]}
                    onBack={settingsScreen === 'root'
                        ? onBack
                        : settingsDetailBusy
                            ? undefined
                            : returnToSettingsRoot}
                />
            ) : null}
            <div
                ref={settingsContentRef}
                className="settings-editorial-content"
                tabIndex={-1}
                aria-label={settingsTitle[settingsScreen]}
            >
                {embedded && settingsScreen !== 'root' ? (
                    <header className="settings-embedded-detail-header">
                        <button
                            type="button"
                            className="settings-embedded-back"
                            aria-label={profile.language === 'en' ? 'Back to settings' : 'Назад к настройкам'}
                            disabled={settingsDetailBusy}
                            onClick={returnToSettingsRoot}
                        >
                            <ChevronLeft aria-hidden size={18} strokeWidth={1.8} />
                        </button>
                        <h1>{settingsTitle[settingsScreen]}</h1>
                    </header>
                ) : null}
                {renderSettingsContent()}
            </div>
        </div>
    );
};
