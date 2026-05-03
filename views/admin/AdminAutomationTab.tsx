import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AdminNotificationTargetSegment,
  AdminScheduledNotificationAsset,
  AdminScheduledNotificationTemplate,
  NotificationSlot,
  UserProfile,
} from '../../types';
import {
  createScheduledNotificationTemplate,
  fetchNotificationAssets,
  fetchScheduledNotificationTemplates,
  patchScheduledNotificationTemplateActive,
  runNotificationSlot,
  sendScheduledNotificationTest,
  updateScheduledNotificationTemplate,
  uploadNotificationAsset,
} from '../../services/adminService';
import { NotificationsManager } from '../../components/Admin/Notifications/NotificationsManager';
import { AdminBadge, AdminButton, AdminEmptyState, AdminInput, AdminSectionHeader, AdminSelect, AdminStateBanner, AdminSurface, AdminTextarea } from './AdminPrimitives';
import { getAdminText } from './adminText';
import { getNotificationSlotConfig, getNotificationSlotDefaultDeepLink, NOTIFICATION_SLOTS } from '../../lib/notificationSlotCatalog';

type Props = {
  profile: UserProfile;
};

type RepeatMode = 'daily' | 'weekly' | 'weekdays';

const SEGMENTS: AdminNotificationTargetSegment[] = [
  'all',
  'premium',
  'free',
  'lumi',
  'active_7d',
  'inactive_3d',
  'inactive_7d',
  'inactive_30d',
  'need_attention',
];

const SLOTS: NotificationSlot[] = NOTIFICATION_SLOTS;

const slotKey = (lang: 'ru' | 'en', slot: NotificationSlot) => {
  if (slot === 'morning') return getAdminText(lang, 'slot_morning');
  if (slot === 'day') return getAdminText(lang, 'slot_day');
  if (slot === 'evening') return getAdminText(lang, 'slot_evening');
  if (slot === 'daily_lumi') return getAdminText(lang, 'slot_daily_lumi');
  if (slot === 'upsell') return getAdminText(lang, 'slot_upsell');
  if (slot === 'promo') return getAdminText(lang, 'slot_promo');
  return getAdminText(lang, 'slot_custom');
};

const segmentLabel = (lang: 'ru' | 'en', segment: AdminNotificationTargetSegment) => {
  const labels: Record<AdminNotificationTargetSegment, string> = {
    all: getAdminText(lang, 'segment_all'),
    premium: getAdminText(lang, 'segment_premium'),
    free: getAdminText(lang, 'segment_free'),
    lumi: getAdminText(lang, 'segment_lumi'),
    active_7d: getAdminText(lang, 'segment_active_7d'),
    inactive_3d: getAdminText(lang, 'segment_inactive_3d'),
    inactive_7d: getAdminText(lang, 'segment_inactive_7d'),
    inactive_30d: getAdminText(lang, 'segment_inactive_30d'),
    need_attention: getAdminText(lang, 'segment_attention'),
  };
  return labels[segment];
};


