import { Award, TrendingUp, Users, AlertTriangle, ArrowRight, Wallet, Clock, XCircle } from 'lucide-react';
import { useLoyalty } from '../../hooks/useLoyalty';
import { useNavigate } from 'react-router-dom';

export function LoyaltyStatsWidget() {
    const { stats, settings, loading } = useLoyalty();
    const navigate = useNavigate();

    if (loading) return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 animate-pulse h-[340px]">
            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/4 mb-4"></div>
            <div className="space-y-3 mt-8">
                <div className="h-24 bg-gray-100 dark:bg-slate-700/50 rounded-xl"></div>
                <div className="h-20 bg-gray-100 dark:bg-slate-700/50 rounded-xl"></div>
            </div>
        </div>
    );

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const platformFee = settings?.platform_fee_percent || 0;
    const netMrr = stats.mrr * (1 - (platformFee / 100));

    // Optional safe checks if properties are missing during hot reload
    const trialingCount = (stats as any).trialingCount || 0;
    const canceledCount = (stats as any).canceledCount || 0;

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-amber-100 dark:border-amber-900/20 transition-all hover:shadow-md relative overflow-hidden group">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                <Award size={140} />
            </div>

            <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        Clube VIP
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Recorrência e Fidelização</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-2.5 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full text-[10px] font-bold border border-amber-100 dark:border-amber-800">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                        Plataforma
                    </div>
                    <button 
                        onClick={() => navigate('/dashboard/loyalty')}
                        className="p-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg text-gray-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
                        title="Ir para o Clube VIP"
                    >
                        <ArrowRight size={18} />
                    </button>
                </div>
            </div>

            <div className="space-y-4 relative z-10">
                {/* MRR Card */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-200/50 dark:border-amber-900/40 relative">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="flex items-center gap-1.5 text-[10px] font-black text-amber-700 dark:text-amber-500 uppercase tracking-widest">
                                <TrendingUp size={12} />
                                Receita Recorrente (MRR)
                            </span>
                            <div className="text-3xl font-black text-gray-900 dark:text-white mt-1 uppercase tracking-tight">
                                {formatCurrency(stats.mrr)}
                            </div>
                        </div>
                    </div>
                    {platformFee > 0 && (
                        <div className="mt-4 pt-3 border-t border-amber-200/50 dark:border-amber-800/30 flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1.5">
                                <Wallet size={12} className="text-emerald-500" /> Receita Líquida Estimada
                            </span>
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(netMrr)}
                            </span>
                        </div>
                    )}
                </div>

                {/* Grid Stats */}
                <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-2 sm:col-span-1 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10 flex flex-col justify-center items-center text-center group/stat transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20">
                        <Users size={16} className="text-blue-500 mb-1.5" />
                        <p className="text-xl font-black text-gray-900 dark:text-white leading-none">
                            {String(stats.activeSubscribers).padStart(2, '0')}
                        </p>
                        <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase mt-1">Ativos</span>
                    </div>

                    <div className="col-span-2 sm:col-span-1 p-3 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30 flex flex-col justify-center items-center text-center group/stat transition-colors hover:bg-gray-100 dark:hover:bg-slate-800">
                        <Clock size={16} className="text-gray-400 mb-1.5" />
                        <p className="text-xl font-black text-gray-900 dark:text-white leading-none">
                            {String(trialingCount).padStart(2, '0')}
                        </p>
                        <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase mt-1">Trial</span>
                    </div>

                    <div className="col-span-2 sm:col-span-1 p-3 rounded-xl border border-red-500/20 bg-red-50/30 dark:bg-red-900/10 flex flex-col justify-center items-center text-center group/stat transition-colors hover:bg-red-50 dark:hover:bg-red-900/20">
                        <AlertTriangle size={16} className="text-red-500 mb-1.5" />
                        <p className="text-xl font-black text-gray-900 dark:text-white leading-none">
                            {String(stats.overdueCount).padStart(2, '0')}
                        </p>
                        <span className="text-[9px] font-bold text-red-600 dark:text-red-400 uppercase mt-1">Inadimp.</span>
                    </div>

                    <div className="col-span-2 sm:col-span-1 p-3 rounded-xl border border-gray-200/50 dark:border-slate-700 bg-gray-50/20 dark:bg-slate-900/20 flex flex-col justify-center items-center text-center group/stat transition-colors hover:bg-gray-100 dark:hover:bg-slate-800">
                        <XCircle size={16} className="text-gray-400 dark:text-gray-500 mb-1.5 opacity-70" />
                        <p className="text-xl font-black text-gray-600 dark:text-gray-400 leading-none">
                            {String(canceledCount).padStart(2, '0')}
                        </p>
                        <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase mt-1 line-through opacity-70">Canc.</span>
                    </div>
                </div>

                <div className="pt-2 border-t border-dashed border-gray-200 dark:border-slate-700">
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 text-center italic">
                        "Fidelizar clientes custa até 7x menos do que adquirir novos."
                    </p>
                </div>
            </div>
        </div>
    );
}
