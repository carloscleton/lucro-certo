import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AffiliateDashboard } from '../components/affiliates/AffiliateDashboard';
import { AdminAffiliatesManager } from '../components/affiliates/AdminAffiliatesManager';
import { ShieldCheck } from 'lucide-react';

export function Referrals() {
    const { user } = useAuth();
    const isSystemAdmin = user?.email?.toLowerCase() === 'carloscleton.nat@gmail.com';
    const [viewMode, setViewMode] = useState<'user' | 'admin'>('user');

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
            
            {/* Admin Toggle Header (Se for o dono do sistema) */}
            {isSystemAdmin && (
                <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-900 dark:text-purple-300">
                        <ShieldCheck size={18} className="text-purple-600" />
                        <span>Modo Administrador Master Ativo</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setViewMode('user')}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                                viewMode === 'user'
                                    ? 'bg-purple-600 text-white shadow-sm'
                                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
                            }`}
                        >
                            Ver Como Cliente
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('admin')}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                                viewMode === 'admin'
                                    ? 'bg-purple-600 text-white shadow-sm'
                                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
                            }`}
                        >
                            Painel de Controle Admin
                        </button>
                    </div>
                </div>
            )}

            {viewMode === 'admin' && isSystemAdmin ? (
                <AdminAffiliatesManager />
            ) : (
                <AffiliateDashboard />
            )}
        </div>
    );
}
