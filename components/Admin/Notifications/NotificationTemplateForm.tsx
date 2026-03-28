import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { AdminScheduledNotificationAsset, AdminScheduledNotificationTemplate, NotificationSlot } from '../../../types';
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
} from '../../../services/adminService';

const SLOTS: NotificationSlot[] = ['morning', 'day', 'evening', 'custom'];

interface NotificationTemplateFormProps {
  template: AdminScheduledNotificationTemplate | null;
  assets: AdminScheduledNotificationAsset[];
  onSaved: (result?: { id?: number }) => Promise<void>;
  onUploadAsset: (file: File) => Promise<void>;
  onDeleteAsset: (id: number) => Promise<void>;
  assetUploading: boolean;
  lang: 'ru' | 'en';
}

const T = (lang: 'ru' | 'en', ru: string, en: string) => (lang === 'ru' ? ru : en);

const emptyPreview: PreviewModel = {
  messageType: 'text',
  text: '',
  imageUrl: null,
  buttonText: null,
  buttonUrl: null,
  hasInlineButton: false,
};

export const NotificationTemplateForm = memo<NotificationTemplateFormProps>(
  ({ template, assets, onSaved, onUploadAsset, onDeleteAsset, assetUploading, lang }) => {
    const [name, setName] = useState('');
    const [slot, setSlot] = useState<NotificationSlot>('custom');
    const [messageType, setMessageType] = useState<'text' | 'photo'>('text');
    const [text, setText] = useState('');
    const [buttonText, setButtonText] = useState('');
    const [deepLink, setDeepLink] = useState('');
    const [assetId, setAssetId] = useState<number | null>(null);
    const [isActive, setIsActive] = useState(true);
    const [sortOrder, setSortOrder] = useState(0);
    const [rotationGroup, setRotationGroup] = useState('');
    const [notes, setNotes] = useState('');
    const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>(schedulesToRows(undefined));
    const [preview, setPreview] = useState<PreviewModel>(emptyPreview);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      if (template) {
        setName(template.name);
        setSlot(template.slot);
        setMessageType(template.messageType);
        setText(template.text);
        setButtonText(template.buttonText);
        setDeepLink(template.deepLink);
        setAssetId(template.assetId);
        setIsActive(template.isActive);
        setSortOrder(template.sortOrder);
        setRotationGroup(template.rotationGroup || '');
        setNotes(template.notes || '');
        setScheduleRows(schedulesToRows(template.schedules));
      } else {
        setName('');
        setSlot('morning');
        setMessageType('text');
        setText('');
        setButtonText(T(lang, 'Открыть Lumia', 'Open Lumia'));
        setDeepLink('');
        setAssetId(null);
        setIsActive(true);
        setSortOrder(0);
        setRotationGroup('');
        setNotes('');
        setScheduleRows(schedulesToRows(undefined));
      }
    }, [template, lang]);

    const selectedAssetUrl = useMemo(() => {
      if (!assetId) return null;
      return assets.find((a) => a.id === assetId)?.publicUrl || null;
    }, [assetId, assets]);

    const refreshPreview = useCallback(async () => {
      try {
        const data = await previewScheduledNotification({
          name: name || 'x',
          slot,
          messageType,
          text,
          buttonText,
          deepLink,
          assetId,
          isActive: true,
          sortOrder,
          rotationGroup: rotationGroup.trim() || null,
          notes: notes.trim() || null,
          previewImageUrl: selectedAssetUrl,
        });
        setPreview({
          messageType: data.preview.messageType as 'text' | 'photo',
          text: data.preview.text,
          imageUrl: data.preview.imageUrl,
          buttonText: data.preview.buttonText,
          buttonUrl: data.preview.buttonUrl,
          hasInlineButton: data.preview.hasInlineButton,
        });
        setError(null);
      } catch (e: any) {
        setError(e?.message || 'Preview failed');
      }
    }, [name, slot, messageType, text, buttonText, deepLink, assetId, sortOrder, rotationGroup, notes, selectedAssetUrl]);

    useEffect(() => {
      const t = setTimeout(() => {
        void refreshPreview();
      }, 400);
      return () => clearTimeout(t);
    }, [refreshPreview]);

    const handleSave = async () => {
      setSaving(true);
      setError(null);
      try {
        const payload = {
          name,
          slot,
          messageType,
          text,
          buttonText,
          deepLink,
          assetId,
          isActive,
          sortOrder,
          rotationGroup: rotationGroup.trim() || null,
          notes: notes.trim() || null,
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
        setError(e?.message || T(lang, 'Ошибка сохранения', 'Save failed'));
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-astro-border bg-astro-card p-4">
          <h4 className="font-serif text-lg text-astro-text">
            {template
              ? T(lang, 'Редактирование', 'Edit template')
              : T(lang, 'Новый шаблон', 'New template')}
          </h4>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={T(lang, 'Внутреннее имя', 'Internal name')}
            className="w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-astro-subtext">
              {T(lang, 'Слот', 'Slot')}
              <select
                value={slot}
                onChange={(e) => setSlot(e.target.value as NotificationSlot)}
                className="mt-1 w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text"
              >
                {SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-astro-subtext">
              {T(lang, 'Тип', 'Type')}
              <select
                value={messageType}
                onChange={(e) => setMessageType(e.target.value as 'text' | 'photo')}
                className="mt-1 w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text"
              >
                <option value="text">text</option>
                <option value="photo">photo</option>
              </select>
            </label>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder={T(lang, 'Текст уведомления', 'Message text')}
            className="w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text"
          />

          <input
            value={buttonText}
            onChange={(e) => setButtonText(e.target.value)}
            placeholder={T(lang, 'Текст кнопки', 'Button label')}
            className="w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text"
          />

          <input
            value={deepLink}
            onChange={(e) => setDeepLink(e.target.value)}
            placeholder="https://… (mini app URL)"
            className="w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-astro-subtext">
              {T(lang, 'Порядок', 'Sort order')}
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text"
              />
            </label>
            <label className="text-xs text-astro-subtext">
              {T(lang, 'Группа ротации', 'Rotation group')}
              <input
                value={rotationGroup}
                onChange={(e) => setRotationGroup(e.target.value)}
                placeholder={T(lang, 'опционально', 'optional')}
                className="mt-1 w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text"
              />
            </label>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder={T(lang, 'Заметки админа', 'Admin notes')}
            className="w-full rounded-lg border border-astro-border bg-astro-bg px-3 py-2 text-sm text-astro-text"
          />

          <label className="flex items-center gap-2 text-sm text-astro-text">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            {T(lang, 'Активен', 'Active')}
          </label>

          {messageType === 'photo' ? (
            <div>
              <p className="mb-2 text-xs text-astro-subtext">{T(lang, 'Изображение', 'Image')}</p>
              <NotificationAssetPicker
                assets={assets}
                selectedId={assetId}
                onSelect={setAssetId}
                onUpload={onUploadAsset}
                onDeleteAsset={onDeleteAsset}
                uploading={assetUploading}
                lang={lang}
              />
            </div>
          ) : null}

          <NotificationScheduleEditor rows={scheduleRows} onChange={setScheduleRows} lang={lang} />

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="w-full rounded-lg bg-astro-highlight py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? T(lang, 'Сохранение…', 'Saving…') : T(lang, 'Сохранить', 'Save')}
          </button>
        </div>

        <NotificationPreview preview={preview} lang={lang} />
      </div>
    );
  }
);

NotificationTemplateForm.displayName = 'NotificationTemplateForm';
