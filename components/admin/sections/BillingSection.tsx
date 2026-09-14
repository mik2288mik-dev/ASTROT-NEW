import React, { useState, useEffect, useCallback } from 'react';
import {
  admin2,
  AdminRevenue,
  AdminPaymentRow,
  AdminSubscriptionRow,
  AdminPremiumPlan,
  AdminPromo,
} from '../../../services/admin2Service';
import { KpiCard } from '../common/KpiCard';
import { StatusBadge } from '../common/StatusBadge';

interface BillingSectionProps {
  onSelectUser?: (userId: string) => void;
}

export const BillingSection: React.FC<BillingSectionProps> = ({ onSelectUser }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'plans' | 'payments' | 'subscriptions' | 'promos'>('overview');

  // ===================== REVENUE =====================
  const [revenue, setRevenue] = useState<AdminRevenue | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);

  // ===================== PLANS =====================
  const [plans, setPlans] = useState<AdminPremiumPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansSaving, setPlansSaving] = useState(false);

  // ===================== PAYMENTS =====================
  const [payments, setPayments] = useState<AdminPaymentRow[]>([]);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // ===================== SUBSCRIPTIONS =====================
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionRow[]>([]);
  const [subsPage, setSubsPage] = useState(1);
  const [subsTotal, setSubsTotal] = useState(0);
  const [subsLoading, setSubsLoading] = useState(false);

  // ===================== PROMOS =====================
  const [promos, setPromos] = useState<AdminPromo[]>([]);
  const [promosLoading, setPromosLoading] = useState(false);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoType, setNewPromoType] = useState('premium_days');
  const [newPromoValue, setNewPromoValue] = useState(7);
  const [newPromoMaxUses, setNewPromoMaxUses] = useState(100);
  const [promoCreating, setPromoCreating] = useState(false);

  const loadRevenue = useCallback(async () => {
    setRevenueLoading(true);
    try {
      const res = await admin2.revenue();
      setRevenue(res);
    } catch (e) {
      // ignore
    } finally {
      setRevenueLoading(false);
    }
  }, []);

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const res = await admin2.premiumPlans();
      setPlans(res.plans || []);
    } catch (e) {
      // ignore
    } finally {
      setPlansLoading(false);
    }
  }, []);

  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const res = await admin2.payments(paymentsPage);
      setPayments(res.payments || []);
      setPaymentsTotal(res.pagination?.total || 0);
    } catch (e) {
      // ignore
    } finally {
      setPaymentsLoading(false);
    }
  }, [paymentsPage]);

  const loadSubscriptions = useCallback(async () => {
    setSubsLoading(true);
    try {
      const res = await admin2.subscriptions(subsPage);
      setSubscriptions(res.subscriptions || []);
      setSubsTotal(res.pagination?.total || 0);
    } catch (e) {
      // ignore
    } finally {
      setSubsLoading(false);
    }
  }, [subsPage]);

  const loadPromos = useCallback(async () => {
    setPromosLoading(true);
    try {
      const res = await admin2.listPromos();
      setPromos(res.promos || []);
    } catch (e) {
      // ignore
    } finally {
      setPromosLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') loadRevenue();
    if (activeTab === 'plans') loadPlans();
    if (activeTab === 'payments') loadPayments();
    if (activeTab === 'subscriptions') loadSubscriptions();
    if (activeTab === 'promos') loadPromos();
  }, [activeTab, loadRevenue, loadPlans, loadPayments, loadSubscriptions, loadPromos]);

  // Refund handler
  const handleRefund = async (paymentId: number) => {
    if (!confirm(`Вы действительно хотите оформить возврат по платежу #${paymentId}?`)) return;
    try {
      await admin2.refund(paymentId);
      alert('Возврат успешно оформлен');
      loadPayments();
    } catch (e: any) {
      alert(e.message || 'Ошибка оформления возврата');
    }
  };

  // Save plans handler
  const handleSavePlans = async () => {
    setPlansSaving(true);
    try {
      await admin2.savePremiumPlans(plans);
      alert('Тарифные планы успешно обновлены');
      loadPlans();
    } catch (e: any) {
      alert(e.message || 'Ошибка сохранения тарифов');
    } finally {
      setPlansSaving(false);
    }
  };

  // Create promo handler
  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoCode.trim()) return;
    setPromoCreating(true);
    try {
      await admin2.createPromo({
        code: newPromoCode.trim().toUpperCase(),
        type: newPromoType,
        value: Number(newPromoValue),
        maxUses: Number(newPromoMaxUses),
      });
      setNewPromoCode('');
      loadPromos();
    } catch (e: any) {
      alert(e.message || 'Ошибка создания промокода');
    } finally {
      setPromoCreating(false);
    }
  };

  // Disable promo
  const handleDisablePromo = async (code: string) => {
    if (!confirm(`Отключить промокод ${code}?`)) return;
    try {
      await admin2.disablePromo(code);
      loadPromos();
    } catch (e: any) {
      alert(e.message || 'Ошибка отключения промокода');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Монетизация & Биллинг</h2>
          <p className="text-sm text-gray-500 mt-1">
            Выручка Stars и RuStore, управление тарифами, реестр транзакций, возвраты и промокоды
          </p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'overview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Выручка
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'plans' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Тарифы
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'payments' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Платежи
          </button>
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'subscriptions' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Подписки
          </button>
          <button
            onClick={() => setActiveTab('promos')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'promos' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Промокоды
          </button>
        </div>
      </div>

      {/* ===================== OVERVIEW ===================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Всего звёзд (Stars)"
              value={revenue ? `⭐ ${revenue.totalStars.toLocaleString('ru-RU')}` : '—'}
              subtext={`За 30 дней: ⭐ ${revenue?.stars30d?.toLocaleString('ru-RU') || 0}`}
            />
            <KpiCard
              title="Всего платежей"
              value={revenue ? revenue.totalPayments.toLocaleString('ru-RU') : '—'}
              subtext={`За 30 дней: ${revenue?.payments30d || 0}`}
            />
            <KpiCard
              title="Активные Premium"
              value={revenue ? revenue.activePremium.toLocaleString('ru-RU') : '—'}
              subtext={`Пробных периодов: ${revenue?.trials || 0}`}
            />
            <KpiCard
              title="Возвраты (Refunds)"
              value={revenue ? `${revenue.refunds} шт.` : '—'}
              subtext={revenue ? `Возвращено ⭐ ${revenue.refundedStars}` : '—'}
            />
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 text-base">Интеграции эквайринга</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">Telegram Stars</span>
                  <StatusBadge status="active" />
                </div>
                <p className="text-xs text-gray-500">
                  Оплата внутренней валютой Telegram Stars в боте и Mini App. Мгновенная выдача прав.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">RuStore In-App Pay</span>
                  <StatusBadge status="active" />
                </div>
                <p className="text-xs text-gray-500">
                  Эквайринг банковскими картами РФ через SDK RuStore для нативных Android-сборок.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== PLANS ===================== */}
      {activeTab === 'plans' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Тарифные планы Premium</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Настройка цен в Telegram Stars, рублях и USD, бейджей и периода действия
              </p>
            </div>
            <button
              onClick={handleSavePlans}
              disabled={plansSaving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {plansSaving ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>

          {plansLoading ? (
            <div className="py-12 text-center text-gray-400">Загрузка тарифов...</div>
          ) : (
            <div className="space-y-4">
              {plans.map((plan, idx) => (
                <div
                  key={plan.id}
                  className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 grid grid-cols-1 md:grid-cols-6 gap-3 items-center text-xs"
                >
                  <div className="space-y-1">
                    <span className="font-semibold text-gray-900">{plan.id}</span>
                    <input
                      type="text"
                      value={plan.label}
                      onChange={(e) => {
                        const copy = [...plans];
                        copy[idx].label = e.target.value;
                        setPlans(copy);
                      }}
                      className="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs"
                      placeholder="Название"
                    />
                  </div>

                  <div>
                    <label className="text-gray-500 block mb-1">Период (дней)</label>
                    <input
                      type="number"
                      value={plan.days}
                      onChange={(e) => {
                        const copy = [...plans];
                        copy[idx].days = parseInt(e.target.value, 10) || 0;
                        setPlans(copy);
                      }}
                      className="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-gray-500 block mb-1">Stars (⭐)</label>
                    <input
                      type="number"
                      value={plan.stars}
                      onChange={(e) => {
                        const copy = [...plans];
                        copy[idx].stars = parseInt(e.target.value, 10) || 0;
                        setPlans(copy);
                      }}
                      className="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs font-semibold text-amber-700"
                    />
                  </div>

                  <div>
                    <label className="text-gray-500 block mb-1">Цена (RUB)</label>
                    <input
                      type="number"
                      value={plan.priceRub}
                      onChange={(e) => {
                        const copy = [...plans];
                        copy[idx].priceRub = parseInt(e.target.value, 10) || 0;
                        setPlans(copy);
                      }}
                      className="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-gray-500 block mb-1">Бейдж (скидка)</label>
                    <input
                      type="text"
                      value={plan.badge || ''}
                      onChange={(e) => {
                        const copy = [...plans];
                        copy[idx].badge = e.target.value || null;
                        setPlans(copy);
                      }}
                      className="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs"
                      placeholder="-30% Хит"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 md:pt-0">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={plan.isActive}
                        onChange={(e) => {
                          const copy = [...plans];
                          copy[idx].isActive = e.target.checked;
                          setPlans(copy);
                        }}
                        className="rounded text-indigo-600"
                      />
                      <span className="text-xs font-medium text-gray-700">Активен</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================== PAYMENTS ===================== */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm">История финансовых операций</h3>
            <span className="text-xs text-gray-500">Всего: {paymentsTotal} транзакций</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-100 font-semibold text-gray-500 uppercase">
                  <th className="py-3 px-4">ID / Дата</th>
                  <th className="py-3 px-4">Пользователь</th>
                  <th className="py-3 px-4">Сумма</th>
                  <th className="py-3 px-4">Провайдер</th>
                  <th className="py-3 px-4">Статус</th>
                  <th className="py-3 px-4">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paymentsLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">Загрузка платежей...</td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">Платежей не найдено</td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/40">
                      <td className="py-3 px-4">
                        <span className="font-semibold text-gray-900">#{p.id}</span>
                        <div className="text-gray-400 text-[11px]">{p.createdAt ? new Date(p.createdAt).toLocaleString('ru-RU') : '—'}</div>
                      </td>

                      <td className="py-3 px-4">
                        <button
                          onClick={() => onSelectUser && onSelectUser(p.userId)}
                          className="font-mono text-indigo-600 hover:underline"
                        >
                          {p.userId}
                        </button>
                        {p.ownerName && <div className="text-gray-500">{p.ownerName}</div>}
                      </td>

                      <td className="py-3 px-4 font-bold text-gray-900">
                        {p.currency === 'XTR' ? `⭐ ${p.amount}` : `${p.amount} ${p.currency}`}
                      </td>

                      <td className="py-3 px-4 text-gray-600 font-mono">
                        {p.provider} ({p.platform})
                      </td>

                      <td className="py-3 px-4">
                        <StatusBadge status={p.status} />
                      </td>

                      <td className="py-3 px-4">
                        {p.status === 'completed' && !p.refundedAt && (
                          <button
                            onClick={() => handleRefund(p.id)}
                            className="text-rose-600 hover:underline font-semibold text-xs"
                          >
                            Возврат
                          </button>
                        )}
                        {p.refundedAt && (
                          <span className="text-gray-400 text-[11px]">Возвращен</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <div>Страница {paymentsPage}</div>
            <div className="flex gap-2">
              <button
                onClick={() => setPaymentsPage((p) => Math.max(1, p - 1))}
                disabled={paymentsPage <= 1}
                className="px-3 py-1 bg-white border border-gray-200 rounded-lg disabled:opacity-40"
              >
                Назад
              </button>
              <button
                onClick={() => setPaymentsPage((p) => p + 1)}
                disabled={payments.length < 50}
                className="px-3 py-1 bg-white border border-gray-200 rounded-lg disabled:opacity-40"
              >
                Вперед
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== SUBSCRIPTIONS ===================== */}
      {activeTab === 'subscriptions' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm">Активные подписки</h3>
            <span className="text-xs text-gray-500">Всего: {subsTotal} пользователей</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-100 font-semibold text-gray-500 uppercase">
                  <th className="py-3 px-4">Пользователь</th>
                  <th className="py-3 px-4">Тариф</th>
                  <th className="py-3 px-4">Провайдер</th>
                  <th className="py-3 px-4">Срок действия</th>
                  <th className="py-3 px-4">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subsLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400">Загрузка подписок...</td>
                  </tr>
                ) : subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400">Активных подписок не найдено</td>
                  </tr>
                ) : (
                  subscriptions.map((s) => (
                    <tr key={s.userId} className="hover:bg-gray-50/40">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onSelectUser && onSelectUser(s.userId)}
                          className="font-mono text-indigo-600 hover:underline font-semibold"
                        >
                          {s.userId}
                        </button>
                        {s.name && <div className="text-gray-500">{s.name}</div>}
                      </td>

                      <td className="py-3 px-4 font-semibold text-gray-800">
                        {s.plan}
                      </td>

                      <td className="py-3 px-4 text-gray-600 font-mono">
                        {s.provider} ({s.platform})
                      </td>

                      <td className="py-3 px-4 text-gray-900 font-medium">
                        {s.premiumUntil ? new Date(s.premiumUntil).toLocaleDateString('ru-RU') : '—'}
                      </td>

                      <td className="py-3 px-4">
                        <StatusBadge status={s.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== PROMOS ===================== */}
      {activeTab === 'promos' && (
        <div className="space-y-6">
          {/* Create Promo Form */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 text-sm">Создать новый промокод</h3>
            <form onSubmit={handleCreatePromo} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Код</label>
                <input
                  type="text"
                  placeholder="NEBO2026"
                  value={newPromoCode}
                  onChange={(e) => setNewPromoCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl uppercase font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Тип вознаграждения</label>
                <select
                  value={newPromoType}
                  onChange={(e) => setNewPromoType(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white"
                >
                  <option value="premium_days">Дни Premium (premium_days)</option>
                  <option value="discount_pct">Скидка в % (discount_pct)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Значение (дней / %)</label>
                <input
                  type="number"
                  value={newPromoValue}
                  onChange={(e) => setNewPromoValue(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Лимит активаций</label>
                <input
                  type="number"
                  value={newPromoMaxUses}
                  onChange={(e) => setNewPromoMaxUses(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={promoCreating}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {promoCreating ? 'Создание...' : 'Создать код'}
                </button>
              </div>
            </form>
          </div>

          {/* Promos Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-100 font-semibold text-gray-500 uppercase">
                    <th className="py-3 px-4">Промокод</th>
                    <th className="py-3 px-4">Тип / Значение</th>
                    <th className="py-3 px-4">Использований</th>
                    <th className="py-3 px-4">Статус</th>
                    <th className="py-3 px-4">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {promosLoading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-400">Загрузка промокодов...</td>
                    </tr>
                  ) : promos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-400">Промокоды не найдены</td>
                    </tr>
                  ) : (
                    promos.map((p) => (
                      <tr key={p.code} className="hover:bg-gray-50/40">
                        <td className="py-3 px-4 font-mono font-bold text-indigo-600 text-sm">
                          {p.code}
                        </td>

                        <td className="py-3 px-4 text-gray-800">
                          {p.type === 'premium_days' ? `+${p.value} дней Premium` : `${p.value}% скидка`}
                        </td>

                        <td className="py-3 px-4 font-semibold text-gray-900">
                          {p.usedCount} / {p.maxUses}
                        </td>

                        <td className="py-3 px-4">
                          <StatusBadge status={p.status} />
                        </td>

                        <td className="py-3 px-4">
                          {p.status === 'active' && (
                            <button
                              onClick={() => handleDisablePromo(p.code)}
                              className="text-rose-600 hover:underline font-medium"
                            >
                              Деактивировать
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
