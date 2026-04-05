import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AdminNotificationDeliveryLogItem,
  AdminScheduledNotificationAsset,
  AdminScheduledNotificationTemplate,
  NotificationSlot,
  UserProfile,
} from '../../../types';
import {
  createScheduledNotificationTemplate,
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
} from '../../../services/adminService';
import { AdminBadge, AdminButton, AdminSectionHeader, AdminStateBanner, AdminSurface } from '../../../views/admin/AdminPrimitives';
import { NotificationMediaLibrary } from './NotificationMediaLibrary';
import { NotificationTemplateForm } from './NotificationTemplateForm';
import { NotificationTemplateList } from './NotificationTemplateList';

interface NotificationsManagerProps {
  profile: UserProfile;
}

type CmsTab = 'templates' | 'media';

export const NotificationsManager: React.FC<NotificationsManagerProps> = () => {
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

  const handleSaved = useCallback(async (result?: { id?: number }) => {
    await loadAll();
    const idToOpen = result?.id ?? selected?.id;
    if (idToOpen != null) {
      try {
        setSelected(await fetchScheduledNotificationTemplate(idToOpen));
      } catch {
        /* ignore */
      }
    }
  }, [loadAll, selected?.id]);

  const openTemplate = async (template: AdminScheduledNotificationTemplate | null) => {
    if (!template) {
      setSelected(null);
      return;
    }
    try {
      const full = await fetchScheduledNotificationTemplate(template.id);
      setSelected(full);
    } catch {
      setSelected(template);
    }
  };

  const handleDuplicate = async (template: AdminScheduledNotificationTemplate) => {
    try {
      await createScheduledNotificationTemplate({
        name: `${template.name} (copy)`,
        slot: template.slot,
        visualMode: template.visualMode || 'none',
        messageType: template.messageType,
        text: template.text,
        buttonText: template.buttonText,
        deepLink: template.deepLink,
        assetId: template.assetId,
        generatedPreset: template.generatedPreset,
        generatedTitle: template.generatedTitle,
        generatedSubtitle: template.generatedSubtitle,
        generatedAccent: template.generatedAccent,
        generatedShowDate: template.generatedShowDate,
        generatedShowSlotLabel: template.generatedShowSlotLabel,
        generatedZodiacMode: template.generatedZodiacMode,
        generatedCustomZodiac: template.generatedCustomZodiac,
        isActive: false,
        notes: template.notes,
        schedules: (template.schedules || []).map((schedule) => ({
          sendTime: schedule.sendTime,
          timezone: schedule.timezone,
          repeatMode: schedule.repeatMode,
          isActive: schedule.isActive,
        })),
      });
      setToast('Template duplicate created');
      await loadAll();
    } catch (error: any) {
      setToast(error?.message || 'Error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete template?')) return;
    try {
      await deleteScheduledNotificationTemplate(id);
      if (selected?.id === id) setSelected(null);
      await loadAll();
    } catch (error: any) {
      setToast(error?.message || 'Error');
    }
  };

  const handleToggle = async (id: number, isActive: boolean) => {
    try {
      await patchScheduledNotificationTemplateActive(id, isActive);
      await loadAll();
      if (selected?.id === id) {
        setSelected((prev) => (prev ? { ...prev, isActive } : null));
      }
    } catch (error: any) {
      setToast(error?.message || 'Error');
    }
  };

  const handleTest = async (id: number) => {
    try {
      const result = await sendScheduledNotificationTest(id);
      setToast(`Test: ${result.successCount} success, ${result.failureCount} failed`);
      await loadAll();
    } catch (error: any) {
      setToast(error?.message || 'Error');
    }
  };

  const handleRunSlot = async (slot: NotificationSlot) => {
    try {
      const result = await runNotificationSlot(slot, null);
      setToast(`Slot run: template #${result.templateId ?? '—'}, ${result.successCount}/${result.totalRecipients}`);
      await loadAll();
    } catch (error: any) {
      setToast(error?.message || 'Error');
    }
  };

  const onUploadAsset = async (file: File) => {
    setAssetUploading(true);
    try {
      const asset = await uploadNotificationAsset(file);
      setAssets((prev) => [asset, ...prev]);
      setSelected((prev) =>
        prev && (prev.visualMode === 'uploaded' || prev.messageType === 'photo') ? { ...prev, assetId: asset.id } : prev
      );
      setToast('Asset uploaded');
    } catch (error: any) {
      setToast(error?.message || 'Upload failed');
    } finally {
      setAssetUploading(false);
    }
  };

  const onDeleteAsset = async (id: number) => {
    try {
      await deleteNotificationAsset(id);
      setAssets((prev) => prev.filter((asset) => asset.id !== id));
      if (selected?.assetId === id) {
        setSelected((prev) => (prev ? { ...prev, assetId: null } : null));
      }
    } catch (error: any) {
      setToast(error?.message || 'Cannot delete asset');
    }
  };

  useEffect(() => {
    if (!toast) return;
    const timeoutId = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timeoutId);
  }, [toast]);

  const visualLabelRu = useMemo(() => ({
    none: 'text',
    uploaded: 'photo',
    generated: 'card',
  }) as const, []);

  return (
    <div className="space-y-5">
      {toast ? <AdminStateBanner tone="info">{toast}</AdminStateBanner> : null}

      <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
        <AdminSectionHeader
          eyebrow="Automation"
          title="Advanced notification automation"
          subtitle="Scheduled templates, slot execution, media assets, and delivery diagnostics."
          action={(
            <AdminButton tone="secondary" onClick={() => void loadAll()}>
              Refresh
            </AdminButton>
          )}
        />

        <div className="mt-6 flex flex-wrap gap-2">
          <AdminButton tone={cmsTab === 'templates' ? 'primary' : 'secondary'} onClick={() => setCmsTab('templates')}>
            Templates & slots
          </AdminButton>
          <AdminButton tone={cmsTab === 'media' ? 'primary' : 'secondary'} onClick={() => setCmsTab('media')}>
            Media library
          </AdminButton>
          <AdminBadge tone="neutral">{assets.length} assets</AdminBadge>
          <AdminBadge tone="neutral">{templates.length} templates</AdminBadge>
        </div>
      </AdminSurface>

      {cmsTab === 'media' ? (
        <AdminSurface className="px-4 py-4 sm:px-5 sm:py-5">
          <div className="admin-cms-surface">
            <NotificationMediaLibrary
              assets={assets}
              uploading={assetUploading}
              onUpload={onUploadAsset}
              onDelete={onDeleteAsset}
              onRefresh={() => void loadAll()}
            />
          </div>
        </AdminSurface>
      ) : null}

      {cmsTab === 'templates' ? (
        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <AdminSurface className="px-4 py-4 sm:px-5 sm:py-5">
            <div className="admin-cms-surface">
              <NotificationTemplateList
                templates={templates}
                selectedId={selected?.id ?? null}
                onSelect={(template) => void openTemplate(template)}
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
          </AdminSurface>

          <div className="admin-cms-surface">
            <NotificationTemplateForm
              template={selected}
              assets={assets}
              onSaved={handleSaved}
              onUploadAsset={onUploadAsset}
              onDeleteAsset={onDeleteAsset}
              assetUploading={assetUploading}
            />
          </div>
        </div>
      ) : null}

      <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="admin-label">Delivery log</p>
            <h3 className="admin-heading mt-2 text-2xl text-white">Recent runs</h3>
          </div>
          <AdminButton tone="secondary" onClick={() => void loadAll()}>
            Refresh
          </AdminButton>
        </div>

        {deliveryLog.length === 0 ? (
          <p className="mt-5 text-sm text-slate-400">Nothing has run yet.</p>
        ) : (
          <div className="mt-5 max-h-[420px] space-y-3 overflow-y-auto admin-scroll">
            {deliveryLog.map((row) => (
              <div key={row.id} className="admin-surface-muted p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{row.templateName || `#${row.templateId ?? '—'}`}</p>
                    <p className="mt-1 text-xs text-slate-400">{row.sentAt || row.createdAt}</p>
                  </div>
                  <AdminBadge tone={row.failureCount > 0 ? 'warning' : 'success'}>{row.status}</AdminBadge>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {row.successCount}/{row.recipientCount} success
                  {row.failureCount ? ` · ${row.failureCount} failed` : ''}
                  {row.generatedPreset ? ` · ${row.generatedPreset}` : ''}
                </p>
                {row.errorSummary ? <p className="mt-2 text-xs leading-5 text-red-300">{row.errorSummary}</p> : null}
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 text-xs leading-5 text-slate-500">
          Cron endpoint: POST /api/cron/notifications-daily with Authorization: Bearer CRON_SECRET
        </p>
      </AdminSurface>
    </div>
  );
};
