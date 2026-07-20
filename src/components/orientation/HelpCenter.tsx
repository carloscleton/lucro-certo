import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
    HelpCircle, 
    PlayCircle, 
    BookOpen, 
    MessageCircle, 
    X, 
    Send, 
    User, 
    Bot, 
    ArrowLeft, 
    Loader2, 
    Trash2, 
    Rocket,
    RotateCcw,
    ChevronRight,
    Sparkles,
    ExternalLink
} from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { Button } from '../ui/Button';
import { useWebhooks } from '../../hooks/useWebhooks';
import { supabase } from '../../lib/supabase';
import { findKnowledgeAnswer } from '../../utils/aiAssistantKnowledge';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    actionLabel?: string;
    actionPath?: string;
    timestamp: string;
}

export function HelpCenter() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<'main' | 'chat'>('main');
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isSending, setIsSending] = useState(false);
    const [protocolNumber, setProtocolNumber] = useState<string>('');
    const { webhooks } = useWebhooks();
    const scrollRef = useRef<HTMLDivElement>(null);

    // Generate session protocol on mount or load
    useEffect(() => {
        const savedProtocol = localStorage.getItem('lucro_certo_chat_protocol');
        if (savedProtocol) {
            setProtocolNumber(savedProtocol);
        } else {
            const today = new Date();
            const yearStr = today.getFullYear().toString();
            const monthStr = String(today.getMonth() + 1).padStart(2, '0');
            const dayStr = String(today.getDate()).padStart(2, '0');
            const randomCode = Math.floor(1000 + Math.random() * 9000).toString();
            const generated = `${yearStr}${monthStr}${dayStr}-${randomCode}`;
            setProtocolNumber(generated);
            localStorage.setItem('lucro_certo_chat_protocol', generated);
        }

        // Restore chat messages if available
        const savedMessages = localStorage.getItem('lucro_certo_chat_messages');
        if (savedMessages) {
            try {
                setMessages(JSON.parse(savedMessages));
            } catch {
                // ignore
            }
        }
    }, []);

    // Auto-scroll on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
        if (messages.length > 0) {
            localStorage.setItem('lucro_certo_chat_messages', JSON.stringify(messages));
        }
    }, [messages, isSending]);

    const guides = [
        {
            title: t('help_center.guide_start'),
            icon: PlayCircle,
            description: t('help_center.guide_start_desc'),
            onClick: () => {
                localStorage.removeItem('lucro_certo_onboarding_seen');
                window.location.reload();
            },
        },
        {
            title: t('help_center.guide_cashflow'),
            icon: DollarSignIcon,
            description: t('help_center.guide_cashflow_desc'),
            onClick: () => {
                navigate('/dashboard/receivables');
                setIsOpen(false);
            },
        },
        {
            title: t('help_center.guide_crm'),
            icon: BookOpen,
            description: t('help_center.guide_crm_desc'),
            onClick: () => {
                navigate('/dashboard/crm');
                setIsOpen(false);
            },
        },
        {
            title: t('help_center.guide_sales'),
            icon: Rocket,
            description: t('help_center.guide_sales_desc'),
            onClick: () => {
                navigate('/dashboard/quotes');
                setIsOpen(false);
            },
        },
    ];

    const quickChips = [
        { label: '📄 Emitir Nota Fiscal', query: 'como emitir nota fiscal' },
        { label: '🔄 Faturamento Recorrente', query: 'como funciona faturamento recorrente' },
        { label: '💳 Configurar Asaas', query: 'como configurar gateway asaas' },
        { label: '📊 Fluxo de Caixa / DRE', query: 'como funciona o fluxo de caixa' },
        { label: '👥 Cadastrar Contato', query: 'como cadastrar contato cliente fornecedor' },
        { label: '💬 Falar com Atendente (Zap)', isZap: true }
    ];

    const processUserMessage = async (queryText: string) => {
        if (!queryText.trim() || isSending) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            text: queryText.trim(),
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, userMsg]);
        setMessage('');
        setIsSending(true);

        try {
            // Check for Webhook integration (n8n or Supabase Function)
            const supportWebhook = webhooks?.find(w => w.events.includes('SUPPORT_REQUEST') || w.events.includes('GENERIC_EVENT'));

            if (supportWebhook) {
                const { data } = await supabase.functions.invoke('execute-webhook', {
                    body: {
                        webhookId: supportWebhook.id,
                        eventType: 'SUPPORT_REQUEST',
                        payload: {
                            message: queryText.trim(),
                            protocol: protocolNumber,
                            timestamp: new Date().toISOString(),
                        }
                    }
                });

                if (data && data.response) {
                    let reply = '';
                    const rawResponse = data.response;
                    try {
                        const parsed = typeof rawResponse === 'string' ? JSON.parse(rawResponse) : rawResponse;
                        const content = Array.isArray(parsed) ? parsed[0] : parsed;
                        reply = content?.output || content?.response || content?.text || content?.message || JSON.stringify(content);
                    } catch {
                        reply = String(rawResponse);
                    }

                    if (reply) {
                        setMessages(prev => [...prev, {
                            id: (Date.now() + 1).toString(),
                            role: 'assistant',
                            text: reply,
                            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        }]);
                        setIsSending(false);
                        return;
                    }
                }
            }

            // Fallback to Knowledge Engine
            const knowledgeMatch = findKnowledgeAnswer(queryText);

            if (knowledgeMatch) {
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    text: knowledgeMatch.answer,
                    actionLabel: knowledgeMatch.actionLabel,
                    actionPath: knowledgeMatch.actionPath,
                    timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                }]);
            } else {
                // Generic Help Assistant Reply
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    text: `Entendi sua dúvida! Posso te orientar sobre **Emissão de Notas Fiscais**, **Faturamento Recorrente**, **Configuração do Asaas**, **Fluxo de Caixa** ou **Propostas / CRM**.

Clique em uma das sugestões abaixo ou fale diretamente com um especialista da nossa equipe no WhatsApp!`,
                    timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                }]);
            }
        } catch (error: any) {
            console.error('Chat error:', error);
            const knowledgeMatch = findKnowledgeAnswer(queryText);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: knowledgeMatch ? knowledgeMatch.answer : 'Desculpe, tive uma oscilação na conexão. Como posso te orientar sobre os módulos do Lucro Certo?',
                actionLabel: knowledgeMatch?.actionLabel,
                actionPath: knowledgeMatch?.actionPath,
                timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            }]);
        } finally {
            setIsSending(false);
        }
    };

    const handleSendMessage = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        processUserMessage(message);
    };

    const handleClearChat = () => {
        if (confirm('Deseja realmente limpar o histórico da conversa?')) {
            setMessages([]);
            localStorage.removeItem('lucro_certo_chat_messages');
        }
    };

    const handleReloadPrevious = () => {
        const savedMessages = localStorage.getItem('lucro_certo_chat_messages');
        if (savedMessages) {
            try {
                setMessages(JSON.parse(savedMessages));
            } catch {
                // ignore
            }
        }
    };

    const openWhatsAppSupport = () => {
        const text = encodeURIComponent(`Olá! Preciso de ajuda no Lucro Certo.\nProtocolo: ${protocolNumber}`);
        window.open(`https://wa.me/5584998071213?text=${text}`, '_blank');
    };

    function DollarSignIcon(props: any) {
        return (
            <svg
                {...props}
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <line x1="12" x2="12" y1="2" y2="22" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 z-[9999]">
            {isOpen ? (
                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-700/80 w-80 sm:w-96 overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col h-[580px] max-h-[90vh]">
                    
                    {/* Header estilo Atendimento TIM (Imagem 1) */}
                    <div className="p-4 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white flex items-center justify-between shrink-0 shadow-md">
                        <div className="flex items-center gap-3">
                            {view === 'chat' && (
                                <button 
                                    onClick={() => setView('main')} 
                                    className="p-1 hover:bg-white/20 rounded-xl transition-colors"
                                    title="Voltar ao Menu"
                                >
                                    <ArrowLeft size={18} />
                                </button>
                            )}
                            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-white shadow-inner">
                                <Bot size={20} />
                            </div>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-extrabold text-sm tracking-tight">Atendimento IA</span>
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                </div>
                                <span className="text-[10px] text-blue-100 font-mono">
                                    Protocolo: {protocolNumber}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            {view === 'chat' && messages.length > 0 && (
                                <Tooltip content="Limpar conversa">
                                    <button
                                        onClick={handleClearChat}
                                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-blue-100"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </Tooltip>
                            )}
                            <button 
                                onClick={() => setIsOpen(false)} 
                                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-blue-100 hover:rotate-90 duration-200"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50 flex flex-col">
                        {view === 'main' ? (
                            <div className="p-4 space-y-4">
                                <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 rounded-2xl">
                                    <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 leading-relaxed">
                                        {t('help_center.main_desc')}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    {guides.map((guide, index) => (
                                        <button
                                            key={index}
                                            onClick={guide.onClick}
                                            className="w-full flex items-center justify-between text-left gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700/60 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all group"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                                    <guide.icon size={18} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">{guide.title}</h4>
                                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{guide.description}</p>
                                                </div>
                                            </div>
                                            <ChevronRight size={16} className="text-gray-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-2 pt-2">
                                    <Button
                                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-3 shadow-lg shadow-blue-500/20 font-bold text-xs"
                                        onClick={() => setView('chat')}
                                    >
                                        <Sparkles size={16} />
                                        {t('help_center.ask_ia')}
                                    </Button>

                                    <Button
                                        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-2.5 shadow-md shadow-emerald-500/20 font-bold text-xs"
                                        onClick={openWhatsAppSupport}
                                    >
                                        <MessageCircle size={16} />
                                        {t('help_center.talk_support')}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full justify-between">
                                {/* Botão Carregar conversa anterior estilo Imagem 1 */}
                                <div className="p-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/60 flex justify-center shrink-0">
                                    <button
                                        type="button"
                                        onClick={handleReloadPrevious}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 rounded-full text-[11px] font-bold border border-gray-200 dark:border-slate-600 shadow-sm transition-all"
                                    >
                                        <RotateCcw size={12} /> Carregar conversa anterior
                                    </button>
                                </div>

                                {/* Chat Body */}
                                <div ref={scrollRef} className="flex-1 p-4 space-y-4 overflow-y-auto">
                                    
                                    {/* Welcome Card estilo Imagem 1 (TIM) */}
                                    <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm space-y-3">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
                                                <Bot size={18} />
                                            </div>
                                            <div className="text-xs text-gray-700 dark:text-gray-200 space-y-2">
                                                <p>
                                                    Olá! Eu sou a <strong>IA Lucro Certo</strong>, sua assistente virtual de gestão financeira e fiscal. 💙
                                                </p>
                                                <div className="p-2 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-800 text-[11px] font-mono text-gray-600 dark:text-gray-300">
                                                    O número de protocolo deste atendimento é:<br />
                                                    <strong className="text-blue-600 dark:text-blue-400">{protocolNumber}</strong>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Suggestion Chips */}
                                    {messages.length === 0 && (
                                        <div className="space-y-1.5 pt-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Perguntas Frequentes</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {quickChips.map((chip, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => {
                                                            if (chip.isZap) {
                                                                openWhatsAppSupport();
                                                            } else if (chip.query) {
                                                                processUserMessage(chip.query);
                                                            }
                                                        }}
                                                        className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-300 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-xl border border-gray-200 dark:border-slate-700/80 shadow-2xs transition-all text-left"
                                                    >
                                                        {chip.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Conversation Messages */}
                                    {messages.map((msg) => (
                                        <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                            <div className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                                                msg.role === 'user'
                                                    ? 'bg-blue-600 text-white rounded-tr-none shadow-md'
                                                    : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 rounded-tl-none border border-gray-100 dark:border-slate-700 shadow-sm'
                                            }`}>
                                                <div className="flex items-center justify-between gap-2 mb-1.5 opacity-70 text-[9px] uppercase font-bold tracking-wider">
                                                    <span className="flex items-center gap-1">
                                                        {msg.role === 'user' ? <User size={10} /> : <Bot size={10} />}
                                                        {msg.role === 'user' ? t('help_center.you') : 'IA Lucro Certo'}
                                                    </span>
                                                    <span>{msg.timestamp}</span>
                                                </div>
                                                <p className="whitespace-pre-wrap">{msg.text}</p>

                                                {/* Action Button inside Bot Message */}
                                                {msg.actionPath && msg.actionLabel && (
                                                    <div className="mt-3 pt-2 border-t border-gray-100 dark:border-slate-700/60">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                navigate(msg.actionPath!);
                                                                setIsOpen(false);
                                                            }}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-xl text-xs font-bold transition-all"
                                                        >
                                                            <ExternalLink size={12} />
                                                            {msg.actionLabel}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {isSending && (
                                        <div className="flex justify-start">
                                            <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-gray-100 dark:border-slate-700 shadow-sm flex items-center gap-2 text-xs text-gray-500">
                                                <Loader2 size={16} className="animate-spin text-blue-600" />
                                                <span>Pesquisando resposta...</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Form Footer */}
                                <form onSubmit={handleSendMessage} className="p-3 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 shrink-0">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={message}
                                            onChange={e => setMessage(e.target.value)}
                                            placeholder="Digite sua dúvida aqui..."
                                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700/80 rounded-2xl px-4 py-2.5 pr-10 text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!message.trim() || isSending}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 hover:scale-110 disabled:opacity-30 disabled:scale-100 transition-all p-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                        >
                                            <Send size={16} />
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <Tooltip content={t('common.help_label') || 'Ajuda'} position="left">
                    <button
                        onClick={() => setIsOpen(true)}
                        className="w-14 h-14 rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700 hover:scale-110 active:scale-95 transition-all flex items-center justify-center group"
                    >
                        <HelpCircle size={28} className="group-hover:rotate-12 transition-transform" />
                    </button>
                </Tooltip>
            )}
        </div>
    );
}
