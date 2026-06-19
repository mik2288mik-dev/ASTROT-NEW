import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AdminPremiumFilter,
  AdminSortOrder,
  AdminUserSegment,
  AdminUserSortBy,
  AdminUsersOverview,
  AdminUserSummary,
  PaginationMeta,
} from '../../../types';
import { fetchAdminUsers } from '../../../services/adminService';

const EMPTY_OVERVIEW: AdminUsersOverview = {
  totalUsers: 0,
  activePremiumUsers: 0,
  activeUsers7d: 0,
  needAttentionUsers: 0,
  usersWithoutBirthData: 0,
};

const EMPTY_PAGINATION: PaginationMeta = {
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 1,
};

export function useAdminUsersList(input: {
  segment: AdminUserSegment;
  onOverviewChange: (overview: AdminUsersOverview) => void;
}) {
  const { segment, onOverviewChange } = input;
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [overview, setOverview] = useState<AdminUsersOverview>(EMPTY_OVERVIEW);
  const [pagination, setPagination] = useState<PaginationMeta>(EMPTY_PAGINATION);
  const [search, setSearch] = useState('');
  const [premiumFilter, setPremiumFilter] = useState<AdminPremiumFilter>('all');
  const [sortBy, setSortBy] = useState<AdminUserSortBy>('last_seen');
  const [sortOrder, setSortOrder] = useState<AdminSortOrder>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (segment === 'premium' || segment === 'free') {
      setPremiumFilter(segment);
      return;
    }
    if (segment === 'all') {
      setPremiumFilter('all');
    }
  }, [segment]);

  const query = useMemo(() => ({
    q: search.trim(),
    premium: premiumFilter,
    segment,
    page: pagination.page,
    pageSize: pagination.pageSize,
    sortBy,
    sortOrder,
  }), [segment, pagination.page, pagination.pageSize, premiumFilter, search, sortBy, sortOrder]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchAdminUsers(query);
      setUsers(payload.users);
      setOverview(payload.overview);
      setPagination(payload.pagination);
      onOverviewChange(payload.overview);
    } catch (loadError: any) {
      setUsers([]);
      setOverview(EMPTY_OVERVIEW);
      setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }));
      onOverviewChange(EMPTY_OVERVIEW);
      setError(loadError?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [onOverviewChange, query]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadUsers();
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [loadUsers]);

  const setPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    setPagination((prev) => ({ ...prev, pageSize, page: 1 }));
  }, []);

  return {
    users,
    overview,
    pagination,
    search,
    premiumFilter,
    sortBy,
    sortOrder,
    loading,
    error,
    setSearch,
    setPremiumFilter,
    setSortBy,
    setSortOrder,
    setPage,
    setPageSize,
    reload: loadUsers,
    setError,
  };
}
