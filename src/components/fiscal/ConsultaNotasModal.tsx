import { useState } from 'react';
import { Search, AlertCircle, RefreshCw, X, FileText, FileCode, CheckCircle2, Clock3, XCircle, Calendar, Receipt } from 'lucide-react';
import { Button } from '../ui/Button';
import { fiscalService } from '../../services/fiscalService';
import { supabase } from '../../lib/supabase';
import { API_BASE_URL } from '../../lib/constants';
import { formatCurrency } from '../../utils/currencyUtils';

interface ConsultaNotasModalProps {
    onClose: () => void;
    companyId: string;
}

export function ConsultaNotasModal({ onClose, companyId }: ConsultaNotasModalProps) {
    const [dataInicial, setDataInicial] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [dataFinal, setDataFinal] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [tipo, setTipo] = useState<'nfse' | 'nfe'>('nfse');
    const [isConsulting, setIsConsulting] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleConsultar = async () => {
        if (!dataInicial || !dataFinal) {
            setError('Preencha a data inicial e final.');
            return;
        }
        
        setIsConsulting(true);
        setError(null);
        setResults([]);
        
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');
            
            const combinedMap = new Map<string, any>();

            // 1. Consultar registros locais da tabela fiscal_invoices no Supabase
            try {
                const startDateISO = `${dataInicial}T00:00:00.000Z`;
                const endDateISO = `${dataFinal}T23:59:59.999Z`;

                const { data: dbInvoices } = await supabase
                    .from('fiscal_invoices')
                    .select('*')
                    .eq('company_id', companyId)
                    .gte('created_at', startDateISO)
                    .lte('created_at', endDateISO)
                    .order('created_at', { ascending: false });

                if (dbInvoices && dbInvoices.length > 0) {
                    dbInvoices.forEach((inv: any) => {
                        const p = inv.payload || {};
                        const servicos = Array.isArray(p.servico) ? p.servico : (p.servico ? [p.servico] : []);
                        const servico = servicos[0];
                        const val = inv.amount || 
                                    p?.servicesAmount || 
                                    p?.retorno?.servicesAmount || 
                                    p?.retorno?.valorTotal || 
                                    p?.infDPS?.valores?.vServPrest?.vServ ||
                                    p?.valores?.vServPrest?.vServ ||
                                    servico?.valor?.servico || 
                                    p?.valorTotal || 0;

                        const tomador = p?.infDPS?.toma?.xNome || 
                                        p?.toma?.xNome || 
                                        p?.tomador?.razaoSocial || 
                                        p?.destinatario?.nome || 
                                        'Cliente Cadastrado';

                        const tomadorDoc = p?.infDPS?.toma?.cpfCnpj || 
                                           p?.toma?.cpfCnpj || 
                                           p?.tomador?.cpfCnpj || 
                                           p?.destinatario?.cpfCnpj || '';

                        const baseApi = API_BASE_URL.replace(/\/$/, '');
                        const pdfUrl = inv.payload?.pdf_url || 
                                       inv.payload?.retorno?.pdfUrl || 
                                       (inv.external_id ? `${baseApi}/fiscal-module/${inv.type || 'national'}/${inv.external_id || inv.id}/pdf?companyId=${companyId}` : null);

                        const xmlUrl = inv.payload?.xml_url || 
                                       inv.payload?.xml || 
                                       (inv.external_id ? `${baseApi}/fiscal-module/${inv.type || 'national'}/${inv.external_id || inv.id}/xml?companyId=${companyId}` : null);

                        const key = String(inv.external_id || inv.id);
                        combinedMap.set(key, {
                            id: key,
                            situacao: (inv.status || 'CONCLUIDO').toUpperCase(),
                            tomador,
                            tomadorDoc,
                            emissao: new Date(inv.created_at).toLocaleDateString('pt-BR'),
                            autorizacao: new Date(inv.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                            valorServico: typeof val === 'number' ? val : (parseFloat(String(val).replace(',', '.')) || 0),
                            numeroNfse: inv.invoice_number || inv.dps_number || p?.numero || p?.nfseNumero || '',
                            pdf: pdfUrl,
                            xml: xmlUrl
                        });
                    });
                }
            } catch (localErr) {
                console.warn('⚠️ [CONSULTA-LOCAL] Erro ao buscar no Supabase:', localErr);
            }

            // 2. Consultar notas remotas via API do backend (TecnoSpeed/NFe.io/National)
            try {
                const response = await fiscalService.consultarNotasPorPeriodo(companyId, dataInicial, dataFinal, tipo, token);
                const notasArray = response?.notas || (Array.isArray(response) ? response : []);
                if (Array.isArray(notasArray)) {
                    notasArray.forEach((remoteInv: any) => {
                        const key = String(remoteInv.id || remoteInv.external_id || remoteInv.numeroNfse);
                        if (key && !combinedMap.has(key)) {
                            combinedMap.set(key, remoteInv);
                        }
                    });
                }
            } catch (remoteErr) {
                console.warn('⚠️ [CONSULTA-REMOTA] Busca na API externa retornou erro/indisponível:', remoteErr);
            }

            const finalResults = Array.from(combinedMap.values());
            setResults(finalResults);

            if (finalResults.length === 0) {
                setError('Nenhuma nota fiscal encontrada no período especificado.');
            }
        } catch (err: any) {
            console.error('Erro ao consultar notas:', err);
            setError(err.message || 'Erro ao consultar notas.');
        } finally {
            setIsConsulting(false);
        }
    };

    const totalCalculado = results.reduce((acc, curr) => acc + (curr.valorServico || 0), 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-6xl max-h-[92vh] flex flex-col rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-300 overflow-hidden">
                
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 dark:border-slate-800/80 bg-gray-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-100 dark:border-blue-900/40 shadow-sm">
                            <Search size={26} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Consulta de Notas Fiscais</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Consulte e baixe notas fiscais emitidas no período selecionado</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 min-h-0 p-6 md:p-8 flex flex-col gap-4 overflow-hidden">
                    {/* Horizontal Filter Toolbar */}
                    <div className="p-3.5 bg-gray-50/80 dark:bg-slate-800/40 rounded-2xl border border-gray-100 dark:border-slate-800 flex flex-wrap items-center gap-3 shrink-0">
                        <div className="flex-1 min-w-[160px]">
                            <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1 ml-1">Tipo de Nota</label>
                            <select 
                                value={tipo} 
                                onChange={(e: any) => setTipo(e.target.value)}
                                className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                            >
                                <option value="nfse">NFS-e (Nota de Serviço)</option>
                                <option value="nfe">NF-e (Nota de Produto)</option>
                            </select>
                        </div>
                        <div className="flex-1 min-w-[130px]">
                            <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1 ml-1">Data Inicial</label>
                            <input 
                                type="date" 
                                value={dataInicial} 
                                onChange={(e) => setDataInicial(e.target.value)}
                                className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                            />
                        </div>
                        <div className="flex-1 min-w-[130px]">
                            <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1 ml-1">Data Final</label>
                            <input 
                                type="date" 
                                value={dataFinal} 
                                onChange={(e) => setDataFinal(e.target.value)}
                                className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                            />
                        </div>
                        <div className="self-end">
                            <Button 
                                variant="primary" 
                                onClick={handleConsultar} 
                                isLoading={isConsulting}
                                className="h-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-bold text-xs px-6 shadow-md shadow-blue-500/20 active:scale-95 transition-all"
                            >
                                {isConsulting ? <RefreshCw className="animate-spin mr-1.5" size={15} /> : <Search size={15} className="mr-1.5" />}
                                Buscar Notas
                            </Button>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 px-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-2xl flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs font-semibold shrink-0">
                            <AlertCircle size={18} className="shrink-0 text-rose-500" />
                            <p>{error}</p>
                        </div>
                    )}

                    {/* Summary Bar when results found */}
                    {results.length > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl text-xs shrink-0">
                            <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-bold">
                                <Receipt size={16} className="text-blue-600 dark:text-blue-400" />
                                <span>{results.length} nota{results.length !== 1 ? 's' : ''} localizada{results.length !== 1 ? 's' : ''} no período</span>
                            </div>
                            <div className="flex items-center gap-1.5 font-extrabold text-gray-900 dark:text-white">
                                <span className="text-gray-400 font-medium">Total:</span>
                                <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(totalCalculado)}</span>
                            </div>
                        </div>
                    )}

                    {/* Table Results with Internal Scrollbar */}
                    {results.length > 0 && (
                        <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 flex flex-col overflow-hidden shadow-sm">
                            <div className="w-full h-full overflow-y-auto overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                                    <thead className="sticky top-0 z-10 bg-gray-50/95 dark:bg-slate-800/95 backdrop-blur-sm border-b border-gray-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-gray-400 shadow-sm">
                                        <tr>
                                            <th className="py-3.5 px-5">Status / ID</th>
                                            <th className="py-3.5 px-5">Tomador (Cliente)</th>
                                            <th className="py-3.5 px-5">Emissão / Autorização</th>
                                            <th className="py-3.5 px-5">Valor & Nº Nota</th>
                                            <th className="py-3.5 px-5 text-right">Documentos</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                                        {results.map((nota: any) => {
                                            const s = String(nota.situacao || '').toUpperCase();
                                            const isSuccess = ['CONCLUIDO', 'AUTORIZADO', 'AUTORIZADA', 'ISSUED', 'EMITIDA'].includes(s);
                                            const isPending = ['PROCESSANDO', 'EM_PROCESSAMENTO'].includes(s);

                                            return (
                                                <tr key={nota.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition-colors">
                                                    <td className="py-4 px-5">
                                                        <div className="flex flex-col items-start gap-1">
                                                            {isSuccess ? (
                                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-1">
                                                                    <CheckCircle2 size={11} /> Autorizada
                                                                </span>
                                                            ) : isPending ? (
                                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 flex items-center gap-1">
                                                                    <Clock3 size={11} className="animate-spin" /> Processando
                                                                </span>
                                                            ) : (
                                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 flex items-center gap-1">
                                                                    <XCircle size={11} /> Rejeitada
                                                                </span>
                                                            )}
                                                            <span className="font-mono text-[9px] text-gray-400 mt-0.5" title={nota.id}>
                                                                ID: {nota.id?.substring(0, 14)}...
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-5 max-w-xs">
                                                        <div className="font-bold text-gray-900 dark:text-white text-sm truncate" title={nota.tomador}>
                                                            {nota.tomador}
                                                        </div>
                                                        {nota.tomadorDoc && (
                                                            <div className="text-xs font-mono text-gray-400 mt-0.5">
                                                                {nota.tomadorDoc}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-5">
                                                        <div className="flex flex-col gap-0.5 text-xs">
                                                            <span className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                                                <Calendar size={12} className="text-blue-500" />
                                                                {nota.emissao}
                                                            </span>
                                                            {nota.autorizacao && (
                                                                <span className="text-[11px] font-semibold text-gray-400 flex items-center gap-1">
                                                                    <Clock3 size={11} />
                                                                    {nota.autorizacao}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-5">
                                                        <div className="flex flex-col items-start gap-1">
                                                            <span className="font-black text-gray-900 dark:text-white text-sm">
                                                                {formatCurrency(nota.valorServico || 0)}
                                                            </span>
                                                            {nota.numeroNfse && (
                                                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/30">
                                                                    Nº {nota.numeroNfse}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-5 text-right">
                                                        <div className="flex justify-end items-center gap-2">
                                                            {nota.pdf ? (
                                                                <a
                                                                    href={nota.pdf}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                                                                    title="Visualizar ou Baixar PDF da Nota Fiscal"
                                                                >
                                                                    <FileText size={14} /> PDF
                                                                </a>
                                                            ) : (
                                                                <span className="text-[10px] text-gray-400 italic">Sem PDF</span>
                                                            )}
                                                            {nota.xml && (
                                                                <a
                                                                    href={nota.xml}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-800/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                                                                    title="Visualizar ou Baixar XML da Nota Fiscal"
                                                                >
                                                                    <FileCode size={14} /> XML
                                                                </a>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