const AUTOMATION_SMART_PRESETS: Array<{
  id: string;
  slot: NotificationSlot;
  segment: AdminNotificationTargetSegment;
  repeatMode: RepeatMode;
  sendTime: string;
  titleRu: string;
  textRu: string;
  textEn: string;
}> = [
  {
    id: 'morning_horoscope',
    slot: 'morning',
    segment: 'all',
    repeatMode: 'daily',
    sendTime: '08:00',
    titleRu: 'Утренний гороскоп + карта дня',
    textRu: 'Доброе утро! Твой гороскоп по знаку уже готов, а в карте дня видно личный ритм утра. Зайди в Lumia и начни день точнее.',
    textEn: 'Good morning! Your zodiac horoscope is ready, and the day card already shows your personal morning rhythm. Open Lumia to start with clarity.',
  },
  {
    id: 'day_focus',
    slot: 'day',
    segment: 'active_7d',
    repeatMode: 'weekdays',
    sendTime: '13:00',
    titleRu: 'Дневной фокус по карте',
    textRu: 'Середина дня: проверь гороскоп по знаку и текущий дневной слой натальной карты, чтобы вернуть фокус и не распыляться.',
    textEn: 'Midday check-in: review your zodiac horoscope and current natal day layer to regain focus and avoid noise.',
  },
  {
    id: 'evening_reflection',
    slot: 'evening',
    segment: 'all',
    repeatMode: 'daily',
    sendTime: '20:00',
    titleRu: 'Вечернее завершение дня',
    textRu: 'Вечерний слой уже готов: как прожился день по твоему знаку и что подсвечивает карта на завтра. Открой Lumia перед сном.',
    textEn: 'Your evening layer is ready: how the day unfolded for your sign and what your card highlights for tomorrow. Open Lumia before sleep.',
  },
  {
    id: 'reactivation_7d',
    slot: 'custom',
    segment: 'inactive_7d',
    repeatMode: 'weekly',
    sendTime: '12:30',
    titleRu: 'Возврат после 7 дней',
    textRu: 'Мы обновили твой гороскоп по знаку и карту текущего периода. Возвращайся в Lumia — там уже новый личный ориентир.',
    textEn: 'Your sign horoscope and current period card are refreshed. Come back to Lumia — your new personal guidance is waiting.',
  },
];

const defaultTimeBySlot: Record<NotificationSlot, string> = {
  morning: getNotificationSlotConfig('morning').defaultSendTime,
  day: getNotificationSlotConfig('day').defaultSendTime,
  evening: getNotificationSlotConfig('evening').defaultSendTime,
  daily_lumi: getNotificationSlotConfig('daily_lumi').defaultSendTime,
  upsell: getNotificationSlotConfig('upsell').defaultSendTime,
  promo: getNotificationSlotConfig('promo').defaultSendTime,
  custom: getNotificationSlotConfig('custom').defaultSendTime,
};

