import React, { useCallback, useEffect, useState } from 'react';
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

interface NotificationsManagerProps {
  profile: UserProfile;
}

const T = (lang: 'ru' | 'en', ru: string, en: string) => (lang === 'ru' ? ru : en);

export const NotificationsManager: React.FC<NotificationsManagerProps> = ({ profile }) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
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
        name: `${t.name} (copy)`,
        slot: t.slot,
        messageType: t.messageType,
        text: t.text,
        buttonText: t.buttonText,
        deepLink: t.deepLink,
        assetId: t.assetId,
        isActive: false,
        sortOrder: t.sortOrder + 1,
        rotationGroup: t.rotationGroup,
        notes: t.notes,
        schedules: (t.schedules || []).map((s) => ({
          sendTime: s.sendTime,
          timezone: s.timezone,
          repeatMode: s.repeatMode,
          isActive: s.isActive,
        })),
      });
      setToast(T(lang, 'Дубликат создан', 'Duplicate created'));
      await loadAll();
    } catch (e: any) {
      setToast(e?.message || 'Error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(T(lang, 'Удалить шаблон?', 'Delete template?'))) return;
    try {
      await deleteScheduledNotificationTemplate(id);
      if (selected?.id === id) setSelected(null);
      await loadAll();
    } catch (e: any) {
      setToast(e?.message || 'Error');
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
      setToast(e?.message || 'Error');
    }
  };

  const handleTest = async (id: number) => {
    try {
      const r = await sendScheduledNotificationTest(id);
      setToast(
        T(
          lang,
          `Тест: ${r.successCount} ок, ${r.failureCount} ошибок`,
          `Test: ${r.successCount} ok, ${r.failureCount} failed`
        )
      );
      await loadAll();
    } catch (e: any) {
      setToast(e?.message || 'Error');
    }
  };

  const handleRunSlot = async (slot: 'morning' | 'day' | 'evening' | 'custom') => {
    try {
      const r = await runNotificationSlot(slot, null);
      setToast(
        T(
          lang,
          `Слот: шаблон #${r.templateId ?? '—'}, ${r.successCount}/${r.totalRecipients}`,
          `Slot: template #${r.templateId ?? '—'}, ${r.successCount}/${r.totalRecipients}`
        )
      );
      await loadAll();
    } catch (e: any) {
      setToast(e?.message || 'Error');
    }
  };

  const onUploadAsset = async (file: File) => {
    setAssetUploading(true);
    try {
      const a = await uploadNotificationAsset(file);
      setAssets((prev) => [a, ...prev]);
      setAssetIdIfNew(a.id);
    } finally {
      setAssetUploading(false);
    }
  };

  const setAssetIdIfNew = (id: number) => {
    setSelected((prev) => (prev && prev.messageType === 'photo' ? { ...prev, assetId: id } : prev));
  };

  const onDeleteAsset = async (id: number) => {
    try {
      await deleteNotificationAsset(id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
      if (selected?.assetId === id) {
        setSelected((prev) => (prev ? { ...prev, assetId: null } : null));
      }
    } catch (e: any) {
      setToast(e?.message || 'Cannot delete');
    }
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="space-y-6">
      {toast ? (
        <div className="rounded-lg border border-astro-highlight/30 bg-astro-highlight/10 px-3 py-2 text-sm text-astro-text">
          {toast}
        </div>
      ) : null}

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
          lang={lang}
        />
      </div>

      <NotificationTemplateForm
        template={selected}
        assets={assets}
        onSaved={handleSaved}
        onUploadAsset={onUploadAsset}
        onDeleteAsset={onDeleteAsset}
        assetUploading={assetUploading}
        lang={lang}
      />

      <section className="rounded-2xl border border-astro-border bg-astro-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-lg text-astro-text">
            {T(lang, 'Журнал доставки', 'Delivery log')}
          </h3>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="text-xs text-astro-highlight"
          >
            {T(lang, 'Обновить', 'Refresh')}
          </button>
        </div>
        {deliveryLog.length === 0 ? (
          <p className="text-sm text-astro-subtext">{T(lang, 'Пока пусто', 'Empty')}</p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto text-xs">
            {deliveryLog.map((row) => (
              <div key={row.id} className="rounded-lg border border-astro-border/50 bg-astro-bg/20 p-2">
                <p className="font-medium text-astro-text">
                  {row.templateName || `#${row.templateId ?? '—'}`} · {row.status}
                </p>
                <p className="text-astro-subtext">
                  {row.successCount}/{row.recipientCount} {T(lang, 'успех', 'ok')}
                  {row.failureCount ? ` · ${row.failureCount} ${T(lang, 'ошибок', 'fail')}` : ''}
                </p>
                {row.errorSummary ? <p className="text-red-300/90">{row.errorSummary}</p> : null}
                <p className="text-[10px] text-astro-subtext/80">
                  {row.sentAt || row.createdAt}
                </p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[10px] text-astro-subtext">
          {T(
            lang,
            'Cron: POST /api/cron/notifications-daily с заголовком Authorization: Bearer CRON_SECRET',
            'Cron: POST /api/cron/notifications-daily with Authorization: Bearer CRON_SECRET'
          )}
        </p>
      </section>
    </div>
  );
};
