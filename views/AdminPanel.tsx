
import React, { useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { saveProfile, getAllUsers } from '../services/storageService';

interface AdminPanelProps {
    profile: UserProfile;
    onUpdate: (profile: UserProfile) => void;
    onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ profile, onUpdate, onClose }) => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await getAllUsers();
                setUsers(data);
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
    const activeToday = Math.floor(totalUsers * 0.7); // Mock logic

    const handleTogglePremium = (targetUser: UserProfile) => {
        const updatedList = users.map(u => {
            if (u.id === targetUser.id) {
                return { ...u, isPremium: !u.isPremium };
            }
            return u;
        });
        setUsers(updatedList);

        // If acting on self, update global app state
        if (targetUser.id === profile.id) {
            const updatedProfile = { ...profile, isPremium: !profile.isPremium };
            onUpdate(updatedProfile);
            saveProfile(updatedProfile);
        }
    };

    const handleToggleAdmin = (targetUser: UserProfile) => {
         const updatedList = users.map(u => {
            if (u.id === targetUser.id) {
                return { ...u, isAdmin: !u.isAdmin };
            }
            return u;
        });
        setUsers(updatedList);
        
        // If acting on self
        if (targetUser.id === profile.id) {
            const updatedProfile = { ...profile, isAdmin: !profile.isAdmin };
            onUpdate(updatedProfile);
            saveProfile(updatedProfile);
        }
    };

    const filteredUsers = users.filter(u => 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (u.id && u.id.toString().includes(searchTerm))
    );

    return (
        <div className="fixed inset-0 z-[60] bg-astro-bg overflow-y-auto">
            {/* Header */}
            <div className="bg-astro-card border-b border-astro-border p-6 sticky top-0 z-10 shadow-md flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold font-serif text-astro-text flex items-center gap-2">
                        <span className="text-red-500">🛡</span>
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

            <div className="p-6 max-w-5xl mx-auto space-y-8">
                {/* Dashboard Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-astro-card p-5 rounded-xl border border-astro-border shadow-sm">
                        <p className="text-[10px] text-astro-subtext uppercase tracking-widest mb-1">Total Users</p>
                        <p className="text-3xl font-serif text-astro-text">{totalUsers}</p>
                    </div>
                     <div className="bg-astro-card p-5 rounded-xl border border-astro-border shadow-sm">
                        <p className="text-[10px] text-astro-subtext uppercase tracking-widest mb-1">Premium Active</p>
                        <p className="text-3xl font-serif text-yellow-500">{premiumUsers}</p>
                    </div>
                     <div className="bg-astro-card p-5 rounded-xl border border-astro-border shadow-sm">
                        <p className="text-[10px] text-astro-subtext uppercase tracking-widest mb-1">Online Now</p>
                        <p className="text-3xl font-serif text-green-500 animate-pulse">{Math.floor(Math.random() * 20) + 5}</p>
                    </div>
                     <div className="bg-astro-card p-5 rounded-xl border border-astro-border shadow-sm">
                        <p className="text-[10px] text-astro-subtext uppercase tracking-widest mb-1">Active 24h</p>
                        <p className="text-3xl font-serif text-astro-text">{activeToday}</p>
                    </div>
                </div>

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
            </div>
        </div>
    );
};