export const AdminAutomationTab: React.FC<Props> = ({ profile }) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const inputRef = useRef<HTMLInputElement>(null);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [templates, setTemplates] = useState<AdminScheduledNotificationTemplate[]>([]);
  const [assets, setAssets] = useState<AdminScheduledNotificationAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [slot, setSlot] = useState<NotificationSlot>('morning');
  const [targetSegment, setTargetSegment] = useState<AdminNotificationTargetSegment>(
    (getNotificationSlotConfig('morning').defaultTargetSegment || 'all') as AdminNotificationTargetSegment
  );
  const [text, setText] = useState('');
  const [assetId, setAssetId] = useState<number | null>(null);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(getNotificationSlotConfig('morning').defaultRepeatMode);
  const [sendTime, setSendTime] = useState('08:00');
  const [isActive, setIsActive] = useState(true);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [templatesPayload, assetsPayload] = await Promise.all([
        fetchScheduledNotificationTemplates(),
        fetchNotificationAssets(),
      ]);
      setTemplates(templatesPayload);
      setAssets(assetsPayload);
    } catch (loadError: any) {
      setError(loadError?.message || getAdminText(lang, 'notifications_failed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const groupedTemplates = useMemo(() => {
    const grouped: Record<NotificationSlot, AdminScheduledNotificationTemplate[]> = {
      morning: [],
      day: [],
      evening: [],
      daily_lumi: [],
      upsell: [],
      promo: [],
      custom: [],
    };
    templates.forEach((template) => {
      grouped[template.slot].push(template);
    });
    return grouped;
  }, [templates]);

  const resetDraft = () => {
    setSelectedId(null);
    setName('');
    setSlot('morning');
    setTargetSegment((getNotificationSlotConfig('morning').defaultTargetSegment || 'all') as AdminNotificationTargetSegment);
    setText('');
    setAssetId(null);
    setRepeatMode(getNotificationSlotConfig('morning').defaultRepeatMode);
    setSendTime(defaultTimeBySlot.morning);
    setIsActive(true);
  };

  const loadTemplateIntoDraft = (template: AdminScheduledNotificationTemplate) => {
    setSelectedId(template.id);
    setName(template.name);
    setSlot(template.slot);
    setTargetSegment(template.targetSegment || 'all');
    setText(template.text);
    setAssetId(template.assetId);
    setRepeatMode(((template.schedules?.[0]?.repeatMode || 'daily') as RepeatMode) || 'daily');
    setSendTime(template.schedules?.[0]?.sendTime || defaultTimeBySlot[template.slot]);
    setIsActive(template.isActive);
    setMessage(null);
  };

  const handleUpload = async (file: File) => {
    try {
      const asset = await uploadNotificationAsset(file);
      setAssets((prev) => [asset, ...prev]);
      setAssetId(asset.id);
      setMessage(getAdminText(lang, 'image_uploaded'));
    } catch (uploadError: any) {
      setError(uploadError?.message || getAdminText(lang, 'notification_send_failed'));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError(getAdminText(lang, 'template_title_required'));
      return;
    }
    if (!text.trim()) {
      setError(getAdminText(lang, 'body_required'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const existingTemplate = selectedId ? templates.find((template) => template.id === selectedId) || null : null;
      const slotConfig = getNotificationSlotConfig(slot);
      const payload = {
        name: name.trim(),
        slot,
        targetSegment,
        visualMode: assetId ? 'uploaded' : 'none',
        messageType: assetId ? 'photo' : 'text',
        text: text.trim(),
        buttonText: existingTemplate?.buttonText || slotConfig.defaultButtonText,
        deepLink: existingTemplate?.deepLink || getNotificationSlotDefaultDeepLink(slot),
        assetId,
        isActive,
        notes: existingTemplate?.notes || (lang === 'en' ? slotConfig.notesEn : slotConfig.notesRu),
        schedules: [
          {
            sendTime,
            timezone: 'Europe/Moscow',
            repeatMode,
            isActive: true,
          },
        ],
      };

      if (selectedId) {
        await updateScheduledNotificationTemplate(selectedId, payload);
      } else {
        await createScheduledNotificationTemplate(payload);
      }

      setMessage(getAdminText(lang, 'automation_saved'));
      await loadData();
      if (!selectedId) {
        resetDraft();
      }
    } catch (saveError: any) {
      setError(saveError?.message || getAdminText(lang, 'template_save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (template: AdminScheduledNotificationTemplate) => {
    try {
      await patchScheduledNotificationTemplateActive(template.id, !template.isActive);
      await loadData();
      if (selectedId === template.id) {
        setIsActive(!template.isActive);
      }
    } catch (toggleError: any) {
      setError(toggleError?.message || getAdminText(lang, 'template_save_failed'));
    }
  };

  const handleSendTest = async (template: AdminScheduledNotificationTemplate) => {
    try {
      const result = await sendScheduledNotificationTest(template.id);
      setMessage(`${slotKey(lang, template.slot)}: ${result.successCount}/${result.totalRecipients}`);
    } catch (sendError: any) {
      setError(sendError?.message || getAdminText(lang, 'notification_send_failed'));
    }
  };

  const handleRunSlot = async (slotValue: NotificationSlot) => {
    try {
      const result = await runNotificationSlot(slotValue, null);
      setMessage(`${slotKey(lang, slotValue)}: ${result.successCount}/${result.totalRecipients}`);
    } catch (runError: any) {
      setError(runError?.message || getAdminText(lang, 'notification_send_failed'));
    }
  };


  const applySmartPreset = (presetId: string) => {
    const preset = AUTOMATION_SMART_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setSelectedId(null);
    setName(preset.titleRu);
    setSlot(preset.slot);
    setTargetSegment(preset.segment);
    setRepeatMode(preset.repeatMode);
    setSendTime(preset.sendTime);
    setText(lang === 'en' ? preset.textEn : preset.textRu);
    setIsActive(true);
    setMessage(lang === 'en' ? 'Preset applied. Review and save.' : 'Пресет применён. Проверьте и сохраните.');
  };

  return (
    <div className="space-y-5">
      {message ? <AdminStateBanner tone="success">{message}</AdminStateBanner> : null}
      {error ? <AdminStateBanner tone="error">{error}</AdminStateBanner> : null}

      <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
        <AdminSectionHeader
          eyebrow="Automation"
          title={getAdminText(lang, 'automation_title')}
          subtitle={getAdminText(lang, 'automation_subtitle')}
          action={(
            <div className="flex gap-2">
              <AdminButton tone={advancedMode ? 'secondary' : 'primary'} onClick={() => setAdvancedMode(false)}>
                {getAdminText(lang, 'automation_simple')}
              </AdminButton>
              <AdminButton tone={advancedMode ? 'primary' : 'secondary'} onClick={() => setAdvancedMode(true)}>
                {getAdminText(lang, 'automation_advanced')}
              </AdminButton>
            </div>
          )}
        />
      </AdminSurface>

      {advancedMode ? (
        <NotificationsManager profile={profile} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-wrap gap-2">
              {SLOTS.map((slotOption) => (
                <AdminButton key={slotOption} tone="secondary" onClick={() => void handleRunSlot(slotOption)}>
                  {slotKey(lang, slotOption)}
                </AdminButton>
              ))}
            </div>

            <div className="mt-6 space-y-4">
              {loading ? (
                <p className="text-sm text-slate-400">{getAdminText(lang, 'automation_loading')}</p>
              ) : templates.length === 0 ? (
                <AdminEmptyState title={getAdminText(lang, 'templates_empty')} body={getAdminText(lang, 'automation_subtitle')} />
              ) : (
                SLOTS.map((slotOption) => {
                  const list = groupedTemplates[slotOption];
                  if (list.length === 0) return null;
                
  return (
                    <div key={slotOption}>
                      <p className="admin-label mb-3">{slotKey(lang, slotOption)}</p>
                      <div className="space-y-3">
                        {list.map((template) => (
                          <div key={template.id} className="admin-surface-muted p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white">{template.name}</p>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{template.text}</p>
                              </div>
                              <AdminBadge tone={template.isActive ? 'success' : 'neutral'}>
                                {template.isActive ? getAdminText(lang, 'template_active') : getAdminText(lang, 'template_disabled')}
                              </AdminBadge>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                              <span>{segmentLabel(lang, template.targetSegment || 'all')}</span>
                              <span>{template.schedules?.[0]?.sendTime || '—'}</span>
                              <span>{template.schedules?.[0]?.repeatMode || 'daily'}</span>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <AdminButton tone="secondary" onClick={() => loadTemplateIntoDraft(template)}>
                                {getAdminText(lang, 'template_edit')}
                              </AdminButton>
                              <AdminButton tone="secondary" onClick={() => void handleToggleActive(template)}>
                                {template.isActive ? getAdminText(lang, 'revoke') : getAdminText(lang, 'template_active')}
                              </AdminButton>
                              <AdminButton tone="ghost" onClick={() => void handleSendTest(template)}>
                                {lang === 'ru' ? 'Тест' : 'Test'}
                              </AdminButton>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </AdminSurface>

          <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="admin-label">{getAdminText(lang, 'automation_simple')}</p>
                <h3 className="admin-heading mt-2 text-2xl text-white">
                  {selectedId ? getAdminText(lang, 'template_edit') : getAdminText(lang, 'template_new')}
                </h3>
              </div>
              <AdminButton tone="secondary" onClick={resetDraft}>
                {getAdminText(lang, 'reset')}
              </AdminButton>
            </div>

            <div className="mt-5 space-y-4">
              <div className="admin-surface-muted p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{lang === 'ru' ? 'Смарт-сценарии' : 'Smart scenarios'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {AUTOMATION_SMART_PRESETS.map((preset) => (
                    <AdminButton key={preset.id} tone="secondary" onClick={() => applySmartPreset(preset.id)}>
                      {preset.titleRu}
                    </AdminButton>
                  ))}
                </div>
              </div>
              <AdminInput value={name} onChange={(event) => setName(event.target.value)} placeholder={getAdminText(lang, 'title')} />

              <div className="grid gap-3 sm:grid-cols-2">
                <AdminSelect value={slot} onChange={(event) => {
                  const next = event.target.value as NotificationSlot;
                  const nextConfig = getNotificationSlotConfig(next);
                  setSlot(next);
                  if (!selectedId) {
                    setSendTime(defaultTimeBySlot[next]);
                    setTargetSegment((nextConfig.defaultTargetSegment || 'all') as AdminNotificationTargetSegment);
                    setRepeatMode(nextConfig.defaultRepeatMode);
                  }
                }}>
                  {SLOTS.map((slotOption) => (
                    <option key={slotOption} value={slotOption}>{slotKey(lang, slotOption)}</option>
                  ))}
                </AdminSelect>
                <AdminSelect value={targetSegment} onChange={(event) => setTargetSegment(event.target.value as AdminNotificationTargetSegment)}>
                  {SEGMENTS.map((segment) => (
                    <option key={segment} value={segment}>{segmentLabel(lang, segment)}</option>
                  ))}
                </AdminSelect>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <AdminSelect value={repeatMode} onChange={(event) => setRepeatMode(event.target.value as RepeatMode)}>
                  <option value="daily">{getAdminText(lang, 'frequency_daily')}</option>
                  <option value="weekdays">{getAdminText(lang, 'frequency_weekdays')}</option>
                  <option value="weekly">{getAdminText(lang, 'frequency_weekly')}</option>
                </AdminSelect>
                <AdminInput type="time" value={sendTime} onChange={(event) => setSendTime(event.target.value)} />
              </div>

              <AdminTextarea value={text} onChange={(event) => setText(event.target.value)} rows={10} placeholder={getAdminText(lang, 'body_ru')} />

              <div className="admin-surface-muted p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <AdminBadge tone="neutral">{getAdminText(lang, 'choose_image')}</AdminBadge>
                  {assetId ? <AdminBadge tone="info">ID {assetId}</AdminBadge> : <AdminBadge tone="neutral">{getAdminText(lang, 'no_image')}</AdminBadge>}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <AdminSelect value={assetId ?? ''} onChange={(event) => setAssetId(event.target.value ? Number(event.target.value) : null)}>
                    <option value="">{getAdminText(lang, 'no_image')}</option>
                    {assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>{asset.fileName}</option>
                    ))}
                  </AdminSelect>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void handleUpload(file);
                      }
                      event.target.value = '';
                    }}
                  />
                  <AdminButton tone="secondary" onClick={() => inputRef.current?.click()}>
                    {getAdminText(lang, 'upload_image')}
                  </AdminButton>
                </div>
                {assetId ? (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-[#06101b]">
                    <img
                      src={assets.find((asset) => asset.id === assetId)?.publicUrl || ''}
                      alt=""
                      className="h-44 w-full object-cover"
                    />
                  </div>
                ) : null}
              </div>

              <label className="flex items-center gap-3 text-sm text-slate-300">
                <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
                {getAdminText(lang, 'template_active')}
              </label>

              <div className="admin-sticky-footer rounded-[22px] border border-sky-400/20 bg-[#081120]/92 p-4 backdrop-blur">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm leading-6 text-slate-300">
                    {slotKey(lang, slot)} · {segmentLabel(lang, targetSegment)} · {sendTime}
                  </p>
                  <AdminButton tone="primary" disabled={saving} onClick={() => void handleSave()}>
                    {saving ? getAdminText(lang, 'sending') : getAdminText(lang, 'automation_save')}
                  </AdminButton>
                </div>
              </div>
            </div>
          </AdminSurface>
        </div>
      )}
    </div>
  );
};
