import { useState } from 'react';
import { Search, AlertCircle, RefreshCw, X, Download, FileCode } from 'lucide-react';
import { Button } from '../ui/Button';
import { fiscalService } from '../../services/fiscalService';
import { supabase } from '../../lib/supabase';
import { Tooltip } from '../ui/Tooltip';
import { clsx } from 'clsx';

interface ConsultaNotasModalProps {
    onClose: () => void;
    companyId: string;
}

export function ConsultaNotasModal({ onClose, companyId }: ConsultaNotasModalProps) {
    const [dataInicial, setDataInicial] = useState('');
    const [dataFinal, setDataFinal] = useState('');
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
            
            const response = await fiscalService.consultarNotasPorPeriodo(companyId, dataInicial, dataFinal, tipo, token);
            
            if (response?.message && response.message.includes('Não implementado')) {
                setError('A consulta por período não está disponível no ambiente de Sandbox da Tecnospeed para este tipo de nota.');
                return;
            }

            const notasArray = response?.notas || (Array.isArray(response) ? response : []);
            setResults(notasArray);
            
            if (notasArray.length === 0) {
                setError('Nenhuma nota encontrada no período especificado.');
            }
        } catch (err: any) {
            console.error('Erro ao consultar notas:', err);
            setError(err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Erro ao consultar notas.');
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
