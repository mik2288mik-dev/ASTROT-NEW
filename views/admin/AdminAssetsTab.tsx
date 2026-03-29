import React, { useEffect, useRef, useState } from 'react';
import type { AdminScheduledNotificationAsset, UserProfile } from '../../types';
import { deleteNotificationAsset, fetchNotificationAssets, uploadNotificationAsset } from '../../services/adminService';
import { AdminBadge, AdminButton, AdminEmptyState, AdminSectionHeader, AdminStateBanner, AdminSurface } from './AdminPrimitives';
import { getAdminText } from './adminText';

type Props = {
  profile: UserProfile;
};

export const AdminAssetsTab: React.FC<Props> = ({ profile }) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const inputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<AdminScheduledNotificationAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchNotificationAssets();
      setAssets(rows);
    } catch (loadError: any) {
      setError(loadError?.message || getAdminText(lang, 'select_asset_failed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAssets();
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setMessage(null);
    setError(null);
    try {
      const asset = await uploadNotificationAsset(file);
      setAssets((prev) => [asset, ...prev]);
      setMessage(getAdminText(lang, 'image_uploaded'));
    } catch (uploadError: any) {
      setError(uploadError?.message || getAdminText(lang, 'notification_send_failed'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (assetId: number) => {
    try {
      await deleteNotificationAsset(assetId);
      setAssets((prev) => prev.filter((item) => item.id !== assetId));
    } catch (deleteError: any) {
      setError(deleteError?.message || getAdminText(lang, 'notifications_failed'));
    }
  };

  return (
    <div className="space-y-5">
      {message ? <AdminStateBanner tone="success">{message}</AdminStateBanner> : null}
      {error ? <AdminStateBanner tone="error">{error}</AdminStateBanner> : null}

      <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
        <AdminSectionHeader
          eyebrow="Assets"
          title={getAdminText(lang, 'assets_title')}
          subtitle={getAdminText(lang, 'assets_subtitle')}
          action={(
            <div className="flex gap-2">
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
              <AdminButton tone="primary" disabled={uploading} onClick={() => inputRef.current?.click()}>
                {uploading ? getAdminText(lang, 'sending') : getAdminText(lang, 'upload_image')}
              </AdminButton>
              <AdminButton tone="secondary" onClick={() => void loadAssets()}>
                {getAdminText(lang, 'refresh')}
              </AdminButton>
            </div>
          )}
        />
      </AdminSurface>

      <AdminSurface className="px-5 py-5 sm:px-6 sm:py-6">
        {loading ? (
          <p className="text-sm text-slate-400">{getAdminText(lang, 'refresh')}…</p>
        ) : assets.length === 0 ? (
          <AdminEmptyState title={getAdminText(lang, 'assets_empty')} body={getAdminText(lang, 'assets_subtitle')} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {assets.map((asset) => (
              <div key={asset.id} className="admin-surface-muted overflow-hidden">
                <div className="aspect-[4/3] overflow-hidden bg-[#05101c]">
                  <img src={asset.publicUrl} alt={asset.fileName} className="h-full w-full object-cover" />
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{asset.fileName}</p>
                      <p className="mt-1 text-xs text-slate-500">{asset.mimeType}</p>
                    </div>
                    <AdminBadge tone="neutral">#{asset.id}</AdminBadge>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                    <span>{(asset.fileSize / 1024).toFixed(1)} KB</span>
                    <span>{asset.refCount > 0 ? `${asset.refCount} refs` : 'unused'}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <AdminButton tone="secondary" onClick={() => window.open(asset.publicUrl, '_blank', 'noopener,noreferrer')}>
                      URL
                    </AdminButton>
                    {asset.refCount === 0 ? (
                      <AdminButton tone="danger" onClick={() => void handleDelete(asset.id)}>
                        {lang === 'ru' ? 'Удалить' : 'Delete'}
                      </AdminButton>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminSurface>
    </div>
  );
};
