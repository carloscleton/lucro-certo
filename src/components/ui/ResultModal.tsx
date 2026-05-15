import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, ChevronRight, Eye, X, ExternalLink, Search, RefreshCw, Plus } from 'lucide-react';
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
const findDocument = (obj: any, format: 'pdf' | 'xml'): string | null => {
    if (!obj || typeof obj !== 'object') return null;
    
    // 1. Tenta campos diretos (prioridade absoluta - http ou blob)
    const candidates = [
        obj[`${format}_url`], 
        obj[format]?.url, 
        obj[format], 
        obj[`url_${format}`], 
        obj[`url${format.charAt(0).toUpperCase() + format.slice(1)}`]
    ];

    for (const cand of candidates) {
        if (typeof cand === 'string' && (cand.startsWith('http') || cand.startsWith('blob:'))) return cand;
        if (typeof cand === 'object' && cand !== null && typeof cand.url === 'string' && (cand.url.startsWith('http') || cand.url.startsWith('blob:'))) return cand.url;
    }

    // 2. Busca exaustiva em todas as chaves (http ou blob)
    for (const k in obj) {
        const val = obj[k];
        
        if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('blob:'))) {
            const low = val.toLowerCase();
            if (format === 'pdf' && (low.includes('pdf') || low.includes('impressao') || low.includes('danfe') || low.endsWith('.pdf'))) return val;
            if (format === 'xml' && (low.includes('xml') || low.includes('arquivo') || low.endsWith('.xml'))) return val;
        }
        
        if (typeof val === 'object' && val !== null) {
            const found = findDocument(val, format);
            if (found) return found;
        }
    }
    return null;
};

const formatXml = (xml: string) => {
    let formatted = '';
    let indent = '';
    const tab = '    ';
    xml.split(/>\s*</).forEach((node) => {
        if (node.match(/^\/\w/)) indent = indent.substring(tab.length);
        formatted += indent + '<' + node + '>\r\n';
        if (node.match(/^<?\w[^>]*[^\/]$/)) indent += tab;
    });
    return formatted.substring(1, formatted.length - 3);
};

