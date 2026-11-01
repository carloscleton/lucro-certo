import { useState, useMemo } from 'react';
import { 
    AlertTriangle, 
    CalendarClock, 
    CheckCircle2, 
    Clock, 
    XCircle, 
    Search, 
    Copy, 
    MessageCircle, 
    FileText, 
    QrCode, 
    CreditCard, 
    ArrowUpRight, 
    Calendar, 
    Check,
    AlertCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { useNotification } from '../../context/NotificationContext';
import type { FiscalInvoice } from '../../hooks/useInvoices';
import type { Charge } from '../../hooks/useCharges';
import { isInvoiceCancelled } from './BillingReportModal';

export interface PendingPaymentsAlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoices: FiscalInvoice[];
    charges: Charge[];
    onOpenBoletoModal: (invoice: any) => void;
    onNavigateToInvoice?: (invoice: any) => void;
    onOpenSendModal?: (invoice: any, type: 'whatsapp' | 'email') => void;
}

export type PaymentAlertCategory = 'overdue' | 'due_today' | 'due_soon' | 'due_future' | 'no_due_date';

export interface PaymentAlertItem {
    id: string;
    invoice?: FiscalInvoice;
    charge?: Charge;
    clientName: string;
    clientTaxId?: string;
    invoiceNumber: string;
    invoiceType: 'nfe' | 'nfse';
    issueDate?: string;
    amount: number;
    formattedAmount: string;
    dueDate?: string;
    formattedDueDate: string;
    diffDays: number | null;
    diffDaysText: string;
    category: PaymentAlertCategory;
    paymentMethod: 'boleto' | 'pix' | 'credit_card' | 'none';
    status: 'pending' | 'paid' | 'no_charge';
    paymentLink?: string;
    qrCode?: string;
    monthKey: string; // YYYY-MM based on issueDate or dueDate
}

// Helper to safely format dates
export const formatDateDisplay = (dateStr: any): string => {
    if (!dateStr) return '';
    try {
        const raw = String(dateStr).trim();
        const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            const [, year, month, day] = match;
            return `${day}/${month}/${year}`;
        }
        const parsed = new Date(raw);
        if (!isNaN(parsed.getTime())) {
            const day = String(parsed.getUTCDate()).padStart(2, '0');
            const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
            const year = parsed.getUTCFullYear();
            return `${day}/${month}/${year}`;
        }
        return raw;
    } catch {
        return String(dateStr);
    }
};

// Calculate diff in calendar days between date and today
export const getDaysDiffFromToday = (dateStr: string | null | undefined): number | null => {
    if (!dateStr) return null;
    try {
        const raw = String(dateStr).trim();
        const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        let targetDate: Date;
        if (match) {
            targetDate = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        } else {
            targetDate = new Date(raw);
        }
        if (isNaN(targetDate.getTime())) return null;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

        const diffMs = target.getTime() - today.getTime();
        return Math.round(diffMs / (1000 * 60 * 60 * 24));
    } catch {
        return null;
    }
};

