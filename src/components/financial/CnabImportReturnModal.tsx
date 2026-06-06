import { useState, useMemo } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2, AlertTriangle, RefreshCw, FileCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { parseCnab240Return } from '../../services/cnab/cnabReturnParser';
import type { ParsedReturnItem } from '../../services/cnab/cnabReturnParser';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useEntity } from '../../context/EntityContext';
import { useNotification } from '../../context/NotificationContext';
import { webhookService } from '../../services/webhookService';
import type { Transaction } from '../../hooks/useTransactions';

interface CnabImportReturnModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRefresh: () => void;
}

interface MatchResult {
    parsedItem: ParsedReturnItem;
    transaction?: Transaction;
    matchStatus: 'ready_to_reconcile' | 'already_processed' | 'rejected_by_bank' | 'not_found';
    selected: boolean;
}

export function CnabImportReturnModal({ isOpen, onClose, onRefresh }: CnabImportReturnModalProps) {
    const { user } = useAuth();
    const { currentEntity } = useEntity();
    const { notify } = useNotification();

    const [file, setFile] = useState<File | null>(null);
    const [parsing, setParsing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [parsedItems, setParsedItems] = useState<ParsedReturnItem[]>([]);
    const [matches, setMatches] = useState<MatchResult[]>([]);
    const [activeTab, setActiveTab] = useState<'ready' | 'processed' | 'issues'>('ready');
    const [dragActive, setDragActive] = useState(false);

    if (!isOpen) return null;

    // Helper to calculate relative time or standard date
    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr + 'T12:00:00');
            return date.toLocaleDateString('pt-BR');
        } catch {
            return dateStr;
        }
    };

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    // ── Handle file loading and parsing ──────────────────────────────────────
    const processFileContent = async (text: string) => {
        setParsing(true);
        try {
            const parsed = parseCnab240Return(text);
            setParsedItems(parsed);

            if (parsed.length === 0) {
                notify('warning', 'Nenhuma transação de Segmento J ou T/U encontrada no arquivo.', 'Aviso');
                setMatches([]);
                setParsing(false);
                return;
            }

            // Fetch candidate transactions for matching
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];

            let query = supabase
                .from('transactions')
                .select('*, contact:contacts(name)')
                .or(`status.in.(pending,late),and(status.in.(paid,received),date.gte.${ninetyDaysAgoStr})`);

            if (currentEntity.type === 'company' && currentEntity.id) {
                query = query.eq('company_id', currentEntity.id);
            } else {
                query = query.eq('user_id', user!.id).is('company_id', null);
            }

            const { data: candidates, error } = await query;
            if (error) throw error;

            const matchedResults: MatchResult[] = parsed.map(item => {
                const tx = (candidates || []).find(t => t.id.startsWith(item.idPrefix));
                let matchStatus: MatchResult['matchStatus'] = 'not_found';
                let selected = false;

                if (tx) {
                    if (tx.status === 'paid' || tx.status === 'received') {
                        matchStatus = 'already_processed';
                    } else if (item.status === 'rejected') {
                        matchStatus = 'rejected_by_bank';
                    } else {
                        matchStatus = 'ready_to_reconcile';
                        selected = true; // Checked by default
                    }
                }

                return {
                    parsedItem: item,
                    transaction: tx,
                    matchStatus,
                    selected
                };
            });

            setMatches(matchedResults);
            
            // Switch tab to ready if any exist, otherwise issues
            const hasReady = matchedResults.some(m => m.matchStatus === 'ready_to_reconcile');
            if (hasReady) {
                setActiveTab('ready');
            } else {
                setActiveTab('issues');
            }

            notify('success', `Arquivo analisado: ${parsed.length} lançamentos encontrados.`, 'Sucesso');
        } catch (err: any) {
            console.error('Error processing CNAB return file:', err);
            notify('error', err.message || 'Falha ao ler ou buscar transações.', 'Erro');
        } finally {
            setParsing(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                processFileContent(text);
            };
            reader.readAsText(selectedFile, 'ISO-8859-1'); // Common encoding for bank files
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const selectedFile = e.dataTransfer.files[0];
            setFile(selectedFile);

            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                processFileContent(text);
            };
            reader.readAsText(selectedFile, 'ISO-8859-1');
        }
    };

    // ── Toggle selection ─────────────────────────────────────────────────────
    const handleToggleSelect = (index: number) => {
        setMatches(prev => prev.map((m, idx) => idx === index ? { ...m, selected: !m.selected } : m));
    };

    const handleToggleAll = (status: MatchResult['matchStatus']) => {
        const tabMatches = matches.filter(m => m.matchStatus === status);
        const allSelected = tabMatches.every(m => m.selected);
        setMatches(prev => prev.map(m => {
            if (m.matchStatus === status) {
                return { ...m, selected: !allSelected };
            }
            return m;
        }));
    };

    // ── Grouped matches computed states ──────────────────────────────────────
    const grouped = useMemo(() => {
        return {
            ready: matches.filter(m => m.matchStatus === 'ready_to_reconcile'),
            processed: matches.filter(m => m.matchStatus === 'already_processed'),
            issues: matches.filter(m => m.matchStatus === 'rejected_by_bank' || m.matchStatus === 'not_found')
        };
    }, [matches]);

    const selectedCount = useMemo(() => {
        return matches.filter(m => m.selected).length;
    }, [matches]);

    // ── Execute Batch Reconciliation ──────────────────────────────────────────
    const handleReconcile = async () => {
        const toUpdate = matches.filter(m => m.selected && m.matchStatus === 'ready_to_reconcile');
        if (toUpdate.length === 0) return;

        setSaving(true);
        let successCount = 0;
        let failCount = 0;

        try {
            for (const item of toUpdate) {
                if (!item.transaction) continue;
                
                const isExpense = item.transaction.type === 'expense';
                const targetStatus = isExpense ? 'paid' : 'received';
                const paymentMethod = (item.parsedItem.segmentType === 'J' || item.parsedItem.segmentType === 'O') ? 'transfer' : 'boleto';

                const notesText = `Liquidado automaticamente via Retorno CNAB em ${new Date().toLocaleDateString('pt-BR')} (Ref: ${item.parsedItem.nossoNumero || 'N/A'}).`;
                
                const updates: any = {
                    status: targetStatus,
                    payment_date: item.parsedItem.date,
                    payment_method: paymentMethod,
                    paid_amount: item.parsedItem.amount,
                    notes: item.transaction.notes ? `${item.transaction.notes}\n${notesText}` : notesText
                };

                // Save interest or discounts if available (from Segment U)
                if (item.parsedItem.interest && item.parsedItem.interest > 0) {
                    updates.interest = item.parsedItem.interest;
                }
                if (item.parsedItem.discount && item.parsedItem.discount > 0) {
                    updates.penalty = -item.parsedItem.discount; // map discount as negative penalty for compatibility
                }

                const { data: updatedRecord, error } = await supabase
                    .from('transactions')
                    .update(updates)
                    .eq('id', item.transaction.id)
                    .select()
                    .single();

                if (error) {
                    console.error(`Error reconciling transaction ${item.transaction.id}:`, error);
                    failCount++;
                } else {
                    successCount++;

                    // Sync quote if linked
                    if (updatedRecord.quote_id) {
                        await supabase
                            .from('quotes')
                            .update({ payment_status: 'paid' })
                            .eq('id', updatedRecord.quote_id);
                    }

                    // Trigger TRANSACTION_PAID webhook
                    try {
                        await webhookService.triggerWebhooks({
                            eventType: 'TRANSACTION_PAID',
                            payload: updatedRecord,
                            companyId: updatedRecord.company_id || undefined,
                            userId: updatedRecord.user_id
                        });
                    } catch (whErr) {
                        console.warn('Webhook triggering failed:', whErr);
                    }
                }
            }

            notify(
                failCount === 0 ? 'success' : 'warning',
                `Reconciliação concluída. ${successCount} atualizados com sucesso.${failCount > 0 ? ` ${failCount} falhas.` : ''}`,
                'Conciliação CNAB'
            );

            onRefresh();
            onClose();
        } catch (err: any) {
            console.error('Error during reconciliation loop:', err);
            notify('error', err.message || 'Falha ao salvar reconciliações.', 'Erro');
        } finally {
            setSaving(false);
        }
    };

    const resetModal = () => {
        setFile(null);
        setParsedItems([]);
        setMatches([]);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-r from-indigo-600 to-purple-600">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <FileCheck size={22} />
                            Importar Retorno Bancário (CNAB 240)
                        </h3>
                        <p className="text-xs text-indigo-100 mt-1">
                            Selecione o arquivo de retorno (.ret ou .txt) enviado pelo seu banco para reconciliar pagamentos e recebimentos.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/70 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 flex-1 overflow-y-auto space-y-6 min-h-0">
                    {!file ? (
                        /* Drag and Drop Zone */
                        <div
                            onDragEnter={handleDrag}
                            onDragOver={handleDrag}
                            onDragLeave={handleDrag}
                            onDrop={handleDrop}
                            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
                                dragActive
                                    ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/15 scale-[0.99]'
                                    : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/10'
                            }`}
                        >
                            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 mb-4 animate-bounce">
                                <Upload size={26} />
                            </div>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                Arraste e solte o arquivo de retorno aqui
                            </h4>
                            <p className="text-xs text-gray-500 mt-1">
                                Suporta arquivos nas extensões <strong>.ret</strong>, <strong>.txt</strong> ou <strong>.rem</strong>
                            </p>
                            
                            <div className="mt-5">
                                <label className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer shadow-md shadow-indigo-500/10 transition-colors">
                                    <FileText size={14} className="mr-2" />
                                    Selecionar arquivo
                                    <input
                                        type="file"
                                        accept=".ret,.txt,.rem"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                        </div>
                    ) : (
                        /* Parsing Results View */
                        <div className="space-y-4 flex flex-col h-full min-h-0">
                            {/* Summary header */}
                            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                                        <FileText size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-xs sm:max-w-md">
                                            {file.name}
                                        </p>
                                        <p className="text-[10px] text-gray-400">
                                            {(file.size / 1024).toFixed(1)} KB • {parsedItems.length} lançamentos encontrados
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" onClick={resetModal} size="sm">
                                        <RefreshCw size={14} className="mr-1.5" />
                                        Substituir Arquivo
                                    </Button>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex border-b border-gray-150 dark:border-slate-800">
                                <button
                                    onClick={() => setActiveTab('ready')}
                                    className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
                                        activeTab === 'ready'
                                            ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                                >
                                    Prontos para Reconciliar
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                        activeTab === 'ready' ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-slate-800 text-gray-500'
                                    }`}>
                                        {grouped.ready.length}
                                    </span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('processed')}
                                    className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
                                        activeTab === 'processed'
                                            ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                                >
                                    Já Conciliados
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                        activeTab === 'processed' ? 'bg-indigo-100 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400' : 'bg-gray-100 dark:bg-slate-800 text-gray-500'
                                    }`}>
                                        {grouped.processed.length}
                                    </span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('issues')}
                                    className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
                                        activeTab === 'issues'
                                            ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                                >
                                    Divergências / Rejeitados
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                        activeTab === 'issues' ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400' : 'bg-gray-100 dark:bg-slate-800 text-gray-500'
                                    }`}>
                                        {grouped.issues.length}
                                    </span>
                                </button>
                            </div>

                            {/* Table of matches */}
                            <div className="flex-1 overflow-y-auto border border-gray-100 dark:border-slate-800 rounded-xl min-h-[200px]">
                                {parsing ? (
                                    <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                                        <Loader2 className="animate-spin text-indigo-500 mb-2" size={24} />
                                        <p className="text-xs">Buscando transações correspondentes...</p>
                                    </div>
                                ) : (
                                    <>
                                        {activeTab === 'ready' && (
                                            <TableMatches
                                                items={grouped.ready}
                                                allMatches={matches}
                                                onToggleSelect={(idx) => handleToggleSelect(idx)}
                                                onToggleAll={() => handleToggleAll('ready_to_reconcile')}
                                                formatDate={formatDate}
                                                formatCurrency={formatCurrency}
                                                emptyMessage="Nenhuma transação pronta para conciliar encontrada neste arquivo."
                                            />
                                        )}
                                        {activeTab === 'processed' && (
                                            <TableMatches
                                                items={grouped.processed}
                                                allMatches={matches}
                                                onToggleSelect={(idx) => handleToggleSelect(idx)}
                                                onToggleAll={() => handleToggleAll('already_processed')}
                                                formatDate={formatDate}
                                                formatCurrency={formatCurrency}
                                                emptyMessage="Nenhuma transação já conciliada neste arquivo."
                                                hideCheckboxes
                                            />
                                        )}
                                        {activeTab === 'issues' && (
                                            <TableMatches
                                                items={grouped.issues}
                                                allMatches={matches}
                                                onToggleSelect={(idx) => handleToggleSelect(idx)}
                                                onToggleAll={() => {}}
                                                formatDate={formatDate}
                                                formatCurrency={formatCurrency}
                                                emptyMessage="Nenhuma divergência ou rejeição encontrada."
                                                hideCheckboxes
                                            />
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 bg-gray-50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-150 dark:border-slate-800">
                    <div className="text-xs text-gray-500">
                        {file && `${selectedCount} transações selecionadas para conciliação.`}
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
                        <Button variant="ghost" onClick={onClose} disabled={saving}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleReconcile}
                            disabled={!file || selectedCount === 0 || saving || parsing}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto shadow-md shadow-indigo-500/15"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="animate-spin mr-2" size={16} />
                                    Reconciliando...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={16} className="mr-2" />
                                    Confirmar Reconciliação ({selectedCount})
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Table helper component ──────────────────────────────────────────────────
interface TableMatchesProps {
    items: MatchResult[];
    allMatches: MatchResult[];
    onToggleSelect: (indexInAll: number) => void;
    onToggleAll: () => void;
    formatDate: (d: string) => string;
    formatCurrency: (n: number) => string;
    emptyMessage: string;
    hideCheckboxes?: boolean;
}

function TableMatches({
    items,
    allMatches,
    onToggleSelect,
    onToggleAll,
    formatDate,
    formatCurrency,
    emptyMessage,
    hideCheckboxes = false
}: TableMatchesProps) {
    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 text-center">
                <AlertTriangle size={24} className="text-slate-300 mb-2" />
                <p className="text-xs font-medium">{emptyMessage}</p>
            </div>
        );
    }

    const allChecked = items.every(i => i.selected);

    return (
        <table className="w-full text-left text-xs border-collapse">
            <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-gray-150 dark:border-slate-800 text-gray-500 font-semibold sticky top-0">
                    {!hideCheckboxes && (
                        <th className="p-3 w-10">
                            <input
                                type="checkbox"
                                checked={allChecked}
                                onChange={onToggleAll}
                                className="w-4 h-4 text-indigo-650 rounded border-gray-300 focus:ring-indigo-500"
                            />
                        </th>
                    )}
                    <th className="p-3">Identificação / Transação</th>
                    <th className="p-3">Origem (Tipo)</th>
                    <th className="p-3">Banco Status</th>
                    <th className="p-3 text-right">Valores CNAB</th>
                    <th className="p-3 text-right">Data Pagto</th>
                    <th className="p-3 text-center">Match no Sistema</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {items.map((item) => {
                    const indexInAll = allMatches.indexOf(item);

                    return (
                        <tr key={indexInAll} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/30 transition-colors">
                            {!hideCheckboxes && (
                                <td className="p-3">
                                    <input
                                        type="checkbox"
                                        checked={item.selected}
                                        onChange={() => onToggleSelect(indexInAll)}
                                        className="w-4 h-4 text-indigo-650 rounded border-gray-300 focus:ring-indigo-500"
                                    />
                                </td>
                            )}
                            <td className="p-3">
                                {item.transaction ? (
                                    <div>
                                        <span className="font-semibold text-gray-800 dark:text-white block">
                                            {item.transaction.description}
                                        </span>
                                        <span className="text-[10px] text-gray-400 block mt-0.5">
                                            ID: ...{item.transaction.id.substring(0, 8)} {item.transaction.contact?.name ? `• ${item.transaction.contact.name}` : ''}
                                        </span>
                                    </div>
                                ) : (
                                    <div>
                                        <span className="font-semibold text-gray-500 block">
                                            Identificador Desconhecido
                                        </span>
                                        <span className="text-[10px] text-gray-400 block mt-0.5 font-mono">
                                            Ref: {item.parsedItem.idPrefix}...
                                        </span>
                                    </div>
                                )}
                            </td>
                            <td className="p-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                    item.parsedItem.segmentType === 'J'
                                        ? 'bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border border-purple-200/10'
                                        : item.parsedItem.segmentType === 'O'
                                        ? 'bg-pink-50 dark:bg-pink-950/20 text-pink-600 dark:text-pink-400 border border-pink-200/10'
                                        : 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200/10'
                                }`}>
                                    {item.parsedItem.segmentType === 'J'
                                        ? 'PAGTO (J)'
                                        : item.parsedItem.segmentType === 'O'
                                        ? 'PAGTO CONC. (O)'
                                        : 'COBRANÇA (T/U)'}
                                </span>
                            </td>
                            <td className="p-3">
                                <div>
                                    <span className={`font-semibold block ${
                                        item.parsedItem.status === 'paid' || item.parsedItem.status === 'received'
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : item.parsedItem.status === 'rejected'
                                            ? 'text-rose-600 dark:text-rose-400'
                                            : 'text-amber-600 dark:text-amber-400'
                                    }`}>
                                        {item.parsedItem.occurrenceDescription}
                                    </span>
                                    <span className="text-[10px] text-gray-450 block font-mono">
                                        Cód: {item.parsedItem.occurrenceCode} {item.parsedItem.nossoNumero ? `• Nosso nº: ${item.parsedItem.nossoNumero}` : ''}
                                    </span>
                                </div>
                            </td>
                            <td className="p-3 text-right">
                                <span className="font-semibold text-gray-800 dark:text-white block">
                                    {formatCurrency(item.parsedItem.amount)}
                                </span>
                                {item.parsedItem.originalAmount !== undefined && item.parsedItem.originalAmount !== item.parsedItem.amount && (
                                    <span className="text-[10px] text-gray-400 line-through block mt-0.5">
                                        Nominal: {formatCurrency(item.parsedItem.originalAmount)}
                                    </span>
                                )}
                            </td>
                            <td className="p-3 text-right text-gray-600 dark:text-gray-300 font-medium">
                                {formatDate(item.parsedItem.date)}
                            </td>
                            <td className="p-3 text-center">
                                {item.matchStatus === 'ready_to_reconcile' && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/15">
                                        <RefreshCw size={10} className="animate-spin" /> Pronto
                                    </span>
                                )}
                                {item.matchStatus === 'already_processed' && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 border border-green-200/15">
                                        <CheckCircle2 size={10} /> Conciliado
                                    </span>
                                )}
                                {item.matchStatus === 'rejected_by_bank' && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200/15">
                                        <AlertCircle size={10} /> Rejeitado
                                    </span>
                                )}
                                {item.matchStatus === 'not_found' && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800">
                                        <AlertTriangle size={10} /> Não Encontrado
                                    </span>
                                )}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
