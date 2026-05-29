import { useCallback, useEffect, useState } from 'react';
import type { AdminUserDetail, UserProfile } from '../../../types';
import { fetchAdminUserDetail, updateAdminPremium } from '../../../services/adminService';

type AdminOwnProfilePatch = Partial<Pick<UserProfile, 'isPremium' | 'chartSlots' | 'loginStreak'>>;

export function useAdminUserDetail(input: {
  currentUserId: string;
  onPatchOwnProfile: (patch: AdminOwnProfilePatch) => void;
}) {
  const { currentUserId, onPatchOwnProfile } = input;
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ tone: 'success' | 'info'; message: string } | null>(null);

  const patchOwnProfileFromDetail = useCallback((detail: AdminUserDetail) => {
    if (detail.id !== currentUserId) return;
    onPatchOwnProfile({
      isPremium: detail.isPremium,
      chartSlots: detail.chartSlots,
      loginStreak: detail.loginStreak,
    });
  }, [currentUserId, onPatchOwnProfile]);

  const loadSelectedUser = useCallback(async (userId: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const detail = await fetchAdminUserDetail(userId);
      setSelectedUser(detail);
    } catch (loadError: any) {
      setSelectedUser(null);
      setError(loadError?.message || 'Failed to load user');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!detailOpen || !selectedUserId) return;
    void loadSelectedUser(selectedUserId);
  }, [detailOpen, loadSelectedUser, selectedUserId]);

  const openUser = useCallback((userId: string) => {
    setSelectedUserId(userId);
    setSelectedUser(null);
    setDetailOpen(true);
    setError(null);
    setActionResult(null);
  }, []);

  const closeUser = useCallback(() => {
    setDetailOpen(false);
    setSelectedUser(null);
    setError(null);
    setActionResult(null);
  }, []);

  const runPremiumAction = useCallback(async (
    action: 'grant' | 'revoke',
    messages: { success: string; failure: string }
  ) => {
    if (!selectedUserId) return false;
    setActionLoading(`premium-${action}`);
    setError(null);
    try {
      const updated = await updateAdminPremium(selectedUserId, action);
      setSelectedUser(updated);
      patchOwnProfileFromDetail(updated);
      setActionResult({ tone: 'success', message: messages.success });
      return true;
    } catch (actionError: any) {
      setError(actionError?.message || messages.failure);
      return false;
    } finally {
      setActionLoading(null);
    }
  }, [patchOwnProfileFromDetail, selectedUserId]);

  return {
    selectedUserId,
    selectedUser,
    detailOpen,
    detailLoading,
    actionLoading,
    error,
    actionResult,
    setSelectedUser,
    setError,
    setActionResult,
    openUser,
    closeUser,
    loadSelectedUser,
    runPremiumAction,
  };
}
