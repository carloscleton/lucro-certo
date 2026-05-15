import { CheckCircle2, AlertCircle, Info, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { clsx } from 'clsx';

interface ResultModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'info' | 'warning';
    data?: Record<string, any>;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export function ResultModal({ isOpen, onClose, title, message, type = 'info', data, action }: ResultModalProps) {
    if (!isOpen) return null;

    const icons = {
        success: <CheckCircle2 className="text-emerald-500" size={32} />,
        error: <AlertCircle className="text-rose-500" size={32} />,
        warning: <AlertCircle className="text-amber-500" size={32} />,
        info: <Info className="text-blue-500" size={32} />
    };

    const bgColors = {
        success: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30',
        error: 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-900/30',
        warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30',
        info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30'
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
                <div className="p-6 text-center">
                    <div className="flex justify-center mb-4">
                        <div className={clsx("p-4 rounded-2xl", bgColors[type])}>
                            {icons[type]}
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{message}</p>

                    {data && Object.keys(data).length > 0 && (
                        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-4 mb-6 text-left border border-gray-100 dark:border-slate-800 max-h-60 overflow-y-auto">
                            <div className="space-y-3">
                                {Object.entries(data).map(([key, value]) => (
                                    <div key={key} className="flex flex-col gap-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{key}</span>
                                        <div className="text-sm font-medium text-gray-900 dark:text-white break-all">
                                            {typeof value === 'object' ? (
                                                <pre className="whitespace-pre-wrap font-mono text-[11px] bg-white/50 dark:bg-black/20 p-2 rounded">
                                                    {JSON.stringify(value, null, 2)}
                                                </pre>
                                            ) : String(value).startsWith('http') ? (
                                                <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                                                    {String(value)}
                                                    <ChevronRight size={14} />
                                                </a>
                                            ) : String(value)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        {/* Atalhos para PDF/XML se encontrados no objeto data (recursivo simples) */}
                        {(() => {
                            const findDocument = (obj: any, format: 'pdf' | 'xml'): string | null => {
                                if (!obj || typeof obj !== 'object') return null;
                                
                                // 1. Tentar busca por chave exata (prioridade)
                                if (obj[format] && typeof obj[format] === 'string' && obj[format].startsWith('http')) {
                                    return obj[format];
                                }

                                // 2. Tentar busca por chaves comuns
                                const commonKeys = format === 'pdf' 
                                    ? ['pdf', 'pdfUrl', 'caminhoPdf', 'urlPdf', 'danfse', 'danfe'] 
                                    : ['xml', 'xmlUrl', 'caminhoXml', 'urlXml', 'arquivoXml'];
                                
                                for (const key of commonKeys) {
                                    if (obj[key] && typeof obj[key] === 'string' && obj[key].startsWith('http')) {
                                        return obj[key];
                                    }
                                }

                                // 3. Varredura recursiva de valores
                                for (const k in obj) {
                                    const val = obj[k];
                                    const isTecnoSpeed = typeof val === 'string' && val.includes('plugnotas.com.br');
                                    const isInternal = typeof val === 'string' && val.includes('/fiscal-module/');
                                    
                                    if (typeof val === 'string' && (isTecnoSpeed || isInternal)) {
                                        if (format === 'pdf' && (val.toLowerCase().includes('pdf') || val.toLowerCase().includes('impressao'))) return val;
                                        if (format === 'xml' && val.toLowerCase().includes('xml')) return val;
                                    }

                                    if (typeof val === 'object') {
                                        const found = findDocument(val, format);
                                        if (found) return found;
                                    }
                                }
                                return null;
                            };

                            const pdfUrl = findDocument(data, 'pdf');
                            const xmlUrl = findDocument(data, 'xml');

                            return (
                                <div className="space-y-2 w-full">
                                    {pdfUrl && (
                                        <Button 
                                            onClick={() => window.open(pdfUrl, '_blank')} 
                                            className="w-full h-12 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                                        >
                                            <ChevronRight size={18} className="rotate-[-90deg]" />
                                            Visualizar PDF da Nota
                                        </Button>
                                    )}
                                    {xmlUrl && (
                                        <Button 
                                            variant="outline"
                                            onClick={() => window.open(xmlUrl, '_blank')} 
                                            className="w-full h-12 rounded-xl text-sm font-bold border-gray-200 dark:border-slate-700 flex items-center justify-center gap-2 text-gray-700 dark:text-gray-300"
                                        >
                                            <ChevronRight size={18} className="rotate-90" />
                                            Baixar XML
                                        </Button>
                                    )}
                                </div>
                            );
                        })()}

                        {action && (
                            <Button onClick={action.onClick} className="w-full h-12 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20">
                                {action.label}
                                <ChevronRight size={18} className="ml-2" />
                            </Button>
                        )}
                        <Button variant="ghost" onClick={onClose} className="w-full h-12 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800">
                            Fechar
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