export function PendingPaymentsAlertModal({
    isOpen,
    onClose,
    invoices,
    charges,
    onOpenBoletoModal,
    onNavigateToInvoice,
    onOpenSendModal
}: PendingPaymentsAlertModalProps) {
    const { notify } = useNotification();
    const [activeTab, setActiveTab] = useState<'all_pending' | 'overdue' | 'due_soon' | 'no_charge' | 'paid'>('all_pending');
    const [periodOriginFilter, setPeriodOriginFilter] = useState<'all' | 'previous_month' | 'current_month'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Format Currency Helper
    const formatBRL = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    };

    // Build consolidated list of items from invoices and charges
    const allAlertItems = useMemo<PaymentAlertItem[]>(() => {
        const items: PaymentAlertItem[] = [];
        const processedChargeIds = new Set<string>();

        // 1. Process Invoices
        (invoices || []).forEach(inv => {
            if (isInvoiceCancelled(inv) || inv.deleted) return;

            const p = inv.payload || {};
            const invNo = inv.invoice_number || 
                          p?.retorno?.numeroNfse || 
                          p?.numeroNfse || 
                          p?.numeroNfe || 
                          p?.retorno?.numero || 
                          p?.numero || 
                          p?.retorno?.dps?.numero || 
                          inv.external_id?.slice(-6) || 
                          '';

            // Find matching charge
            const matchedCharge = (charges || []).find(c => {
                if (c.status === 'cancelled' || c.status === 'rejected') return false;
                const matchByRef = invNo && c.external_reference === `NF${invNo}`;
                const matchByDesc = invNo && (c.description || '').includes(`Nº ${invNo}`);
                const matchByQuote = inv.quote_id && c.quote_id && c.quote_id === inv.quote_id;
                return matchByRef || matchByDesc || matchByQuote;
            });

            if (matchedCharge) {
                processedChargeIds.add(matchedCharge.id);
            }

            // Client Name & Tax ID
            const clientName = inv.quote?.contact?.name ||
                p?.infDPS?.toma?.xNome || p?.toma?.xNome || p?.DPS?.infDPS?.toma?.xNome || p?.retorno?.infDPS?.toma?.xNome ||
                p?.tomador?.razaoSocial || p?.tomador?.nome || p?.destinatario?.razaoSocial || p?.destinatario?.nome ||
                p?.borrower?.name || p?.retorno?.tomador?.razaoSocial || p?.retorno?.borrower?.name ||
                matchedCharge?.customer?.name ||
                (p?.noTomador ? 'CONSUMIDOR FINAL' : 'Cliente');

            const clientTaxId = inv.quote?.contact?.tax_id ||
                p?.infDPS?.toma?.cNIF || p?.toma?.cNIF || p?.infDPS?.toma?.CNPJ || p?.infDPS?.toma?.CPF ||
                p?.tomador?.cnpj || p?.tomador?.cpf || p?.destinatario?.cnpj || p?.destinatario?.cpf || '';

            // Amount
            const servicos = Array.isArray(p?.servico) ? p.servico : (p?.servico ? [p.servico] : []);
            const rawAmount = inv.amount || 
                              matchedCharge?.amount ||
                              p?.servicesAmount || 
                              p?.retorno?.servicesAmount || 
                              p?.retorno?.valorTotal || 
                              p?.infDPS?.valores?.vServPrest?.vServ ||
                              p?.valores?.vServPrest?.vServ ||
                              p?.retorno?.infDPS?.valores?.vServPrest?.vServ ||
                              p?.retorno?.valores?.vServPrest?.vServ ||
                              servicos[0]?.valor?.servico || 
                              p?.valorTotal || 
                              p?.valorTotalBruto || 
                              p?.vServ || 
                              0;

            const issueDateRaw = inv.created_at || (inv as any).issue_date || p?.dCompet || p?.dDPS;
            const dueDateRaw = matchedCharge?.due_date || p?.cobr?.dup?.[0]?.dVenc || p?.vencimento || null;

            const diffDays = getDaysDiffFromToday(dueDateRaw);

            let category: PaymentAlertCategory = 'no_due_date';
            let diffDaysText = 'Sem data definida';

            if (diffDays !== null) {
                if (diffDays < 0) {
                    category = 'overdue';
                    const abs = Math.abs(diffDays);
                    diffDaysText = abs === 1 ? 'Venceu ontem' : `Venceu há ${abs} dias`;
                } else if (diffDays === 0) {
                    category = 'due_today';
                    diffDaysText = 'Vence HOJE';
                } else if (diffDays <= 7) {
                    category = 'due_soon';
                    diffDaysText = diffDays === 1 ? 'Vence amanhã' : `Vence em ${diffDays} dias`;
                } else {
                    category = 'due_future';
                    diffDaysText = `Vence em ${diffDays} dias`;
                }
            }

            const isPaid = matchedCharge ? (matchedCharge.status === 'paid' || matchedCharge.status === 'approved') : false;
            const itemStatus = isPaid ? 'paid' : (matchedCharge ? 'pending' : 'no_charge');

            // Payment method
            let method: 'boleto' | 'pix' | 'credit_card' | 'none' = 'none';
            if (matchedCharge) {
                if (matchedCharge.payment_method === 'pix' || !!matchedCharge.qr_code) method = 'pix';
                else if (matchedCharge.payment_method === 'credit_card') method = 'credit_card';
                else method = 'boleto';
            }

            // Determine month key (YYYY-MM)
            const refDateStr = dueDateRaw || issueDateRaw;
            let monthKey = '';
            if (refDateStr) {
                const d = new Date(refDateStr);
                if (!isNaN(d.getTime())) {
                    monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                }
            }

            items.push({
                id: `inv-${inv.id}`,
                invoice: inv,
                charge: matchedCharge,
                clientName,
                clientTaxId,
                invoiceNumber: invNo ? String(invNo) : '',
                invoiceType: inv.type || 'nfse',
                issueDate: issueDateRaw,
                amount: Number(rawAmount),
                formattedAmount: formatBRL(Number(rawAmount)),
                dueDate: dueDateRaw || undefined,
                formattedDueDate: formatDateDisplay(dueDateRaw) || 'Não informada',
                diffDays,
                diffDaysText,
                category,
                paymentMethod: method,
                status: itemStatus,
                paymentLink: matchedCharge?.payment_link,
                qrCode: matchedCharge?.qr_code,
                monthKey
            });
        });

        // 2. Process any remaining Charges not linked to an invoice in the list
        (charges || []).forEach(c => {
            if (processedChargeIds.has(c.id)) return;
            if (c.status === 'cancelled' || c.status === 'rejected') return;

            const isPaid = c.status === 'paid' || c.status === 'approved';
            const diffDays = getDaysDiffFromToday(c.due_date);

            let category: PaymentAlertCategory = 'no_due_date';
            let diffDaysText = 'Sem data definida';

            if (diffDays !== null) {
                if (diffDays < 0) {
                    category = 'overdue';
                    const abs = Math.abs(diffDays);
                    diffDaysText = abs === 1 ? 'Venceu ontem' : `Venceu há ${abs} dias`;
                } else if (diffDays === 0) {
                    category = 'due_today';
                    diffDaysText = 'Vence HOJE';
                } else if (diffDays <= 7) {
                    category = 'due_soon';
                    diffDaysText = diffDays === 1 ? 'Vence amanhã' : `Vence em ${diffDays} dias`;
                } else {
                    category = 'due_future';
                    diffDaysText = `Vence em ${diffDays} dias`;
                }
            }

            let method: 'boleto' | 'pix' | 'credit_card' | 'none' = 'boleto';
            if (c.payment_method === 'pix' || !!c.qr_code) method = 'pix';
            else if (c.payment_method === 'credit_card') method = 'credit_card';

            const refDateStr = c.due_date || c.created_at;
            let monthKey = '';
            if (refDateStr) {
                const d = new Date(refDateStr);
                if (!isNaN(d.getTime())) {
                    monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                }
            }

            items.push({
                id: `chg-${c.id}`,
                charge: c,
                clientName: c.customer?.name || c.description || 'Cobrança Avulsa',
                invoiceNumber: c.external_reference || '',
                invoiceType: 'nfse',
                issueDate: c.created_at,
                amount: Number(c.amount || 0),
                formattedAmount: formatBRL(Number(c.amount || 0)),
                dueDate: c.due_date,
                formattedDueDate: formatDateDisplay(c.due_date) || 'Não informada',
                diffDays,
                diffDaysText,
                category,
                paymentMethod: method,
                status: isPaid ? 'paid' : 'pending',
                paymentLink: c.payment_link,
                qrCode: c.qr_code,
                monthKey
            });
        });

        // Sort items: Overdue first (most overdue first), then Due Today, then Due Soon, then Future, then No Due Date
        return items.sort((a, b) => {
            // Put unpaid first
            if (a.status !== 'paid' && b.status === 'paid') return -1;
            if (a.status === 'paid' && b.status !== 'paid') return 1;

            // Prioritize Overdue
            if (a.category === 'overdue' && b.category !== 'overdue') return -1;
            if (a.category !== 'overdue' && b.category === 'overdue') return 1;

            // Prioritize Due Today
            if (a.category === 'due_today' && b.category !== 'due_today') return -1;
            if (a.category !== 'due_today' && b.category === 'due_today') return 1;

            // Prioritize Due Soon
            if (a.category === 'due_soon' && b.category !== 'due_soon') return -1;
            if (a.category !== 'due_soon' && b.category === 'due_soon') return 1;

            // Otherwise sort by diffDays ascending (closest deadline first)
            if (a.diffDays !== null && b.diffDays !== null) {
                return a.diffDays - b.diffDays;
            }
            if (a.diffDays !== null) return -1;
            if (b.diffDays !== null) return 1;

            return 0;
        });
    }, [invoices, charges]);

    // KPI Totals across all open items
    const stats = useMemo(() => {
        let overdueCount = 0;
        let overdueTotal = 0;
        let dueSoonCount = 0;
        let dueSoonTotal = 0;
        let pendingCount = 0;
        let pendingTotal = 0;
        let noChargeCount = 0;
        let noChargeTotal = 0;
        let paidCount = 0;
        let paidTotal = 0;

        allAlertItems.forEach(item => {
            if (item.status === 'paid') {
                paidCount++;
                paidTotal += item.amount;
                return;
            }

            if (item.status === 'no_charge') {
                noChargeCount++;
                noChargeTotal += item.amount;
                pendingCount++;
                pendingTotal += item.amount;
                return;
            }

            pendingCount++;
            pendingTotal += item.amount;

            if (item.category === 'overdue') {
                overdueCount++;
                overdueTotal += item.amount;
            } else if (item.category === 'due_today' || item.category === 'due_soon') {
                dueSoonCount++;
                dueSoonTotal += item.amount;
            }
        });

        return {
            overdueCount,
            overdueTotal,
            dueSoonCount,
            dueSoonTotal,
            pendingCount,
            pendingTotal,
            noChargeCount,
            noChargeTotal,
            paidCount,
            paidTotal
        };
    }, [allAlertItems]);

    // Filter by Tab, Origin Month, and Search Query
    const filteredItems = useMemo(() => {
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

        return allAlertItems.filter(item => {
            // 1. Tab filter
            if (activeTab === 'all_pending') {
                if (item.status === 'paid') return false;
            } else if (activeTab === 'overdue') {
                if (item.status === 'paid' || item.category !== 'overdue') return false;
            } else if (activeTab === 'due_soon') {
                if (item.status === 'paid' || (item.category !== 'due_today' && item.category !== 'due_soon')) return false;
            } else if (activeTab === 'no_charge') {
                if (item.status !== 'no_charge') return false;
            } else if (activeTab === 'paid') {
                if (item.status !== 'paid') return false;
            }

            // 2. Period / Month origin filter
            if (periodOriginFilter === 'current_month') {
                if (item.monthKey && item.monthKey !== currentMonthKey) return false;
            } else if (periodOriginFilter === 'previous_month') {
                if (item.monthKey && item.monthKey !== prevMonthKey) return false;
            }

            // 3. Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = item.clientName.toLowerCase().includes(q);
                const matchInv = item.invoiceNumber.toLowerCase().includes(q);
                const matchTax = (item.clientTaxId || '').includes(q);
                if (!matchName && !matchInv && !matchTax) return false;
            }

            return true;
        });
    }, [allAlertItems, activeTab, periodOriginFilter, searchQuery]);

    const handleCopy = (text: string, id: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        notify('success', `${label} copiado para a área de transferência!`);
        setTimeout(() => setCopiedId(null), 2500);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Alertas de Vencimentos & Cobranças em Aberto"
            subtitle="Monitore e acompanhe notas fiscais e boletos a vencer ou vencidos, inclusive de meses anteriores"
            icon={CalendarClock}
            variant={stats.overdueCount > 0 ? 'danger' : stats.dueSoonCount > 0 ? 'warning' : 'primary'}
            maxWidth="max-w-6xl"
        >
            <div className="space-y-5">
                {/* 1. Header KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Vencidos */}
                    <div 
                        onClick={() => setActiveTab('overdue')}
                        className={clsx(
                            "p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none shadow-sm",
                            activeTab === 'overdue'
                                ? "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 ring-2 ring-rose-500/20"
                                : "bg-white dark:bg-slate-900 border-rose-100 dark:border-rose-950/40 hover:border-rose-300 dark:hover:border-rose-800"
                        )}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                                <XCircle size={14} className="text-rose-500" />
                                Vencidos / Em Atraso
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                                {stats.overdueCount}
                            </span>
                        </div>
                        <div className="mt-2">
                            <div className="text-xl font-black text-rose-700 dark:text-rose-300">
                                {formatBRL(stats.overdueTotal)}
                            </div>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                Boletos que já passaram do vencimento
                            </span>
                        </div>
                    </div>

                    {/* Vencem em Breve / Hoje */}
                    <div 
                        onClick={() => setActiveTab('due_soon')}
                        className={clsx(
                            "p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none shadow-sm",
                            activeTab === 'due_soon'
                                ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 ring-2 ring-amber-500/20"
                                : "bg-white dark:bg-slate-900 border-amber-100 dark:border-amber-950/40 hover:border-amber-300 dark:hover:border-amber-800"
                        )}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                <Clock size={14} className="text-amber-500" />
                                Vencem Hoje / 7 Dias
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                                {stats.dueSoonCount}
                            </span>
                        </div>
                        <div className="mt-2">
                            <div className="text-xl font-black text-amber-700 dark:text-amber-300">
                                {formatBRL(stats.dueSoonTotal)}
                            </div>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                Vencimentos imediatos nesta semana
                            </span>
                        </div>
                    </div>

                    {/* Total em Aberto */}
                    <div 
                        onClick={() => setActiveTab('all_pending')}
                        className={clsx(
                            "p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none shadow-sm",
                            activeTab === 'all_pending'
                                ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20"
                                : "bg-white dark:bg-slate-900 border-blue-100 dark:border-blue-950/40 hover:border-blue-300 dark:hover:border-blue-800"
                        )}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                <AlertTriangle size={14} className="text-blue-500" />
                                Total em Aberto
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-600 text-white">
                                {stats.pendingCount}
                            </span>
                        </div>
                        <div className="mt-2">
                            <div className="text-xl font-black text-blue-700 dark:text-blue-300">
                                {formatBRL(stats.pendingTotal)}
                            </div>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                Saldo total pendente a receber
                            </span>
                        </div>
                    </div>

                    {/* Notas Sem Cobrança */}
                    <div 
                        onClick={() => setActiveTab('no_charge')}
                        className={clsx(
                            "p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none shadow-sm",
                            activeTab === 'no_charge'
                                ? "bg-violet-50 dark:bg-violet-950/40 border-violet-300 dark:border-violet-700 ring-2 ring-violet-500/20"
                                : "bg-white dark:bg-slate-900 border-violet-100 dark:border-violet-950/40 hover:border-violet-300 dark:hover:border-violet-800"
                        )}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                                <FileText size={14} className="text-violet-500" />
                                Notas Sem Boleto
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-violet-600 text-white">
                                {stats.noChargeCount}
                            </span>
                        </div>
                        <div className="mt-2">
                            <div className="text-xl font-black text-violet-700 dark:text-violet-300">
                                {formatBRL(stats.noChargeTotal)}
                            </div>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                Emitidas que ainda não geraram cobrança
                            </span>
                        </div>
                    </div>
                </div>

                {/* 2. Month-Turn Alert Helper Banner */}
                <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 rounded-2xl border border-amber-200/80 dark:border-amber-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl flex-shrink-0">
                            <CalendarClock size={18} />
                        </div>
                        <div>
                            <span className="font-bold text-amber-900 dark:text-amber-200 block">
                                Virada de Mês Sem Perder Cobranças
                            </span>
                            <p className="text-[11px] text-amber-700 dark:text-amber-400">
                                Este painel exibe boletos e notas fiscais de <strong>qualquer período</strong> que continuam em aberto ou a vencer, mesmo se o filtro da tela estiver no mês atual.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-center">
                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mr-1">Origem:</span>
                        <button
                            type="button"
                            onClick={() => setPeriodOriginFilter('all')}
                            className={clsx(
                                "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer",
                                periodOriginFilter === 'all'
                                    ? "bg-amber-600 text-white shadow-sm"
                                    : "bg-white/80 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-white"
                            )}
                        >
                            Todas as Datas
                        </button>
                        <button
                            type="button"
                            onClick={() => setPeriodOriginFilter('previous_month')}
                            className={clsx(
                                "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer",
                                periodOriginFilter === 'previous_month'
                                    ? "bg-amber-600 text-white shadow-sm"
                                    : "bg-white/80 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-white"
                            )}
                        >
                            Mês Anterior
                        </button>
                        <button
                            type="button"
                            onClick={() => setPeriodOriginFilter('current_month')}
                            className={clsx(
                                "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer",
                                periodOriginFilter === 'current_month'
                                    ? "bg-amber-600 text-white shadow-sm"
                                    : "bg-white/80 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-white"
                            )}
                        >
                            Mês Atual
                        </button>
                    </div>
                </div>

                {/* 3. Controls: Tabs and Search Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
                    {/* Navigation Tabs */}
                    <div className="flex flex-wrap items-center gap-1.5 p-1 bg-gray-100 dark:bg-slate-900 rounded-xl border border-gray-200/60 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => setActiveTab('all_pending')}
                            className={clsx(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                                activeTab === 'all_pending'
                                    ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            )}
                        >
                            <span>Todas em Aberto</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300">
                                {stats.pendingCount}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('overdue')}
                            className={clsx(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                                activeTab === 'overdue'
                                    ? "bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm"
                                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            )}
                        >
                            <span>Vencidos</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-300">
                                {stats.overdueCount}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('due_soon')}
                            className={clsx(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                                activeTab === 'due_soon'
                                    ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm"
                                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            )}
                        >
                            <span>Vencendo em Breve</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-300">
                                {stats.dueSoonCount}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('no_charge')}
                            className={clsx(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                                activeTab === 'no_charge'
                                    ? "bg-white dark:bg-slate-800 text-violet-600 dark:text-violet-400 shadow-sm"
                                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            )}
                        >
                            <span>Sem Boleto</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-300">
                                {stats.noChargeCount}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('paid')}
                            className={clsx(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                                activeTab === 'paid'
                                    ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            )}
                        >
                            <span>Pagas</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300">
                                {stats.paidCount}
                            </span>
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative min-w-[260px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar cliente, número de nota..."
                            className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>
                </div>

                {/* 4. Table / List of Items */}
                <div className="border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                    <div className="overflow-x-auto max-h-[50vh] scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-800/80 sticky top-0 z-10 backdrop-blur-sm">
                                    <th className="py-3 px-4 font-black text-[10px] uppercase tracking-wider text-gray-400">Status / Vencimento</th>
                                    <th className="py-3 px-4 font-black text-[10px] uppercase tracking-wider text-gray-400">Cliente / Tomador</th>
                                    <th className="py-3 px-4 font-black text-[10px] uppercase tracking-wider text-gray-400">Documento / Nota</th>
                                    <th className="py-3 px-4 font-black text-[10px] uppercase tracking-wider text-gray-400">Valor</th>
                                    <th className="py-3 px-4 font-black text-[10px] uppercase tracking-wider text-gray-400">Cobrança</th>
                                    <th className="py-3 px-4 font-black text-[10px] uppercase tracking-wider text-gray-400 text-right">Ações Rápidas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 font-medium">
                                {filteredItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-14 text-center">
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-full mb-3 text-gray-400">
                                                    <CheckCircle2 size={32} />
                                                </div>
                                                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                                    Nenhuma pendência encontrada nesta categoria!
                                                </p>
                                                <p className="text-xs text-gray-400 mt-1 max-w-sm">
                                                    Todos os pagamentos e notas fiscais selecionados estão em dia ou não correspondem ao filtro atual.
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredItems.map(item => {
                                        return (
                                            <tr 
                                                key={item.id} 
                                                className={clsx(
                                                    "group hover:bg-gray-50/70 dark:hover:bg-slate-800/50 transition-colors",
                                                    item.category === 'overdue' && item.status !== 'paid' && "bg-rose-50/20 dark:bg-rose-950/10",
                                                    (item.category === 'due_today' || item.category === 'due_soon') && item.status !== 'paid' && "bg-amber-50/20 dark:bg-amber-950/10"
                                                )}
                                            >
                                                {/* Vencimento e Status Pill */}
                                                <td className="py-3 px-4">
                                                    <div className="flex flex-col gap-1 items-start">
                                                        {item.status === 'paid' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                                                <CheckCircle2 size={11} />
                                                                PAGO
                                                            </span>
                                                        ) : item.category === 'overdue' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse">
                                                                <XCircle size={11} />
                                                                {item.diffDaysText.toUpperCase()}
                                                            </span>
                                                        ) : item.category === 'due_today' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                                                <Clock size={11} />
                                                                {item.diffDaysText.toUpperCase()}
                                                            </span>
                                                        ) : item.category === 'due_soon' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                                                                <Clock size={11} />
                                                                {item.diffDaysText}
                                                            </span>
                                                        ) : item.category === 'due_future' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                                                                <Calendar size={11} />
                                                                {item.diffDaysText}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-slate-800 text-gray-500 border border-gray-200 dark:border-slate-700">
                                                                <AlertCircle size={11} />
                                                                SEM VENCIMENTO
                                                            </span>
                                                        )}

                                                        <div className="text-[11px] font-bold text-gray-700 dark:text-gray-300 pl-0.5">
                                                            Vence: {item.formattedDueDate}
                                                        </div>
                                                        {item.issueDate && (
                                                            <span className="text-[9px] text-gray-400 pl-0.5">
                                                                Emissão: {formatDateDisplay(item.issueDate)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Cliente */}
                                                <td className="py-3 px-4 max-w-[220px]">
                                                    <div className="font-extrabold text-gray-900 dark:text-white truncate" title={item.clientName}>
                                                        {item.clientName}
                                                    </div>
                                                    {item.clientTaxId && (
                                                        <div className="text-[10px] text-gray-400 font-mono">
                                                            {item.clientTaxId}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Documento / Nota Fiscal */}
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded text-[9px] font-black uppercase border border-gray-200 dark:border-slate-700">
                                                            {item.invoiceType.toUpperCase()}
                                                        </span>
                                                        <span className="font-extrabold text-gray-900 dark:text-white">
                                                            {item.invoiceNumber ? `Nº ${item.invoiceNumber}` : 'Avulsa'}
                                                        </span>
                                                    </div>
                                                    {item.invoice && (
                                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                                                            Autorizada
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Valor */}
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    <div className="font-black text-sm text-gray-900 dark:text-white">
                                                        {item.formattedAmount}
                                                    </div>
                                                </td>

                                                {/* Cobrança / Método */}
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    {item.paymentMethod === 'boleto' ? (
                                                        <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-bold text-xs bg-purple-50 dark:bg-purple-950/30 px-2 py-1 rounded-lg border border-purple-200/60 dark:border-purple-800/40 w-fit">
                                                            <FileText size={13} />
                                                            <span>Boleto Bancário</span>
                                                        </div>
                                                    ) : item.paymentMethod === 'pix' ? (
                                                        <div className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400 font-bold text-xs bg-teal-50 dark:bg-teal-950/30 px-2 py-1 rounded-lg border border-teal-200/60 dark:border-teal-800/40 w-fit">
                                                            <QrCode size={13} />
                                                            <span>Cobrança Pix</span>
                                                        </div>
                                                    ) : item.paymentMethod === 'credit_card' ? (
                                                        <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold text-xs bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded-lg border border-blue-200/60 dark:border-blue-800/40 w-fit">
                                                            <CreditCard size={13} />
                                                            <span>Cartão de Crédito</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold text-xs bg-rose-50 dark:bg-rose-950/30 px-2 py-1 rounded-lg border border-rose-200/60 dark:border-rose-800/40 w-fit">
                                                            <AlertCircle size={13} />
                                                            <span>Sem Cobrança</span>
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Ações */}
                                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {/* Botão Gerenciar Boleto */}
                                                        {item.invoice && (
                                                            <Tooltip content={item.charge ? "Ver / Gerenciar Boleto e Cobrança" : "Gerar Boleto para esta Nota Fiscal"}>
                                                                <button
                                                                    onClick={() => {
                                                                        onOpenBoletoModal(item.invoice);
                                                                    }}
                                                                    className={clsx(
                                                                        "p-1.5 rounded-lg border transition-all cursor-pointer font-bold text-xs flex items-center gap-1",
                                                                        item.charge
                                                                            ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100"
                                                                            : "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-sm"
                                                                    )}
                                                                >
                                                                    <FileText size={13} />
                                                                    <span className="hidden sm:inline">
                                                                        {item.charge ? "Boleto" : "Gerar Boleto"}
                                                                    </span>
                                                                </button>
                                                            </Tooltip>
                                                        )}

                                                        {/* Copiar Pix / Link */}
                                                        {item.qrCode && (
                                                            <Tooltip content="Copiar Pix Copia e Cola">
                                                                <button
                                                                    onClick={() => handleCopy(item.qrCode!, item.id + '-pix', 'Código Pix')}
                                                                    className="p-1.5 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 rounded-lg transition-all cursor-pointer"
                                                                >
                                                                    {copiedId === item.id + '-pix' ? <Check size={13} className="text-emerald-500" /> : <QrCode size={13} />}
                                                                </button>
                                                            </Tooltip>
                                                        )}

                                                        {item.paymentLink && (
                                                            <Tooltip content="Copiar Link de Pagamento">
                                                                <button
                                                                    onClick={() => handleCopy(item.paymentLink!, item.id + '-link', 'Link de Pagamento')}
                                                                    className="p-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 rounded-lg transition-all cursor-pointer"
                                                                >
                                                                    {copiedId === item.id + '-link' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                                                </button>
                                                            </Tooltip>
                                                        )}

                                                        {/* WhatsApp */}
                                                        {onOpenSendModal && item.invoice && (
                                                            <Tooltip content="Enviar cobrança via WhatsApp">
                                                                <button
                                                                    onClick={() => onOpenSendModal(item.invoice, 'whatsapp')}
                                                                    className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 rounded-lg transition-all cursor-pointer"
                                                                >
                                                                    <MessageCircle size={13} />
                                                                </button>
                                                            </Tooltip>
                                                        )}

                                                        {/* Ver Nota na Lista Geral */}
                                                        {onNavigateToInvoice && item.invoice && (
                                                            <Tooltip content="Localizar esta nota no histórico principal">
                                                                <button
                                                                    onClick={() => onNavigateToInvoice(item.invoice)}
                                                                    className="p-1.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-200 rounded-lg transition-all cursor-pointer"
                                                                >
                                                                    <ArrowUpRight size={13} />
                                                                </button>
                                                            </Tooltip>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 5. Footer Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        Mostrando <strong>{filteredItems.length}</strong> de <strong>{allAlertItems.length}</strong> registros analisados.
                    </div>
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="px-5 py-2 font-bold text-xs rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300"
                    >
                        Fechar Painel
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
