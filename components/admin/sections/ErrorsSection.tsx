import React, { useState, useEffect, useCallback } from 'react';
import { admin2, AdminTechnicalErrorRow } from '../../../services/admin2Service';
import { StatusBadge } from '../common/StatusBadge';

export const ErrorsSection: React.FC = () => {
  const [errors, setErrors] = useState<AdminTechnicalErrorRow[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Detail / Resolution modal
  const [selectedError, setSelectedError] = useState<AdminTechnicalErrorRow | null>(null);
  const [editStatus, setEditStatus] = useState<string>('investigating');
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);

  const loadErrors = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await admin2.errors(statusFilter);
      setErrors(res.errors || []);
    } catch (e: any) {
      setErrorMsg(e.message || 'Ошибка загрузки реестра ошибок');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadErrors();
  }, [loadErrors]);

  const handleOpenDetail = (err: AdminTechnicalErrorRow) => {
    setSelectedError(err);
    setEditStatus(err.status);
    setAdminNote(err.adminNote || '');
  };

  const handleSaveStatus = async () => {
    if (!selectedError) return;
    setSaving(true);
    try {
      await admin2.patchError(selectedError.id, {
        status: editStatus,
        adminNote: adminNote.trim() || undefined,
      });
      setSelectedError(null);
      loadErrors();
    } catch (e: any) {
      alert(e.message || 'Ошибка обновления статуса ошибки');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Центр технических ошибок (Error Hub)</h2>
          <p className="text-sm text-gray-500 mt-1">
            Агрегация серверных сбоев, необработанных исключений и API 5xx по фингерпринтам
          </p>
        </div>

        <div className="flex items-center gap-2">
          {['all', 'new', 'investigating', 'resolved', 'ignored'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {st === 'all' ? 'Все' : st}
            </button>
          ))}
          <button
            onClick={() => loadErrors()}
            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors ml-2"
            title="Обновить"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-700 text-sm rounded-2xl border border-red-100">
          {errorMsg}
        </div>
      )}

      {/* Errors list */}
      <div className="space-y-3">
        {loading && errors.length === 0 ? (
          <div className="p-16 text-center text-gray-400 bg-white rounded-2xl">Загрузка ошибок...</div>
        ) : errors.length === 0 ? (
          <div className="p-16 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
            Ошибок в категории «{statusFilter}» не зафиксировано 👍
          </div>
        ) : (
          errors.map((err) => (
            <div
              key={err.id}
              className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:border-gray-200 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={err.status} />
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700">
                    HTTP {err.httpStatus || 500}
                  </span>
                  <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                    {err.endpoint}
                  </span>
                  <span className="text-[11px] font-mono text-gray-400">
                    FP: {err.fingerprint.slice(0, 12)}...
                  </span>
                </div>

                <div className="font-semibold text-gray-900 text-sm">
                  {err.message}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                  <span>Сбоев: <strong className="text-gray-900">{err.occurrencesCount}</strong></span>
                  <span>Затронуто: <strong className="text-gray-900">{err.affectedUsersCount}</strong> чел.</span>
                  <span>Впервые: {new Date(err.firstSeenAt).toLocaleString('ru-RU')}</span>
                  <span>Последний: {new Date(err.lastSeenAt).toLocaleString('ru-RU')}</span>
                  {err.appVersion && <span>Версия: {err.appVersion}</span>}
                </div>

                {err.adminNote && (
                  <div className="p-2 bg-amber-50 text-amber-900 rounded-xl text-xs">
                    <strong>Решение:</strong> {err.adminNote}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 self-end md:self-center">
                <button
                  onClick={() => handleOpenDetail(err)}
                  className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  Стек & Управление
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Detail / Status Editor */}
      {selectedError && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Ошибка #{selectedError.id}: {selectedError.errorCode}</h3>
                <p className="text-xs font-mono text-gray-500 mt-0.5">{selectedError.endpoint}</p>
              </div>
              <button onClick={() => setSelectedError(null)} className="text-gray-400 hover:text-gray-600 p-1">
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              <div className="bg-gray-50 p-3 rounded-xl space-y-1">
                <div className="text-gray-500">Сообщение:</div>
                <div className="font-semibold text-gray-900 text-sm">{selectedError.message}</div>
                {selectedError.sampleRequestId && (
                  <div className="text-gray-400 font-mono mt-1">Sample Request ID: {selectedError.sampleRequestId}</div>
                )}
              </div>

              {selectedError.stackTrace ? (
                <div>
                  <div className="font-semibold text-gray-700 mb-1">Стек-трейс:</div>
                  <pre className="p-3 bg-gray-950 text-gray-200 rounded-xl font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-60">
                    {selectedError.stackTrace}
                  </pre>
                </div>
              ) : (
                <div className="text-gray-400 italic">Стек-трейс не зафиксирован</div>
              )}

              <div className="pt-2 border-t border-gray-100 space-y-3">
                <h4 className="font-bold text-gray-900">Управление инцидентом</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-600 font-semibold mb-1">Статус расследования:</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white"
                    >
                      <option value="new">Новый (new)</option>
                      <option value="investigating">В процессе расследования (investigating)</option>
                      <option value="resolved">Исправлено (resolved)</option>
                      <option value="ignored">Игнорировать (ignored)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-600 font-semibold mb-1">Заметка инженера / решение:</label>
                    <input
                      type="text"
                      placeholder="Например: поправлен null check в PR #42"
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => setSelectedError(null)}
                className="px-4 py-2 text-xs text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 rounded-xl"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveStatus}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Сохранить статус'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