export function ResultModal({ isOpen, onClose, title, message, type = 'info', data, action }: ResultModalProps) {
    const [showPdf, setShowPdf] = useState(false);
    const [showXml, setShowXml] = useState(false);
    const [xmlContent, setXmlContent] = useState<string | null>(null);
    const [loadingXml, setLoadingXml] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(100);

    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 20, 200));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 20, 60));
    const handleResetZoom = () => setZoomLevel(100);



    useEffect(() => {
        if (isOpen && data) {
            const realPdfUrl = findDocument(data, 'pdf');
            
            // Só ativa visualização automática se for um link real (http/blob)
            setShowPdf(!!realPdfUrl);
            setShowXml(false);
            setXmlContent(null);
        }
    }, [isOpen, data]);
    
    if (!isOpen) return null;
    
    const pdfUrl = findDocument(data, 'pdf');
    const xmlUrl = findDocument(data, 'xml');
    const handleViewXml = async () => {
        if (!xmlUrl) return;
        setShowPdf(false);
        setShowXml(true);
        if (!xmlContent) {
            setLoadingXml(true);
            try {
                const res = await fetch(xmlUrl);
                const text = await res.text();
                setXmlContent(formatXml(text));
            } catch (e) {
                setXmlContent('Erro ao carregar conteúdo do XML.');
            } finally {
                setLoadingXml(false);
            }
        }
    };

    const handleClose = () => {
        setShowPdf(false);
        setShowXml(false);
        onClose();
    };

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
            <div className={clsx(
                "bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-300 transition-all",
                (showPdf || showXml) ? "w-full max-w-5xl h-[90vh]" : "w-full max-w-md"
            )}>
                <div className="p-6 flex flex-col h-full">
                    {showPdf || showXml ? (
                        <div className="flex flex-col h-full gap-4">
                            <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-gray-100 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                    <div className={clsx(
                                        "p-2 rounded-lg",
                                        showPdf ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600" : "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                                    )}>
                                        {showPdf ? <Eye size={20} /> : <Search size={20} />}
                                    </div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">
                                        {showPdf ? 'Visualizador da Nota (PDF)' : 'Visualizador do Conteúdo (XML)'}
                                    </h3>
                                </div>
                                <button 
                                    onClick={() => { setShowPdf(false); setShowXml(false); }}
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-gray-500"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto bg-gray-100 dark:bg-slate-950 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-inner">
                                {showPdf ? (
                                    pdfUrl ? (
                                        <div className="relative group p-4">
                                            {/* Toolbar de Zoom */}
                                            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 p-1.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-slate-700 shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300">
                                                <button 
                                                    onClick={handleZoomOut}
                                                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                                    title="Diminuir Zoom"
                                                >
                                                    <X size={16} className="rotate-45" />
                                                </button>
                                                <div className="h-4 w-[1px] bg-gray-200 dark:bg-slate-700 mx-1" />
                                                <button 
                                                    onClick={handleResetZoom}
                                                    className="px-3 py-1 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                                >
                                                    {zoomLevel}%
                                                </button>
                                                <div className="h-4 w-[1px] bg-gray-200 dark:bg-slate-700 mx-1" />
                                                <button 
                                                    onClick={handleZoomIn}
                                                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                                    title="Aumentar Zoom"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                            <div className="w-full h-[600px] overflow-hidden">
                                                <div 
                                                    className="w-full h-full transition-transform duration-300 ease-out origin-top"
                                                    style={{ transform: `scale(${zoomLevel / 100})` }}
                                                >
                                                    <iframe 
                                                        src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`} 
                                                        className="w-full h-full border-none"
                                                        title="Visualizador de PDF"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                            PDF não disponível para visualização interna
                                        </div>
                                    )
                                ) : (
                                    <div className="w-full h-full p-6 overflow-auto scrollbar-thin">
                                        {loadingXml ? (
                                            <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-blue-500">
                                                <RefreshCw size={32} className="animate-spin" />
                                                <span className="text-sm font-medium">Carregando XML...</span>
                                            </div>
                                        ) : (
                                            <pre className="text-[11px] font-mono text-gray-700 dark:text-slate-300 whitespace-pre-wrap break-all bg-white dark:bg-black/20 p-4 rounded-xl">
                                                {xmlContent}
                                            </pre>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center flex flex-col h-full">
                            <div className="flex justify-center mb-4">
                                <div className={clsx("p-4 rounded-2xl", bgColors[type])}>
                                    {icons[type]}
                                </div>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{message}</p>

                            {data && Object.keys(data).length > 0 && (
                                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-4 mb-6 text-left border border-gray-100 dark:border-slate-800 max-h-60 overflow-y-auto scrollbar-thin">
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
                                                            <ExternalLink size={14} />
                                                        </a>
                                                    ) : String(value)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mt-auto flex flex-col gap-3">
                                <div className="space-y-2">
                                    {(pdfUrl || data?.pdf || data?.pdf_url) && (
                                        <Button 
                                            onClick={() => setShowPdf(true)} 
                                            className="w-full h-12 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                                        >
                                            <Eye size={18} />
                                            Visualizar PDF Aqui
                                        </Button>
                                    )}
                                    {(xmlUrl || data?.xml || data?.xml_url) && (
                                        <Button 
                                            onClick={handleViewXml} 
                                            className="w-full h-12 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                                        >
                                            <Search size={18} />
                                            Visualizar XML
                                        </Button>
                                    )}
                                </div>

                                {action && (
                                    <Button onClick={action.onClick} className="w-full h-12 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20">
                                        {action.label}
                                        <ChevronRight size={18} className="ml-2" />
                                    </Button>
                                )}
                                <Button 
                                    variant="ghost" 
                                    onClick={handleClose} 
                                    className="w-full h-12 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"
                                >
                                    Fechar
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
