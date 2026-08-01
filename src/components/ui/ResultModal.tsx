import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, ChevronRight, Eye, X, ExternalLink, Search, RefreshCw, Plus, Clock3, Minus, Printer, Code, FileText } from 'lucide-react';
import { Button } from './Button';
import { clsx } from 'clsx';
import { PDFService } from '../../services/pdfService';

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

const humanizeFiscalError = (title: string, message: string, data?: any) => {
    let friendlyTitle = title;
    let friendlyMessage = message;
    let friendlyHint: string | null = null;
    let errorCode: string | null = null;

    // Detecta mensagens genéricas do Axios/Express
    const isGenericMsg = 
        !friendlyMessage ||
        friendlyMessage === 'Erro no Teste' || 
        friendlyMessage === 'Erro interno no servidor proxy' || 
        friendlyMessage === 'Erro retornado pelo Portal Nacional (ADN gov.br)' ||
        friendlyMessage.includes('Request failed with status code') ||
        friendlyMessage.includes('status code 400') ||
        friendlyMessage.includes('status code 500');

    if (data) {
        let realMessage = '';

        // Tenta extrair de data.detail (pode ser JSON serializado da prefeitura)
        if (data.detail && typeof data.detail === 'string') {
            try {
                const parsed = JSON.parse(data.detail);
                if (parsed?.erros && Array.isArray(parsed.erros) && parsed.erros.length > 0) {
                    realMessage = parsed.erros.map((e: any) => `[${e.Codigo || e.codigo || 'ERRO'}] ${e.Descricao || e.descricao || ''}`).join(' | ');
                } else if (parsed?.mensagem || parsed?.message) {
                    realMessage = parsed.mensagem || parsed.message;
                }
            } catch (e) {
                if (!data.detail.includes('Erro interno no servidor proxy')) {
                    realMessage = data.detail;
                }
            }
        }

        if (!realMessage && data.erros && Array.isArray(data.erros) && data.erros.length > 0) {
            realMessage = data.erros.map((e: any) => `[${e.Codigo || e.codigo || 'ERRO'}] ${e.Descricao || e.descricao || ''}`).join(' | ');
        }

        if (!realMessage && data.error && typeof data.error === 'string' && !data.error.includes('Erro interno no servidor proxy')) {
            realMessage = data.error;
        }

        if (!realMessage && data.message && typeof data.message === 'string' && !data.message.includes('Request failed with status code')) {
            realMessage = data.message;
        }

        if (realMessage) {
            if (isGenericMsg) {
                friendlyMessage = realMessage;
            }
        }
    }

    const fullStr = (friendlyMessage + ' ' + JSON.stringify(data || {})).toLowerCase();

    if (fullStr.includes('e0014') || fullStr.includes('já existe em uma nfs-e') || fullStr.includes('conjunto de série')) {
        errorCode = 'E0014';
        friendlyTitle = '📍 Nota / DPS Já Emitida no Portal Nacional';
        friendlyMessage = 'Esta Nota Fiscal / DPS (Série 1, Número 1) já foi transmitida e AUTORIZADA com sucesso anteriormente no Portal Nacional da NFS-e.';
        friendlyHint = '💡 Como testar um novo envio: Clique no botão "Gerar Exemplo" no topo para preencher dados de uma nota inédita e clique em "Emitir Via JSON Manual" novamente.';
    } else if (fullStr.includes('e0160') || fullStr.includes('simples nacional')) {
        errorCode = 'E0160';
        friendlyTitle = '⚠️ Opção do Simples Nacional em Desacordo';
        friendlyMessage = 'O regime tributário informado na nota (opSimpNac) não coincide com o cadastro real do CNPJ na Receita Federal.';
        friendlyHint = '💡 Solução: Verifique se sua empresa é Simples Nacional ME/EPP (opSimpNac = 3), MEI (opSimpNac = 2) ou Regime Normal (opSimpNac = 1).';
    } else if (fullStr.includes('e0166') || fullStr.includes('regime de apuração')) {
        errorCode = 'E0166';
        friendlyTitle = '⚠️ Regime de Apuração do Simples Obrigatório';
        friendlyMessage = 'Para empresas do Simples Nacional ME/EPP, é obrigatório informar o Regime de Apuração (regApTribSN).';
        friendlyHint = '💡 Solução: Inclua "regApTribSN": 1 no bloco regTrib do prestador no JSON.';
    } else if (fullStr.includes('e0718') || fullStr.includes('assinatura deve ser feita com o certificado')) {
        errorCode = 'E0718';
        friendlyTitle = '🔐 Incompatibilidade no Certificado Digital';
        friendlyMessage = 'O CNPJ do prestador informado na nota difere do CNPJ do titular do Certificado Digital .pfx enviado.';
        friendlyHint = '💡 Solução: Certifique-se de que o CNPJ no JSON é idêntico ao CNPJ do titular do arquivo .pfx de certificado A1.';
    } else if (fullStr.includes('e0120') || fullStr.includes('inscrição municipal')) {
        errorCode = 'E0120';
        friendlyTitle = '🏛️ Inscrição Municipal Incompatível';
        friendlyMessage = 'A Inscrição Municipal informada possui formato diferente do cadastrado na prefeitura.';
        friendlyHint = '💡 Solução: Mantenha o campo de Inscrição Municipal em branco ou preencha com o número oficial da prefeitura.';
    } else if (fullStr.includes('certificado digital não encontrado')) {
        friendlyTitle = '📜 Certificado Digital A1 Não Anexado';
        friendlyMessage = 'Não encontramos o arquivo do Certificado Digital (.pfx) para o Portal Nacional da NFS-e.';
        friendlyHint = '💡 Solução: Na aba "Portal Nacional (ADN gov.br)", faça o upload do seu arquivo de certificado .pfx, digite a senha e clique em "Salvar Configurações".';
    } else if (fullStr.includes('erro interno no servidor proxy') || fullStr.includes('econnrefused') || isGenericMsg) {
        friendlyTitle = '⚠️ Falha na Comunicação com o Servidor Fiscal';
        if (friendlyMessage.includes('Request failed with status code') || friendlyMessage === 'Erro interno no servidor proxy') {
            friendlyMessage = 'O servidor fiscal não conseguiu processar a requisição ou conectar ao Portal Nacional da NFS-e.';
        }
        friendlyHint = '💡 Dica: Verifique se o Certificado Digital A1 (.pfx) e a Senha foram informados e salvos corretamente nas configurações da empresa.';
    }

    return { friendlyTitle, friendlyMessage, friendlyHint, errorCode };
};
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
    const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
    const [showTechDetails, setShowTechDetails] = useState(false);

    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 20, 200));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 20, 60));
    const handleResetZoom = () => setZoomLevel(100);

    const rawDocPdf = findDocument(data, 'pdf');
    const isGovUrl = typeof rawDocPdf === 'string' && (rawDocPdf.includes('nfse.gov.br') || rawDocPdf.includes('consulta.aspx'));
    const activePdfUrl = generatedPdfUrl || (!isGovUrl ? rawDocPdf : null);

    const handlePrintPdf = () => {
        if (!activePdfUrl) return;
        
        const iframe = document.querySelector('iframe[title="Visualizador de PDF"]') as HTMLIFrameElement;
        if (iframe && iframe.contentWindow) {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                return;
            } catch (e) {
                console.warn('Erro ao imprimir iframe direto (possível CORS):', e);
            }
        }
        
        if (activePdfUrl.startsWith('blob:')) {
            const a = document.createElement('a');
            a.href = activePdfUrl;
            a.download = `danfse-${data?.nNFSe || data?.nDPS || 'nota'}.pdf`;
            a.click();
        }
    };

    useEffect(() => {
        if (isOpen && data) {
            setShowPdf(false);
            setShowXml(false);
            setXmlContent(null);
            setShowTechDetails(false);
            setGeneratedPdfUrl(null);

            // Gera e abre o DANFSE PDF no modal automaticamente para qualquer resposta com dados
            setTimeout(() => {
                handleOpenDanfsePdf();
            }, 50);
        }
    }, [isOpen, data]);
    
    if (!isOpen) return null;

    const { friendlyTitle, friendlyMessage, friendlyHint, errorCode } = humanizeFiscalError(title, message, data);
    
    const xmlUrl = findDocument(data, 'xml');

    const handleOpenDanfsePdf = async () => {
        let url = generatedPdfUrl;
        if (!url && data) {
            try {
                let parsedDetail: any = {};
                if (typeof data.detail === 'string') {
                    try { parsedDetail = JSON.parse(data.detail); } catch (e) {}
                }

                const inf = data.payload?.infDPS || data.infDPS || data.payload_enviado?.infDPS || parsedDetail?.infDPS || data.payload || {};
                const prest = inf.prest || data.prestador || parsedDetail?.prestador || {};
                const toma = inf.toma || data.tomador || parsedDetail?.tomador || {};
                const serv = inf.serv || data.servico || (Array.isArray(data.servico) ? data.servico[0] : {});
                const val = inf.valores || data.valores || parsedDetail?.valores || {};

                const cTribNac = serv.cServ?.cTribNac || serv.cTribNac || serv.codigo || '010701';
                const descServ = serv.cServ?.xDescServ || serv.xDescServ || serv.descricao || serv.discriminacao || 'Análise e desenvolvimento de sistemas';
                const valServ = Number(val.vServPrest?.vServ || val.vServ || serv.valor?.servico || data.valor || 100);

                const idDPSFromDetail = parsedDetail?.idDPS || data.idDPS || data.chNFSe || data.chaveAcesso;
                let nDPSComputed = inf.nDPS || data.nDPS;
                if (!nDPSComputed && idDPSFromDetail) {
                    const matchNDps = String(idDPSFromDetail).match(/\d{15}$/);
                    if (matchNDps) nDPSComputed = String(parseInt(matchNDps[0], 10));
                }

                const pdfBlob = await PDFService.generateDanfsePDF({
                    nNfse: data.nNFSe || nDPSComputed || '1',
                    serie: inf.serie || data.serie || '1',
                    nDPS: nDPSComputed || '1',
                    chaveAcesso: idDPSFromDetail || '240810220089356600019000001000000000000001',
                    dhEmi: inf.dhEmi || data.dhEmi || new Date().toISOString(),
                    prestador: {
                        cnpj: prest.CNPJ || prest.cnpj || prest.cpfCnpj || '00.893.566/0001-90',
                        nome: prest.xNome || prest.nome || prest.razaoSocial || 'CARLOSCLETON CARVALHO FERNANDES',
                        im: prest.IM || prest.im || prest.inscricaoMunicipal || 'Isento',
                    },
                    tomador: {
                        doc: toma.CNPJ || toma.CPF || toma.doc || toma.cpfCnpj || '11.222.333/0001-81',
                        nome: toma.xNome || toma.nome || toma.razaoSocial || 'EMPRESA DE TESTE LTDA',
                        email: toma.email || 'teste@nfe.io'
                    },
                    servico: {
                        cTribNac,
                        descricao: descServ,
                        valor: valServ
                    },
                    impostos: {
                        issqn: Number(val.trib?.tribMun?.vISSQN || 0),
                        pis: Number(val.trib?.tribFed?.vPIS || 0),
                        cofins: Number(val.trib?.tribFed?.vCOFINS || 0),
                        ibs: Number(val.trib?.reformaTributaria?.vIBS || 0),
                        cbs: Number(val.trib?.reformaTributaria?.vCBS || 0)
                    },
                    ambiente: (data.tipoAmbiente === 1 || inf.tpAmb === 1) ? 'producao' : 'homologacao'
                });
                const newUrl = window.URL.createObjectURL(pdfBlob);
                setGeneratedPdfUrl(newUrl);
                url = newUrl;
            } catch (err) {
                console.error('Erro ao gerar DANFSE em PDF:', err);
            }
        }

        setShowXml(false);
        setShowPdf(true);
    };

    const handleViewXml = async () => {
        setShowPdf(false);
        setShowXml(true);
        if (data?.xml_assinado) {
            setXmlContent(formatXml(String(data.xml_assinado)));
            return;
        }
        if (!xmlUrl) return;
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

    const hasXmlOrPdf = !!(activePdfUrl || data?.pdf || data?.pdf_url || data?.xml_assinado || data?.payload || data?.infDPS || xmlUrl || data?.payload_enviado || data?.chNFSe || data?.idDPS || data?.detail);

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className={clsx(
                "bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-300 transition-all",
                (showPdf || showXml) ? "w-full max-w-5xl h-[90vh]" : "w-full max-w-md"
            )}>
                <div className={clsx(
                    "flex flex-col h-full transition-all duration-300",
                    (showPdf || showXml) ? "p-0" : "p-8"
                )}>
                    {showPdf || showXml ? (
                        <div className="flex flex-col h-full">
                            <div className="flex justify-between items-center bg-gray-50/80 dark:bg-slate-800/80 p-4 border-b border-gray-100 dark:border-slate-800 backdrop-blur-md">
                                <div className="flex items-center gap-2">
                                    <div className={clsx(
                                        "p-2 rounded-lg",
                                        showPdf ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600" : "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                                    )}>
                                        {showPdf ? <Eye size={20} /> : <Search size={20} />}
                                    </div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">
                                        {showPdf ? 'Visualizador da Nota (DANFSE PDF)' : 'Visualizador do Conteúdo (XML)'}
                                    </h3>
                                </div>
                                <div className="flex items-center gap-1">
                                    {showPdf && activePdfUrl && (
                                        <button 
                                            onClick={handlePrintPdf}
                                            className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-1.5 text-xs font-bold mr-1"
                                            title="Imprimir Nota"
                                        >
                                            <Printer size={20} />
                                            <span className="hidden sm:inline">Imprimir / Salvar PDF</span>
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => { setShowPdf(false); setShowXml(false); }}
                                        className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-gray-500 hover:text-gray-900 dark:hover:text-white"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-slate-950">
                                {showPdf ? (
                                    activePdfUrl ? (
                                        <div className="relative group h-full">
                                            {/* Toolbar de Zoom */}
                                            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 p-1.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-slate-700 shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300">
                                                <button 
                                                    onClick={handleZoomOut}
                                                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                                    title="Diminuir Zoom"
                                                >
                                                    <Minus size={16} />
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
                                            <div className="w-full h-full overflow-hidden">
                                                <div 
                                                    className="w-full h-full transition-transform duration-300 ease-out origin-top"
                                                    style={{ transform: `scale(${zoomLevel / 100})` }}
                                                >
                                                    <iframe 
                                                        src={`${activePdfUrl}#toolbar=0&navpanes=0&scrollbar=0`} 
                                                        className="w-full h-full border-none"
                                                        title="Visualizador de PDF"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-slate-900/50">
                                            <div className="p-4 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full mb-4 animate-pulse">
                                                <Clock3 size={32} />
                                            </div>
                                            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                                Gerando Visualização PDF
                                            </h4>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">
                                                Aguarde um instante enquanto preparamos a exibição do documento DANFSE.
                                            </p>
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
                            {errorCode && (
                                <div className="flex justify-center mb-1">
                                    <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 rounded-full border border-rose-200 dark:border-rose-800/40">
                                        Código: {errorCode}
                                    </span>
                                </div>
                            )}
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{friendlyTitle}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 font-medium leading-relaxed">{friendlyMessage}</p>

                            {/* Card de Dica / Solução Humanizada */}
                            {friendlyHint && (
                                <div className="mb-5 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl text-left shadow-sm">
                                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 leading-relaxed">
                                        {friendlyHint}
                                    </p>
                                </div>
                            )}

                            {/* Botão de Toggle para ver Detalhes Técnicos / JSON */}
                            {data && Object.keys(data).length > 0 && (
                                <div className="mb-4 text-left">
                                    <button
                                        type="button"
                                        onClick={() => setShowTechDetails(!showTechDetails)}
                                        className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1.5 transition-colors py-1"
                                    >
                                        <Code size={14} />
                                        {showTechDetails ? 'Ocultar Detalhes Técnicos (JSON)' : 'Ver Detalhes Técnicos (JSON)'}
                                    </button>

                                    {showTechDetails && (
                                        <div className="mt-2 bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-4 text-left border border-gray-100 dark:border-slate-800 max-h-52 overflow-y-auto scrollbar-thin animate-in fade-in duration-200">
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
                                </div>
                            )}

                            <div className="mt-auto flex flex-col gap-3">
                                <div className="space-y-2">
                                    {hasXmlOrPdf && (
                                        <Button 
                                            onClick={handleOpenDanfsePdf} 
                                            className="w-full h-12 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                                        >
                                            <FileText size={18} />
                                            Visualizar PDF (DANFSE)
                                        </Button>
                                    )}
                                    {(xmlUrl || data?.xml || data?.xml_url || data?.xml_assinado) && (
                                        <Button 
                                            onClick={handleViewXml} 
                                            className="w-full h-12 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                                        >
                                            <Search size={18} />
                                            Visualizar XML Assinado
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
