
import React, { useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { saveProfile, getAllUsers } from '../services/storageService';
import { getRecentErrors } from '../lib/errorTracking';

interface AdminPanelProps {
    profile: UserProfile;
    onUpdate: (profile: UserProfile) => void;
    onClose: () => void;
}

type TabType = 'users' | 'stats' | 'errors' | 'settings';

export const AdminPanel: React.FC<AdminPanelProps> = ({ profile, onUpdate, onClose }) => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<TabType>('users');
    const [errors, setErrors] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await getAllUsers();
                setUsers(data);
                
                // Загружаем ошибки
                const recentErrors = getRecentErrors(20);
                setErrors(recentErrors);
            } catch (e) {
                console.error("Failed to fetch users", e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Stats Calculation
    const totalUsers = users.length;
    const premiumUsers = users.filter(u => u.isPremium).length;
    const freeUsers = totalUsers - premiumUsers;
    const conversionRate = totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 100) : 0;
    
    // Подсчет созданных карт
    const usersWithCharts = users.filter(u => u.generatedContent?.natalIntro).length;
    
    // Подсчет пользователей с Deep Dive
    const usersWithDeepDive = users.filter(u => 
        u.generatedContent?.deepDiveAnalyses && 
        Object.keys(u.generatedContent.deepDiveAnalyses).length > 0
    ).length;

    const handleTogglePremium = async (targetUser: UserProfile) => {
        const updatedUser = { ...targetUser, isPremium: !targetUser.isPremium };
        
        // Обновляем локальное состояние
        const updatedList = users.map(u => {
            if (u.id === targetUser.id) {
                return updatedUser;
            }
            return u;
        });
        setUsers(updatedList);

        // Сохраняем в БД
        try {
            console.log('[AdminPanel] Toggling premium for user:', targetUser.id, 'new status:', updatedUser.isPremium);
            await saveProfile(updatedUser);
            console.log('[AdminPanel] Premium status saved successfully');
            
            // If acting on self, update global app state
            if (targetUser.id === profile.id) {
                onUpdate(updatedUser);
            }
        } catch (error) {
            console.error('[AdminPanel] Failed to save premium status:', error);
            // Откатываем изменения в UI при ошибке
            setUsers(users);
        }
    };

    const handleToggleAdmin = async (targetUser: UserProfile) => {
        const updatedUser = { ...targetUser, isAdmin: !targetUser.isAdmin };
        
        // Обновляем локальное состояние
        const updatedList = users.map(u => {
            if (u.id === targetUser.id) {
                return updatedUser;
            }
            return u;
        });
        setUsers(updatedList);
        
        // Сохраняем в БД
        try {
            console.log('[AdminPanel] Toggling admin status for user:', targetUser.id, 'new status:', updatedUser.isAdmin);
            await saveProfile(updatedUser);
            console.log('[AdminPanel] Admin status saved successfully');
            
            // If acting on self, update global app state
            if (targetUser.id === profile.id) {
                onUpdate(updatedUser);
            }
        } catch (error) {
            console.error('[AdminPanel] Failed to save admin status:', error);
            // Откатываем изменения в UI при ошибке
            setUsers(users);
        }
    };

    const filteredUsers = users.filter(u => 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (u.id && u.id.toString().includes(searchTerm))
    );

    return (
        <div className="fixed inset-0 z-[60] bg-astro-bg overflow-y-auto">
            {/* Header */}
            <div className="bg-astro-card border-b border-astro-border p-6 sticky top-0 z-10 shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-bold font-serif text-astro-text flex items-center gap-2">
                            <span className="text-red-500">◈</span>
                            ADMIN CONSOLE
                        </h2>
                        <p className="text-[10px] text-astro-subtext uppercase tracking-widest">Owner Access Only</p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="bg-astro-bg text-astro-text px-5 py-2 rounded-lg border border-astro-border hover:bg-astro-highlight hover:text-white transition-colors text-xs uppercase font-bold tracking-widest"
                    >
                        Exit
                    </button>
                </div>
                
                {/* Tabs */}
                <div className="flex gap-2">
                    {(['users', 'stats', 'errors', 'settings'] as TabType[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-xs uppercase font-bold tracking-widest transition-colors ${
                                activeTab === tab
                                    ? 'bg-astro-highlight text-white'
                                    : 'bg-astro-bg text-astro-text hover:bg-astro-highlight/10'
                            }`}
                        >
                            {tab}
                            {tab === 'errors' && errors.length > 0 && (
                                <span className="ml-2 bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[8px]">
                                    {errors.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-6 max-w-6xl mx-auto space-y-8">
                {/* Quick Stats - всегда показываем */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-astro-card p-5 rounded-xl border border-astro-border shadow-sm">
                        <p className="text-[10px] text-astro-subtext uppercase tracking-widest mb-1">Total Users</p>
                        <p className="text-3xl font-serif text-astro-text">{totalUsers}</p>
                    </div>
                    <div className="bg-astro-card p-5 rounded-xl border border-astro-border shadow-sm">
                        <p className="text-[10px] text-astro-subtext uppercase tracking-widest mb-1">Premium</p>
                        <p className="text-3xl font-serif text-yellow-500">{premiumUsers}</p>
                        <p className="text-[10px] text-astro-subtext mt-1">{conversionRate}% conversion</p>
                    </div>
                    <div className="bg-astro-card p-5 rounded-xl border border-astro-border shadow-sm">
                        <p className="text-[10px] text-astro-subtext uppercase tracking-widest mb-1">Free Users</p>
                        <p className="text-3xl font-serif text-astro-text">{freeUsers}</p>
                    </div>
                    <div className="bg-astro-card p-5 rounded-xl border border-astro-border shadow-sm">
                        <p className="text-[10px] text-astro-subtext uppercase tracking-widest mb-1">With Charts</p>
                        <p className="text-3xl font-serif text-purple-500">{usersWithCharts}</p>
                    </div>
                    <div className="bg-astro-card p-5 rounded-xl border border-astro-border shadow-sm">
                        <p className="text-[10px] text-astro-subtext uppercase tracking-widest mb-1">Deep Dives</p>
                        <p className="text-3xl font-serif text-pink-500">{usersWithDeepDive}</p>
                    </div>
                </div>

                {/* Tab Content */}
                {activeTab === 'users' && (
                    <>
                        {/* User Management Table */}
                <div className="bg-astro-card rounded-xl border border-astro-border overflow-hidden shadow-lg">
                    <div className="p-5 border-b border-astro-border flex justify-between items-center">
                        <h3 className="text-lg font-serif text-astro-text">User Database</h3>
                        <input 
                            type="text" 
                            placeholder="Search by Name or ID..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-astro-bg border border-astro-border rounded-lg px-4 py-2 text-sm text-astro-text outline-none focus:border-astro-highlight w-64"
                        />
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-astro-subtext text-xs uppercase tracking-widest">Loading Database...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-astro-bg/50 text-astro-subtext text-[10px] uppercase tracking-widest">
                                        <th className="p-4 font-bold">User</th>
                                        <th className="p-4 font-bold">Telegram ID</th>
                                        <th className="p-4 font-bold">Location</th>
                                        <th className="p-4 font-bold text-center">Premium</th>
                                        <th className="p-4 font-bold text-center">Admin</th>
                                        <th className="p-4 font-bold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm text-astro-text">
                                    {filteredUsers.map((u, idx) => (
                                        <tr key={idx} className="border-b border-astro-border hover:bg-astro-highlight/5 transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold">{u.name}</div>
                                                <div className="text-xs text-astro-subtext">{u.birthDate}</div>
                                            </td>
                                            <td className="p-4 font-mono text-xs opacity-80">
                                                {u.id || "N/A"}
                                            </td>
                                            <td className="p-4">
                                                {u.birthPlace}
                                            </td>
                                            <td className="p-4 text-center">
                                                {u.isPremium ? (
                                                    <span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 rounded text-[10px] uppercase font-bold border border-yellow-500/20">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="text-astro-subtext text-xs">-</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                {u.isAdmin ? (
                                                    <span className="px-2 py-1 bg-red-500/10 text-red-500 rounded text-[10px] uppercase font-bold border border-red-500/20">
                                                        ADMIN
                                                    </span>
                                                ) : (
                                                    <span className="text-astro-subtext text-xs">-</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right space-x-2">
                                                <button 
                                                    onClick={() => handleTogglePremium(u)}
                                                    className={`px-3 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition-colors border ${
                                                        u.isPremium 
                                                        ? 'border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white' 
                                                        : 'border-yellow-500/50 text-yellow-500 hover:bg-yellow-500 hover:text-white'
                                                    }`}
                                                >
                                                    {u.isPremium ? "Revoke PRO" : "Grant PRO"}
                                                </button>
                                                <button 
                                                    onClick={() => handleToggleAdmin(u)}
                                                    className={`px-3 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition-colors border ${
                                                        u.isAdmin
                                                        ? 'border-astro-subtext text-astro-subtext hover:bg-astro-text hover:text-astro-bg' 
                                                        : 'border-astro-highlight text-astro-highlight hover:bg-astro-highlight hover:text-white'
                                                    }`}
                                                >
                                                    {u.isAdmin ? "Demote" : "Promote"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                    </>
                )}

                {/* Stats Tab */}
                {activeTab === 'stats' && (
                    <div className="space-y-6">
                        <div className="bg-astro-card rounded-xl border border-astro-border p-6">
                            <h3 className="text-lg font-serif text-astro-text mb-4">📊 Статистика приложения</h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-astro-subtext mb-2">Конверсия в Premium</p>
                                    <div className="bg-astro-bg rounded-lg p-4">
                                        <p className="text-2xl font-bold text-yellow-500">{conversionRate}%</p>
                                        <p className="text-xs text-astro-subtext mt-1">{premiumUsers} из {totalUsers}</p>
                                    </div>
                                </div>
                                
                                <div>
                                    <p className="text-sm text-astro-subtext mb-2">Активация карт</p>
                                    <div className="bg-astro-bg rounded-lg p-4">
                                        <p className="text-2xl font-bold text-purple-500">
                                            {totalUsers > 0 ? Math.round((usersWithCharts / totalUsers) * 100) : 0}%
                                        </p>
                                        <p className="text-xs text-astro-subtext mt-1">{usersWithCharts} карт создано</p>
                                    </div>
                                </div>
                                
                                <div>
                                    <p className="text-sm text-astro-subtext mb-2">Deep Dive использование</p>
                                    <div className="bg-astro-bg rounded-lg p-4">
                                        <p className="text-2xl font-bold text-pink-500">
                                            {premiumUsers > 0 ? Math.round((usersWithDeepDive / premiumUsers) * 100) : 0}%
                                        </p>
                                        <p className="text-xs text-astro-subtext mt-1">от премиум пользователей</p>
                                    </div>
                                </div>
                                
                                <div>
                                    <p className="text-sm text-astro-subtext mb-2">Средний баланс звезд</p>
                                    <div className="bg-astro-bg rounded-lg p-4">
                                        <p className="text-2xl font-bold text-blue-500">
                                            {Math.round(users.reduce((sum, u) => sum + (u.starsBalance || 0), 0) / Math.max(users.length, 1))}
                                        </p>
                                        <p className="text-xs text-astro-subtext mt-1">звезд на пользователя</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Top Users */}
                        <div className="bg-astro-card rounded-xl border border-astro-border p-6">
                            <h3 className="text-lg font-serif text-astro-text mb-4">👑 Top Пользователи</h3>
                            <div className="space-y-2">
                                {users
                                    .sort((a, b) => (b.starsBalance || 0) - (a.starsBalance || 0))
                                    .slice(0, 5)
                                    .map((user, idx) => (
                                        <div key={idx} className="bg-astro-bg rounded-lg p-3 flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '⭐'}</span>
                                                <div>
                                                    <p className="text-sm font-bold text-astro-text">{user.name}</p>
                                                    <p className="text-xs text-astro-subtext">{user.birthDate}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-yellow-500">{user.starsBalance || 0} ⭐</p>
                                                {user.isPremium && (
                                                    <span className="text-[8px] px-2 py-0.5 bg-yellow-500/10 text-yellow-500 rounded">PRO</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Errors Tab */}
                {activeTab === 'errors' && (
                    <div className="bg-astro-card rounded-xl border border-astro-border">
                        <div className="p-5 border-b border-astro-border">
                            <h3 className="text-lg font-serif text-astro-text">🐛 Последние ошибки</h3>
                            <p className="text-xs text-astro-subtext mt-1">Отслеживание ошибок приложения</p>
                        </div>
                        
                        <div className="divide-y divide-astro-border max-h-[600px] overflow-y-auto">
                            {errors.length === 0 ? (
                                <div className="p-12 text-center text-astro-subtext">
                                    <p className="text-2xl mb-2">✅</p>
                                    <p className="text-sm">Ошибок не обнаружено</p>
                                </div>
                            ) : (
                                errors.map((error, idx) => (
                                    <div key={idx} className="p-4 hover:bg-astro-bg/50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-red-500">{error.error}</p>
                                                <p className="text-xs text-astro-text mt-1">{error.message}</p>
                                            </div>
                                            <span className="text-[10px] text-astro-subtext">
                                                {new Date(error.timestamp).toLocaleString()}
                                            </span>
                                        </div>
                                        {error.userId && (
                                            <p className="text-[10px] text-astro-subtext">User ID: {error.userId}</p>
                                        )}
                                        {error.endpoint && (
                                            <p className="text-[10px] text-astro-subtext font-mono">{error.endpoint}</p>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Settings Tab */}
                {activeTab === 'settings' && (
                    <div className="bg-astro-card rounded-xl border border-astro-border p-6">
                        <h3 className="text-lg font-serif text-astro-text mb-4">⚙️ Настройки системы</h3>
                        
                        <div className="space-y-4">
                            <div className="bg-astro-bg rounded-lg p-4">
                                <p className="text-sm font-bold text-astro-text mb-2">Environment</p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <p className="text-astro-subtext">OpenAI API</p>
                                        <p className="text-green-500">✓ Configured</p>
                                    </div>
                                    <div>
                                        <p className="text-astro-subtext">Database</p>
                                        <p className="text-green-500">✓ Connected</p>
                                    </div>
                                    <div>
                                        <p className="text-astro-subtext">Rate Limiting</p>
                                        <p className="text-green-500">✓ Active</p>
                                    </div>
                                    <div>
                                        <p className="text-astro-subtext">Error Tracking</p>
                                        <p className="text-green-500">✓ Active</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-astro-bg rounded-lg p-4">
                                <p className="text-sm font-bold text-astro-text mb-2">Premium конфигурация</p>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-astro-subtext">Цена Premium</span>
                                        <span className="text-astro-text font-bold">399 ⭐</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-astro-subtext">Free лимит Deep Dive</span>
                                        <span className="text-astro-text font-bold">0 (Premium only)</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-astro-subtext">Free лимит регенераций</span>
                                        <span className="text-astro-text font-bold">3 в неделю</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
