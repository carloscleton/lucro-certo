import { Award, TrendingUp, Users, AlertTriangle, ArrowRight } from 'lucide-react';
import { useLoyalty } from '../../hooks/useLoyalty';
import { useNavigate } from 'react-router-dom';

export function LoyaltyStatsWidget() {
    const { stats, loading } = useLoyalty();
    const navigate = useNavigate();

    if (loading) return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 animate-pulse h-[300px]">
            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/4 mb-4"></div>
            <div className="space-y-3 mt-8">
                <div className="h-20 bg-gray-100 dark:bg-slate-700/50 rounded-xl"></div>
                <div className="h-20 bg-gray-100 dark:bg-slate-700/50 rounded-xl"></div>
            </div>
        </div>
    );

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-amber-100 dark:border-amber-900/20 transition-colors relative overflow-hidden group">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                <Award size={120} />
            </div>

            <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        Clube VIP
                        <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Recorrência e Fidelização</p>
                </div>
                <button 
                    onClick={() => navigate('/dashboard/loyalty')}
                    className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                >
                    <ArrowRight size={18} />
                </button>
            </div>

            <div className="space-y-4 relative z-10">
                {/* MRR Card */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-100 dark:border-amber-900/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Receita Recorrente (MRR)</span>
                            <div className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
                                {formatCurrency(stats.mrr)}
                            </div>
                        </div>
                        <TrendingUp size={24} className="text-amber-500 opacity-50" />
                    </div>
                </div>

                {/* Grid Stats */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30">
                        <div className="flex items-center gap-2 mb-1">
                            <Users size={14} className="text-blue-500" />
                            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Assinantes</span>
                        </div>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                            {String(stats.activeSubscribers).padStart(2, '0')}
                        </p>
                    </div>

                    <div className="p-4 rounded-xl border border-red-500/10 bg-red-50/30 dark:bg-red-900/10">
                        <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle size={14} className="text-red-500" />
                            <span className="text-[10px] font-bold text-red-500 dark:text-red-400 uppercase">Atrasados</span>
                        </div>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                            {String(stats.overdueCount).padStart(2, '0')}
                        </p>
                    </div>
                </div>

                <p className="text-[10px] text-gray-400 dark:text-slate-500 text-center italic mt-2">
                    Dica: Envie convites para leads qualificados aumentarem sua recorrência.
                </p>
            </div>
        </div>
    );
}
