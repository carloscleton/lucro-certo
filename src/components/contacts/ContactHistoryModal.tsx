import { useState, useEffect } from 'react';
import { History, TrendingUp, FileText, DollarSign, Target } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import type { CRMDeal } from '../../hooks/useCRM';
import type { Quote } from '../../hooks/useQuotes';
import type { Transaction } from '../../hooks/useTransactions';

interface ContactHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    contactId: string;
    contactName: string;
}

type TimelineItem = {
    id: string;
    type: 'deal' | 'quote' | 'transaction';
    date: string;
    title: string;
    value: number;
    status: string;
};

export function ContactHistoryModal({ isOpen, onClose, contactId, contactName }: ContactHistoryModalProps) {
    const [timeline, setTimeline] = useState<TimelineItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [ltv, setLtv] = useState(0);

    useEffect(() => {
        if (isOpen && contactId) {
            fetchHistory();
        }
    }, [isOpen, contactId]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const [dealsRes, quotesRes, transRes] = await Promise.all([
                supabase.from('crm_deals').select('*').eq('contact_id', contactId),
                supabase.from('quotes').select('*').eq('contact_id', contactId),
                supabase.from('transactions').select('*').eq('contact_id', contactId)
            ]);

            const items: TimelineItem[] = [];
            let totalReceived = 0;

            (dealsRes.data || []).forEach((d: CRMDeal) => {
                items.push({
                    id: d.id,
                    type: 'deal',
                    date: d.created_at,
                    title: d.title,
                    value: d.value,
                    status: d.status
                });
            });

            (quotesRes.data || []).forEach((q: Quote) => {
                items.push({
                    id: q.id,
                    type: 'quote',
                    date: q.created_at || '',
                    title: q.title,
                    value: q.total_amount,
                    status: q.status
                });
            });

            (transRes.data || []).forEach((t: Transaction) => {
                items.push({
                    id: t.id,
                    type: 'transaction',
                    date: t.date,
                    title: t.description,
                    value: t.amount,
                    status: t.status
                });
                if (t.type === 'income' && t.status === 'received') {
                    totalReceived += t.paid_amount || t.amount;
                }
            });

            // Sort by date descending
            items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            setTimeline(items);
            setLtv(totalReceived);
        } catch (error) {
            console.error('Error fetching contact history:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('pt-BR');
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Histórico do Cliente"
            subtitle={contactName}
            icon={History}
            maxWidth="max-w-2xl"
        >
            <div className="space-y-6">
                {/* LTV Header */}
                <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                    <div>
                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Valor Vitalício (LTV)</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(ltv)}</p>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm">
                        <TrendingUp size={24} className="text-emerald-600" />
                    </div>
                </div>

                {/* Timeline */}
                <div className="relative space-y-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12 italic text-gray-500 animate-pulse">
                            Carregando histórico...
                        </div>
                    ) : timeline.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 italic">
                            Nenhuma interação registrada para este contato.
                        </div>
                    ) : (
                        <div className="relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100 dark:before:bg-slate-700">
                            {timeline.map((item) => (
                                <div key={`${item.type}-${item.id}`} className="relative pl-10 pb-6 last:pb-0">
                                    {/* Icon Dot */}
                                    <div className={`absolute left-0 top-1 w-8 h-8 rounded-full flex items-center justify-center shadow-sm z-10 ${item.type === 'deal' ? 'bg-purple-100 text-purple-600' :
                                        item.type === 'quote' ? 'bg-blue-100 text-blue-600' :
                                            'bg-emerald-100 text-emerald-600'
                                        }`}>
                                        {item.type === 'deal' ? <Target size={14} /> :
                                            item.type === 'quote' ? <FileText size={14} /> :
                                                <DollarSign size={14} />}
                                    </div>

                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700/50 hover:border-gray-200 dark:hover:border-slate-600 transition-all">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-bold text-gray-900 dark:text-white text-sm">{item.title}</h4>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">{formatDate(item.date)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${item.status === 'won' || item.status === 'received' || item.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                                                    item.status === 'active' || item.status === 'draft' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {item.status}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {item.type === 'deal' ? 'Negócio' : item.type === 'quote' ? 'Orçamento' : 'Pagamento'}
                                                </span>
                                            </div>
                                            <span className="font-bold text-gray-900 dark:text-white text-sm">{formatCurrency(item.value)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
