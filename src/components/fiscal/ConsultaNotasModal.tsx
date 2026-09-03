import { useState } from 'react';
import { Search, AlertCircle, RefreshCw, X, Download, FileCode, CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { fiscalService } from '../../services/fiscalService';
import { supabase } from '../../lib/supabase';
import { Tooltip } from '../ui/Tooltip';
import { clsx } from 'clsx';
import { API_BASE_URL } from '../../lib/constants';

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
                                        'Cliente Cadastrado / Consumidor Final';

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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] flex flex-col rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
                
                {/* Header */}
                <div className="flex items-center justify-between p-6 md:p-8 border-b border-gray-100 dark:border-slate-800">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl">
                            <Search size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Consulta de Notas</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Consulte notas fiscais na TecnoSpeed / Plugnotas por período.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    <div className="flex flex-col md:flex-row gap-4 mb-8">
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1.5">Tipo de Nota</label>
                            <select 
                                value={tipo} 
                                onChange={(e: any) => setTipo(e.target.value)}
                                className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="nfse">NFS-e (Serviço)</option>
                                <option value="nfe">NF-e (Produto)</option>
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1.5">Data Inicial</label>
                            <input 
                                type="date" 
                                value={dataInicial} 
                                onChange={(e) => setDataInicial(e.target.value)}
                                className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1.5">Data Final</label>
                            <input 
                                type="date" 
                                value={dataFinal} 
                                onChange={(e) => setDataFinal(e.target.value)}
                                className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex items-end">
                            <Button 
                                variant="primary" 
                                onClick={handleConsultar} 
                                isLoading={isConsulting}
                                className="h-12 bg-blue-600 hover:bg-blue-700 font-bold px-8 w-full md:w-auto"
                            >
                                {isConsulting ? <RefreshCw className="animate-spin mr-2" size={18} /> : <Search size={18} className="mr-2" />}
                                Buscar Notas
                            </Button>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl flex gap-3 text-rose-600 dark:text-rose-400 text-sm">
                            <AlertCircle size={20} className="shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    {results.length > 0 && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                                    <thead>
                                        <tr className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
                                            <th className="py-4 px-6 font-bold text-[10px] uppercase tracking-widest text-gray-400">ID / Status</th>
                                            <th className="py-4 px-6 font-bold text-[10px] uppercase tracking-widest text-gray-400">Tomador</th>
                                            <th className="py-4 px-6 font-bold text-[10px] uppercase tracking-widest text-gray-400">Emissão / Autorização</th>
                                            <th className="py-4 px-6 font-bold text-[10px] uppercase tracking-widest text-gray-400">Valor / Número</th>
                                            <th className="py-4 px-6 text-right font-bold text-[10px] uppercase tracking-widest text-gray-400">Links</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                                        {results.map((nota: any) => (
                                            <tr key={nota.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="py-4 px-6">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-mono text-[10px] text-gray-500 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded truncate max-w-[120px]" title={nota.id}>
                                                            {nota.id?.substring(0, 8)}...
                                                        </span>
                                                        <span className={clsx(
                                                            "text-[10px] font-bold uppercase tracking-widest",
                                                            nota.situacao === 'CONCLUIDO' ? 'text-emerald-500' : 'text-blue-500'
                                                        )}>
                                                            {nota.situacao || 'DESCONHECIDO'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="font-medium text-gray-900 dark:text-white truncate max-w-[150px]" title={nota.tomador}>
                                                        CNPJ/CPF: {nota.tomador}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="flex flex-col text-xs text-gray-500">
                                                        <span>Emissão: {nota.emissao}</span>
                                                        {nota.autorizacao && <span>Aut: {nota.autorizacao}</span>}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-gray-900 dark:text-white">
                                                            {nota.valorServico ? `R$ ${nota.valorServico.toFixed(2)}` : 'N/A'}
                                                        </span>
                                                        {nota.numeroNfse && (
                                                            <span className="text-[10px] text-gray-400 font-medium mt-0.5">
                                                                Nº {nota.numeroNfse}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6 text-right">
                                                    <div className="flex justify-end items-center gap-2">
                                                        {nota.pdf && (
                                                            <Tooltip content="Ver PDF">
                                                                <button
                                                                    onClick={() => window.open(nota.pdf, '_blank')}
                                                                    className="h-8 w-8 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                                                                >
                                                                    <Download size={16} />
                                                                </button>
                                                            </Tooltip>
                                                        )}
                                                        {nota.xml && (
                                                            <Tooltip content="Ver XML">
                                                                <button
                                                                    onClick={() => window.open(nota.xml, '_blank')}
                                                                    className="h-8 w-8 flex items-center justify-center text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition-colors"
                                                                >
                                                                    <FileCode size={16} />
                                                                </button>
                                                            </Tooltip>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
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
