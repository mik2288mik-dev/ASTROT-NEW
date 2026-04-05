import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AdminScheduledNotificationAsset,
  AdminScheduledNotificationTemplate,
  NotificationGeneratedZodiacMode,
  NotificationSlot,
  NotificationVisualMode,
} from '../../../types';
import { NOTIFICATION_CARD_PRESETS, GENERATED_PRESET_IDS } from '../../../lib/notificationCardPresets';
import { NotificationAssetPicker } from './NotificationAssetPicker';
import { NotificationPreview, type PreviewModel } from './NotificationPreview';
import { NotificationScheduleEditor, schedulesToRows, type ScheduleRow } from './NotificationScheduleEditor';
import {
  previewScheduledNotification,
  createScheduledNotificationTemplate,
  updateScheduledNotificationTemplate,
  createNotificationSchedule,
  updateNotificationSchedule,
  deleteNotificationSchedule,
  fetchGeneratedCardPreviewObjectUrl,
} from '../../../services/adminService';
import { NOTIFICATION_SLOTS } from '../../../lib/notificationSlotCatalog';

const SLOTS: NotificationSlot[] = NOTIFICATION_SLOTS;

const SLOT_LABEL_RU: Record<NotificationSlot, string> = {
  morning: 'Утро',
  day: 'День',
  evening: 'Вечер',
  daily_lumi: 'Ежедневные Lumi',
  upsell: 'Без Premium',
  promo: 'Промо',
  custom: 'Свой слот',
};

interface NotificationTemplateFormProps {
  template: AdminScheduledNotificationTemplate | null;
  assets: AdminScheduledNotificationAsset[];
  onSaved: (result?: { id?: number }) => Promise<void>;
  onUploadAsset: (file: File) => Promise<void>;
  onDeleteAsset: (id: number) => Promise<void>;
  assetUploading: boolean;
}

const emptyPreview: PreviewModel = {
  visualMode: 'none',
  messageType: 'text',
  text: '',
  imageUrl: null,
  generatedCardUrl: null,
  buttonText: null,
  buttonUrl: null,
  hasInlineButton: false,
};

