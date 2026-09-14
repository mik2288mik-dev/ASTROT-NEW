import React, { useState, useEffect, useCallback } from 'react';
import {
  admin2,
  AdminForecastQuestion,
  AdminCmsRow,
  AdminCmsDetail,
  AdminMe,
} from '../../../services/admin2Service';
import HomeCardsEditor from '../../admin2/HomeCardsEditor';
import { StatusBadge } from '../common/StatusBadge';

interface ContentSectionProps {
  me: AdminMe;
  onSelectUser?: (userId: string) => void;
}

export const ContentSection: React.FC<ContentSectionProps> = ({ me, onSelectUser }) => {
  const [activeTab, setActiveTab] = useState<'questions' | 'home_cards' | 'cms'>('questions');

  // ===================== QUESTIONS =====================
  const [questions, setQuestions] = useState<AdminForecastQuestion[]>([]);
  const [qStatus, setQStatus] = useState<AdminForecastQuestion['status'] | 'all'>('pending');
  const [qPeriod, setQPeriod] = useState<AdminForecastQuestion['period'] | 'all'>('all');
  const [qSearch, setQSearch] = useState('');
  const [qLoading, setQLoading] = useState(false);
  const [rejectModalQuestion, setRejectModalQuestion] = useState<AdminForecastQuestion | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [moderating, setModerating] = useState(false);

  // ===================== CMS =====================
  const [cmsItems, setCmsItems] = useState<AdminCmsRow[]>([]);
  const [cmsLoading, setCmsLoading] = useState(false);
  const [selectedCms, setSelectedCms] = useState<AdminCmsDetail | null>(null);
  const [cmsBody, setCmsBody] = useState('');
  const [cmsTitle, setCmsTitle] = useState('');
  const [cmsSaving, setCmsSaving] = useState(false);

  const loadQuestions = useCallback(async () => {
    setQLoading(true);
    try {
      const res = await admin2.listForecastQuestions({
        status: qStatus,
        period: qPeriod,
        q: qSearch || undefined,
      });
      setQuestions(res.questions || []);
    } catch (e) {
      // ignore
    } finally {
      setQLoading(false);
    }
  }, [qStatus, qPeriod, qSearch]);

  const loadCms = useCallback(async () => {
    setCmsLoading(true);
    try {
      const res = await admin2.listCms();
      setCmsItems(res.items || []);
    } catch (e) {
      // ignore
    } finally {
      setCmsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'questions') loadQuestions();
    if (activeTab === 'cms') loadCms();
  }, [activeTab, loadQuestions, loadCms]);

  const handleModerate = async (id: number, action: 'approve' | 'reject' | 'retry', reason?: string) => {
    setModerating(true);
    try {
      await admin2.moderateForecastQuestion(id, action, reason);
      setRejectModalQuestion(null);
      setRejectReason('');
      loadQuestions();
    } catch (e: any) {
      alert(e.message || 'Ошибка модерации');
    } finally {
      setModerating(false);
    }
  };

  const handleSelectCms = async (id: number) => {
    try {
      const detail = await admin2.getCms(id);
      setSelectedCms(detail);
      setCmsBody(detail.body || '');
      setCmsTitle(detail.title || '');
    } catch (e: any) {
      alert(e.message || 'Ошибка загрузки статьи');
    }
  };

  const handleSaveCms = async () => {
    if (!selectedCms) return;
    setCmsSaving(true);
    try {
      await admin2.updateCms(selectedCms.id, cmsBody, cmsTitle, selectedCms.version);
      alert('CMS контент сохранен');
      loadCms();
      handleSelectCms(selectedCms.id);
    } catch (e: any) {
      alert(e.message || 'Ошибка сохранения');
    } finally {
      setCmsSaving(false);
    }
  };

  const handlePublishCms = async (id: number) => {
    if (!confirm('Опубликовать эту статью/материал?')) return;
    try {
      await admin2.publishCms(id);
      alert('Материал опубликован');
      loadCms();
      if (selectedCms?.id === id) handleSelectCms(id);
    } catch (e: any) {
      alert(e.message || 'Ошибка публикации');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Управление контентом & Модерация</h2>
          <p className="text-sm text-gray-500 mt-1">
            Вопросы к астрологу/прогнозу, витрина Home Cards и материалы CMS
          </p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab('questions')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'questions' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Вопросы к прогнозу
          </button>
          <button
            onClick={() => setActiveTab('home_cards')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'home_cards' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Home Cards
          </button>
          <button
            onClick={() => setActiveTab('cms')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'cms' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            CMS & Статьи
          </button>
        </div>
      </div>

      {/* ===================== QUESTIONS ===================== */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-gray-500">Статус:</span>
              {(['pending', 'approved', 'generating', 'answered', 'rejected', 'all'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setQStatus(st)}
                  className={`px-3 py-1 rounded-xl text-xs font-medium ${
                    qStatus === st ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {st === 'pending' ? 'Ожидают' : st === 'approved' ? 'Одобрены' : st === 'answered' ? 'Отвечены' : st === 'rejected' ? 'Отклонены' : st === 'generating' ? 'Генерация' : 'Все'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Поиск по вопросу..."
                value={qSearch}
                onChange={(e) => setQSearch(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-xl"
              />
              <button
                onClick={() => loadQuestions()}
                className="text-xs text-indigo-600 font-semibold hover:underline"
              >
                Обновить
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {qLoading && questions.length === 0 ? (
              <div className="p-12 text-center text-gray-400 bg-white rounded-2xl">Загрузка вопросов...</div>
            ) : questions.length === 0 ? (
              <div className="p-12 text-center text-gray-400 bg-white rounded-2xl">
                Вопросов в выбранном статусе нет
              </div>
            ) : (
              questions.map((q) => (
                <div
                  key={q.id}
                  className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={q.status} />
                      <span className="text-xs font-semibold text-gray-500">Период: {q.period}</span>
                      <span className="text-xs text-gray-400 font-mono">#{q.id}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(q.createdAt).toLocaleString('ru-RU')}
                    </div>
                  </div>

                  <div className="text-sm font-semibold text-gray-900 bg-gray-50 p-3 rounded-xl">
                    «{q.questionText}»
                  </div>

                  {q.answerText && (
                    <div className="text-xs text-gray-700 bg-indigo-50/40 border border-indigo-100 p-3 rounded-xl whitespace-pre-wrap">
                      <div className="font-semibold text-indigo-900 mb-1">Сгенерированный ответ:</div>
                      {q.answerText}
                    </div>
                  )}

                  {q.moderationReason && (
                    <div className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-xl">
                      <strong>Причина отклонения:</strong> {q.moderationReason}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                    <div>
                      Пользователь:{' '}
                      <button
                        onClick={() => onSelectUser && onSelectUser(q.userId)}
                        className="font-mono text-indigo-600 hover:underline font-semibold"
                      >
                        {q.userId}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {q.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleModerate(q.id, 'approve')}
                            disabled={moderating}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                          >
                            Одобрить & Генерировать
                          </button>
                          <button
                            onClick={() => { setRejectModalQuestion(q); setRejectReason(''); }}
                            disabled={moderating}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-semibold transition-colors disabled:opacity-50"
                          >
                            Отклонить
                          </button>
                        </>
                      )}
                      {(q.status === 'rejected' || q.status === 'answered') && (
                        <button
                          onClick={() => handleModerate(q.id, 'retry')}
                          disabled={moderating}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                        >
                          Перегенерировать
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModalQuestion && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm">Отклонить вопрос пользователя</h3>
            <p className="text-xs text-gray-500">
              Укажите причину (не относится к натальной карте, бытовой/кулинарный вопрос, нарушение правил):
            </p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Вопрос не относится к натальной карте..."
              className="w-full p-2.5 text-xs border border-gray-200 rounded-xl"
            />

            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setRejectModalQuestion(null)}
                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl"
              >
                Отмена
              </button>
              <button
                onClick={() => handleModerate(rejectModalQuestion.id, 'reject', rejectReason)}
                disabled={moderating}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl"
              >
                Подтвердить отказ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== HOME CARDS ===================== */}
      {activeTab === 'home_cards' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <HomeCardsEditor me={me} />
        </div>
      )}

      {/* ===================== CMS ===================== */}
      {activeTab === 'cms' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 className="font-bold text-gray-900 text-sm">Материалы и статьи</h3>
            {cmsLoading ? (
              <div className="py-8 text-center text-gray-400 text-xs">Загрузка статей...</div>
            ) : cmsItems.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">Статей не найдено</div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {cmsItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectCms(item.id)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                      selectedCms?.id === item.id
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="font-semibold text-gray-900">{item.title || item.type}</div>
                    <div className="flex items-center justify-between text-gray-400 mt-1">
                      <span>v{item.version || 1} • {item.locale || 'ru'}</span>
                      <StatusBadge status={item.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            {selectedCms ? (
              <>
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="space-y-1 flex-1 mr-4">
                    <input
                      type="text"
                      value={cmsTitle}
                      onChange={(e) => setCmsTitle(e.target.value)}
                      className="text-base font-bold text-gray-900 w-full border border-transparent hover:border-gray-300 focus:border-indigo-500 rounded px-1 py-0.5"
                      placeholder="Заголовок материала"
                    />
                    <div className="text-xs text-gray-400">
                      Тип: {selectedCms.type} • Версия {selectedCms.version} • Статус: {selectedCms.status}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {selectedCms.status !== 'published' && (
                      <button
                        onClick={() => handlePublishCms(selectedCms.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-medium"
                      >
                        Опубликовать
                      </button>
                    )}
                    <button
                      onClick={handleSaveCms}
                      disabled={cmsSaving}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-medium disabled:opacity-50"
                    >
                      {cmsSaving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Текст статьи (Markdown / HTML)</label>
                  <textarea
                    rows={16}
                    value={cmsBody}
                    onChange={(e) => setCmsBody(e.target.value)}
                    className="w-full p-3 font-mono text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                  />
                </div>
              </>
            ) : (
              <div className="py-24 text-center text-gray-400 text-sm">
                Выберите статью из списка для редактирования
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
