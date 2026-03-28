import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AdminNotificationDeliveryLogItem,
  AdminScheduledNotificationAsset,
  AdminScheduledNotificationTemplate,
  UserProfile,
} from '../../../types';
import {
  deleteNotificationAsset,
  deleteScheduledNotificationTemplate,
  fetchNotificationAssets,
  fetchNotificationDeliveryLog,
  fetchScheduledNotificationTemplate,
  fetchScheduledNotificationTemplates,
  patchScheduledNotificationTemplateActive,
  runNotificationSlot,
  sendScheduledNotificationTest,
  uploadNotificationAsset,
  createScheduledNotificationTemplate,
} from '../../../services/adminService';
import { NotificationTemplateList } from './NotificationTemplateList';
import { NotificationTemplateForm } from './NotificationTemplateForm';
import { NotificationMediaLibrary } from './NotificationMediaLibrary';

interface NotificationsManagerProps {
  profile: UserProfile;
}

type CmsTab = 'templates' | 'media';

export const NotificationsManager: React.FC<NotificationsManagerProps> = ({ profile: _profile }) => {
  const [cmsTab, setCmsTab] = useState<CmsTab>('templates');
  const [templates, setTemplates] = useState<AdminScheduledNotificationTemplate[]>([]);
  const [assets, setAssets] = useState<AdminScheduledNotificationAsset[]>([]);
  const [deliveryLog, setDeliveryLog] = useState<AdminNotificationDeliveryLogItem[]>([]);
  const [selected, setSelected] = useState<AdminScheduledNotificationTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [assetUploading, setAssetUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [t, a, l] = await Promise.all([
        fetchScheduledNotificationTemplates(),
        fetchNotificationAssets(),
        fetchNotificationDeliveryLog(40),
      ]);
      setTemplates(t);
      setAssets(a);
      setDeliveryLog(l);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleSaved = useCallback(
    async (result?: { id?: number }) => {
      await loadAll();
      const idToOpen = result?.id ?? selected?.id;
      if (idToOpen != null) {
        try {
          setSelected(await fetchScheduledNotificationTemplate(idToOpen));
        } catch {
          /* ignore */
        }
      }
    },
    [loadAll, selected?.id]
  );

  const openTemplate = async (t: AdminScheduledNotificationTemplate | null) => {
    if (!t) {
      setSelected(null);
      return;
    }
    try {
      const full = await fetchScheduledNotificationTemplate(t.id);
      setSelected(full);
    } catch {
      setSelected(t);
    }
  };

  const handleDuplicate = async (t: AdminScheduledNotificationTemplate) => {
    try {
      await createScheduledNotificationTemplate({
        name: `${t.name} (копия)`,
        slot: t.slot,
        visualMode: t.visualMode || 'none',
        messageType: t.messageType,
        text: t.text,
        buttonText: t.buttonText,
        deepLink: t.deepLink,
        assetId: t.assetId,
        generatedPreset: t.generatedPreset,
        generatedTitle: t.generatedTitle,
        generatedSubtitle: t.generatedSubtitle,
        generatedAccent: t.generatedAccent,
        generatedShowDate: t.generatedShowDate,
        generatedShowSlotLabel: t.generatedShowSlotLabel,
        generatedZodiacMode: t.generatedZodiacMode,
        generatedCustomZodiac: t.generatedCustomZodiac,
        isActive: false,
        notes: t.notes,
        schedules: (t.schedules || []).map((s) => ({
          sendTime: s.sendTime,
          timezone: s.timezone,
          repeatMode: s.repeatMode,
          isActive: s.isActive,
        })),
      });
      setToast('Дубликат создан');
      await loadAll();
    } catch (e: any) {
      setToast(e?.message || 'Ошибка');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить шаблон?')) return;
    try {
      await deleteScheduledNotificationTemplate(id);
      if (selected?.id === id) setSelected(null);
      await loadAll();
    } catch (e: any) {
      setToast(e?.message || 'Ошибка');
    }
  };

  const handleToggle = async (id: number, isActive: boolean) => {
    try {
      await patchScheduledNotificationTemplateActive(id, isActive);
      await loadAll();
      if (selected?.id === id) {
        setSelected((prev) => (prev ? { ...prev, isActive } : null));
      }
    } catch (e: any) {
      setToast(e?.message || 'Ошибка');
    }
  };

  const handleTest = async (id: number) => {
    try {
      const r = await sendScheduledNotificationTest(id);
      setToast(`Тест: ${r.successCount} ок, ${r.failureCount} ошибок`);
      await loadAll();
    } catch (e: any) {
      setToast(e?.message || 'Ошибка');
    }
  };

  const handleRunSlot = async (slot: 'morning' | 'day' | 'evening' | 'custom') => {
    try {
      const r = await runNotificationSlot(slot, null);
      setToast(`Слот: шаблон #${r.templateId ?? '—'}, ${r.successCount}/${r.totalRecipients}`);
      await loadAll();
    } catch (e: any) {
      setToast(e?.message || 'Ошибка');
    }
  };

  const onUploadAsset = async (file: File) => {
    setAssetUploading(true);
    try {
      const a = await uploadNotificationAsset(file);
      setAssets((prev) => [a, ...prev]);
      setSelected((prev) =>
        prev && (prev.visualMode === 'uploaded' || prev.messageType === 'photo') ? { ...prev, assetId: a.id } : prev
      );
      setToast('Файл загружен');
    } catch (e: any) {
      setToast(e?.message || 'Не удалось загрузить');
    } finally {
      setAssetUploading(false);
    }
  };

  const onDeleteAsset = async (id: number) => {
    try {
      await deleteNotificationAsset(id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
      if (selected?.assetId === id) {
        setSelected((prev) => (prev ? { ...prev, assetId: null } : null));
      }
    } catch (e: any) {
      setToast(e?.message || 'Нельзя удалить: возможно, файл используется');
    }
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const visualLabelRu = useMemo(
    () =>
      ({
        none: 'текст',
        uploaded: 'фото',
        generated: 'карточка',
      }) as const,
    []
  );

  return (
    <div className="space-y-6">
      {toast ? (
        <div className="rounded-lg border border-astro-highlight/30 bg-astro-highlight/10 px-3 py-2 text-sm text-astro-text">
          {toast}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-2xl border border-astro-border bg-astro-card/40 p-2">
        <button
          type="button"
          onClick={() => setCmsTab('templates')}
          className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
            cmsTab === 'templates' ? 'bg-astro-highlight text-white' : 'text-astro-subtext hover:text-astro-text'
          }`}
        >
          Шаблоны и автоматика
        </button>
        <button
          type="button"
          onClick={() => setCmsTab('media')}
          className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
            cmsTab === 'media' ? 'bg-astro-highlight text-white' : 'text-astro-subtext hover:text-astro-text'
          }`}
        >
          Медиатека ({assets.length})
        </button>
      </div>

      {cmsTab === 'media' ? (
        <div className="rounded-2xl border border-astro-border bg-astro-card p-4">
          <NotificationMediaLibrary
            assets={assets}
            uploading={assetUploading}
            onUpload={onUploadAsset}
            onDelete={onDeleteAsset}
            onRefresh={() => void loadAll()}
          />
        </div>
      ) : null}

      {cmsTab === 'templates' ? (
        <>
          <div className="rounded-2xl border border-astro-border bg-astro-card p-4">
            <NotificationTemplateList
              templates={templates}
              selectedId={selected?.id ?? null}
              onSelect={(t) => void openTemplate(t)}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onToggleActive={handleToggle}
              onTestSend={handleTest}
              onRunSlot={handleRunSlot}
              onNew={() => setSelected(null)}
              loading={loading}
              visualLabelRu={visualLabelRu}
            />
          </div>

          <NotificationTemplateForm
            template={selected}
            assets={assets}
            onSaved={handleSaved}
            onUploadAsset={onUploadAsset}
            onDeleteAsset={onDeleteAsset}
            assetUploading={assetUploading}
          />
        </>
      ) : null}

      <section className="rounded-2xl border border-astro-border bg-astro-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-lg text-astro-text">Журнал доставки</h3>
          <button type="button" onClick={() => void loadAll()} className="text-xs text-astro-highlight">
            Обновить
          </button>
        </div>
        {deliveryLog.length === 0 ? (
          <p className="text-sm text-astro-subtext">Пока пусто</p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto text-xs">
            {deliveryLog.map((row) => (
              <div key={row.id} className="rounded-lg border border-astro-border/50 bg-astro-bg/20 p-2">
                <p className="font-medium text-astro-text">
                  {row.templateName || `#${row.templateId ?? '—'}`} · {row.status}
                </p>
                <p className="text-astro-subtext">
                  {row.successCount}/{row.recipientCount} успешно
                  {row.failureCount ? ` · ${row.failureCount} ошибок` : ''}
                  {row.visualMode ? ` · ${visualLabelRu[row.visualMode as keyof typeof visualLabelRu] || row.visualMode}` : ''}
                  {row.generatedPreset ? ` · ${row.generatedPreset}` : ''}
                  {row.generatedCacheHit === true ? ' · из кэша' : row.generatedCacheHit === false ? ' · сгенерировано' : ''}
                </p>
                {row.errorSummary ? <p className="text-red-300/90">{row.errorSummary}</p> : null}
                <p className="text-[10px] text-astro-subtext/80">{row.sentAt || row.createdAt}</p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[10px] text-astro-subtext">
          Cron: POST /api/cron/notifications-daily с заголовком Authorization: Bearer CRON_SECRET
        </p>
      </section>
    </div>
  );
};