export const NotificationTemplateForm = memo<NotificationTemplateFormProps>(
  ({ template, assets, onSaved, onUploadAsset, onDeleteAsset, assetUploading }) => {
    const [name, setName] = useState('');
    const [slot, setSlot] = useState<NotificationSlot>('custom');
    const [visualMode, setVisualMode] = useState<NotificationVisualMode>('none');
    const [text, setText] = useState('');
    const [buttonText, setButtonText] = useState('');
    const [deepLink, setDeepLink] = useState('');
    const [assetId, setAssetId] = useState<number | null>(null);
    const [generatedPreset, setGeneratedPreset] = useState<string>('morning-soft');
    const [generatedTitle, setGeneratedTitle] = useState('');
    const [generatedSubtitle, setGeneratedSubtitle] = useState('');
    const [generatedAccent, setGeneratedAccent] = useState('');
    const [generatedShowDate, setGeneratedShowDate] = useState(false);
    const [generatedShowSlotLabel, setGeneratedShowSlotLabel] = useState(false);
    const [generatedZodiacMode, setGeneratedZodiacMode] = useState<NotificationGeneratedZodiacMode | 'none'>('none');
    const [generatedCustomZodiac, setGeneratedCustomZodiac] = useState('');
    const [previewSunSign, setPreviewSunSign] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [notes, setNotes] = useState('');
    const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>(schedulesToRows(undefined));
    const [preview, setPreview] = useState<PreviewModel>(emptyPreview);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const cardObjectUrlRef = useRef<string | null>(null);

    const messageType = visualMode === 'none' ? 'text' : 'photo';

    useEffect(() => {
      if (template) {
        setName(template.name);
        setSlot(template.slot);
        setVisualMode(template.visualMode || 'none');
        setText(template.text);
        setButtonText(template.buttonText);
        setDeepLink(template.deepLink);
        setAssetId(template.assetId);
        setGeneratedPreset(template.generatedPreset || 'morning-soft');
        setGeneratedTitle(template.generatedTitle || '');
        setGeneratedSubtitle(template.generatedSubtitle || '');
        setGeneratedAccent(template.generatedAccent || '');
        setGeneratedShowDate(template.generatedShowDate);
        setGeneratedShowSlotLabel(template.generatedShowSlotLabel);
        setGeneratedZodiacMode((template.generatedZodiacMode as NotificationGeneratedZodiacMode) || 'none');
        setGeneratedCustomZodiac(template.generatedCustomZodiac || '');
        setIsActive(template.isActive);
        setNotes(template.notes || '');
        setScheduleRows(schedulesToRows(template.schedules));
      } else {
        setName('');
        setSlot('morning');
        setVisualMode('none');
        setText('');
        setButtonText('Открыть Lumia');
        setDeepLink('');
        setAssetId(null);
        setGeneratedPreset('morning-soft');
        setGeneratedTitle('');
        setGeneratedSubtitle('');
        setGeneratedAccent('');
        setGeneratedShowDate(false);
        setGeneratedShowSlotLabel(false);
        setGeneratedZodiacMode('none');
        setGeneratedCustomZodiac('');
        setIsActive(true);
        setNotes('');
        setScheduleRows(schedulesToRows(undefined));
      }
    }, [template]);

    const selectedAssetUrl = useMemo(() => {
      if (!assetId) return null;
      return assets.find((a) => a.id === assetId)?.publicUrl || null;
    }, [assetId, assets]);

    const buildPreviewPayload = useCallback(() => {
      const firstTz = scheduleRows[0]?.timezone || 'Europe/Moscow';
      return {
        name: name || 'x',
        slot,
        visualMode,
        messageType,
        text,
        buttonText,
        deepLink,
        assetId,
        isActive: true,
        sortOrder: 0,
        rotationGroup: null,
        notes: notes.trim() || null,
        generatedPreset: visualMode === 'generated' ? generatedPreset : null,
        generatedTitle: generatedTitle.trim() || null,
        generatedSubtitle: generatedSubtitle.trim() || null,
        generatedAccent: generatedAccent.trim() || null,
        generatedShowDate,
        generatedShowSlotLabel,
        generatedZodiacMode: visualMode === 'generated' && generatedZodiacMode !== 'none' ? generatedZodiacMode : null,
        generatedCustomZodiac:
          visualMode === 'generated' && generatedZodiacMode === 'custom' ? generatedCustomZodiac.trim() || null : null,
        previewImageUrl: selectedAssetUrl,
        previewSunSign: previewSunSign.trim() || undefined,
        scheduleTimezone: firstTz,
        templateId: template?.id,
      };
    }, [
      name,
      slot,
      visualMode,
      messageType,
      text,
      buttonText,
      deepLink,
      assetId,
      notes,
      generatedPreset,
      generatedTitle,
      generatedSubtitle,
      generatedAccent,
      generatedShowDate,
      generatedShowSlotLabel,
      generatedZodiacMode,
      generatedCustomZodiac,
      selectedAssetUrl,
      previewSunSign,
      scheduleRows,
      template?.id,
    ]);

    const refreshPreview = useCallback(async () => {
      if (cardObjectUrlRef.current) {
        URL.revokeObjectURL(cardObjectUrlRef.current);
        cardObjectUrlRef.current = null;
      }
      try {
        const payload = buildPreviewPayload();
        const data = await previewScheduledNotification(payload);
        const base: PreviewModel = {
          visualMode: (data.preview.visualMode as NotificationVisualMode) || 'none',
          messageType: data.preview.messageType as 'text' | 'photo',
          text: data.preview.text,
          imageUrl: data.preview.imageUrl,
          generatedCardUrl: null,
          buttonText: data.preview.buttonText,
          buttonUrl: data.preview.buttonUrl,
          hasInlineButton: data.preview.hasInlineButton,
        };

        if (base.visualMode === 'generated' && data.preview.generatedCardPreviewPath) {
          const url = await fetchGeneratedCardPreviewObjectUrl(payload);
          cardObjectUrlRef.current = url;
          base.generatedCardUrl = url;
        }

        setPreview(base);
        setError(null);
      } catch (e: any) {
        setError(e?.message || 'Preview failed');
      }
    }, [buildPreviewPayload]);

    useEffect(() => {
      const t = setTimeout(() => {
        void refreshPreview();
      }, 450);
      return () => clearTimeout(t);
    }, [refreshPreview]);

    useEffect(() => {
      return () => {
        if (cardObjectUrlRef.current) {
          URL.revokeObjectURL(cardObjectUrlRef.current);
        }
      };
    }, []);

    const handleSave = async () => {
      setSaving(true);
      setError(null);
      try {
        const payload = {
          name,
          slot,
          visualMode,
          messageType,
          text,
          buttonText,
          deepLink,
          assetId: visualMode === 'uploaded' ? assetId : null,
          isActive,
          sortOrder: 0,
          rotationGroup: null,
          notes: notes.trim() || null,
          generatedPreset: visualMode === 'generated' ? generatedPreset : null,
          generatedTitle: generatedTitle.trim() || null,
          generatedSubtitle: generatedSubtitle.trim() || null,
          generatedAccent: generatedAccent.trim() || null,
          generatedShowDate,
          generatedShowSlotLabel,
          generatedZodiacMode: visualMode === 'generated' && generatedZodiacMode !== 'none' ? generatedZodiacMode : null,
          generatedCustomZodiac:
            visualMode === 'generated' && generatedZodiacMode === 'custom' ? generatedCustomZodiac.trim() || null : null,
        };

        let savedId: number;
        if (template) {
          await updateScheduledNotificationTemplate(template.id, payload);
          savedId = template.id;
        } else {
          const created = await createScheduledNotificationTemplate({
            ...payload,
            schedules: scheduleRows.map((r) => ({
              sendTime: r.sendTime,
              timezone: r.timezone,
              repeatMode: r.repeatMode,
              isActive: r.isActive,
            })),
          });
          savedId = created.id;
        }

        if (template) {
          const existingIds = new Set((template.schedules || []).map((s) => s.id));
          const currentIds = new Set(scheduleRows.filter((r) => r.id).map((r) => r.id!));

          for (const sid of existingIds) {
            if (!currentIds.has(sid)) {
              await deleteNotificationSchedule(sid);
            }
          }

          for (const row of scheduleRows) {
            if (row.id) {
              await updateNotificationSchedule(row.id, {
                sendTime: row.sendTime,
                timezone: row.timezone,
                repeatMode: row.repeatMode,
                isActive: row.isActive,
              });
            } else {
              await createNotificationSchedule({
                templateId: savedId,
                sendTime: row.sendTime,
                timezone: row.timezone,
                repeatMode: row.repeatMode,
                isActive: row.isActive,
              });
            }
          }
        }

        await onSaved(template ? undefined : { id: savedId });
      } catch (e: any) {
        setError(e?.message || 'Ошибка сохранения');
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-astro-border bg-astro-card p-4">
          <h4 className="font-serif text-lg text-astro-text">
            {template ? 'Редактирование шаблона' : 'Новый шаблон'}
          </h4>
          <p className="text-[11px] text-astro-subtext">
            Порядок в очереди слота задаётся автоматически (новые шаблоны добавляются в конец). Группы ротации не используются.
          </p>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Внутреннее название (для себя)"
            className="w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-astro-subtext">
              Слот дня
              <select
                value={slot}
                onChange={(e) => setSlot(e.target.value as NotificationSlot)}
                className="mt-1 w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text"
              >
                {SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {SLOT_LABEL_RU[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-astro-subtext">
              Визуал
              <select
                value={visualMode}
                onChange={(e) => setVisualMode(e.target.value as NotificationVisualMode)}
                className="mt-1 w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text"
              >
                <option value="none">Только текст</option>
                <option value="uploaded">Загруженное фото</option>
                <option value="generated">Карточка Lumia</option>
              </select>
            </label>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder={
              visualMode === 'generated'
                ? 'Текст под карточкой (подпись к фото)'
                : 'Текст уведомления'
            }
            className="w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text"
          />

          {visualMode === 'generated' ? (
            <div className="space-y-3 rounded-xl border border-astro-border/60 bg-astro-bg/25 p-3">
              <label className="block text-xs text-astro-subtext">
                Стиль карточки
                <select
                  value={generatedPreset}
                  onChange={(e) => setGeneratedPreset(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text"
                >
                  {GENERATED_PRESET_IDS.map((id) => (
                    <option key={id} value={id}>
                      {NOTIFICATION_CARD_PRESETS[id].label.ru}
                    </option>
                  ))}
                </select>
              </label>
              <input
                value={generatedTitle}
                onChange={(e) => setGeneratedTitle(e.target.value)}
                placeholder="Заголовок на карточке"
                className="w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text"
              />
              <input
                value={generatedSubtitle}
                onChange={(e) => setGeneratedSubtitle(e.target.value)}
                placeholder="Подзаголовок"
                className="w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text"
              />
              <input
                value={generatedAccent}
                onChange={(e) => setGeneratedAccent(e.target.value)}
                placeholder="Акцентная строка"
                className="w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text"
              />
              <label className="flex items-center gap-2 text-sm text-astro-text">
                <input type="checkbox" checked={generatedShowDate} onChange={(e) => setGeneratedShowDate(e.target.checked)} />
                Показывать дату
              </label>
              <label className="flex items-center gap-2 text-sm text-astro-text">
                <input
                  type="checkbox"
                  checked={generatedShowSlotLabel}
                  onChange={(e) => setGeneratedShowSlotLabel(e.target.checked)}
                />
                Метка слота (утро / день / вечер)
              </label>
              <label className="block text-xs text-astro-subtext">
                Зодиак на карточке
                <select
                  value={generatedZodiacMode}
                  onChange={(e) => setGeneratedZodiacMode(e.target.value as NotificationGeneratedZodiacMode)}
                  className="mt-1 w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text"
                >
                  <option value="none">Нет</option>
                  <option value="sun_sign">Знак Солнца пользователя</option>
                  <option value="custom">Свой текст</option>
                </select>
              </label>
              {generatedZodiacMode === 'custom' ? (
                <input
                  value={generatedCustomZodiac}
                  onChange={(e) => setGeneratedCustomZodiac(e.target.value)}
                  placeholder="Например: ☉ Рыбы"
                  className="w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text"
                />
              ) : null}
              <div className="border-t border-astro-border/40 pt-2">
                <p className="text-[10px] uppercase text-astro-subtext">
                  Для предпросмотра: знак Солнца
                </p>
                <input
                  value={previewSunSign}
                  onChange={(e) => setPreviewSunSign(e.target.value)}
                  placeholder="Рыбы / Pisces"
                  className="mt-1 w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-xs text-astro-text"
                />
              </div>
            </div>
          ) : null}

          {visualMode === 'uploaded' ? (
            <div>
              <p className="mb-2 text-xs text-astro-subtext">Изображение для Telegram</p>
              <NotificationAssetPicker
                assets={assets}
                selectedId={assetId}
                onSelect={setAssetId}
                onUpload={onUploadAsset}
                onDeleteAsset={onDeleteAsset}
                uploading={assetUploading}
              />
            </div>
          ) : null}

          <input
            value={buttonText}
            onChange={(e) => setButtonText(e.target.value)}
            placeholder="Текст кнопки"
            className="w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text"
          />

          <input
            value={deepLink}
            onChange={(e) => setDeepLink(e.target.value)}
            placeholder="https://… (ссылка мини-приложения)"
            className="w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text"
          />

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Заметки (только для админов, в рассылку не идут)"
            className="w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text"
          />

          <label className="flex items-center gap-2 text-sm text-astro-text">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Шаблон активен
          </label>

          <NotificationScheduleEditor rows={scheduleRows} onChange={setScheduleRows} />

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="w-full rounded-lg bg-astro-highlight py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>

        <NotificationPreview preview={preview} />
      </div>
    );
  }
);

NotificationTemplateForm.displayName = 'NotificationTemplateForm';
