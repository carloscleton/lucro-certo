import { useState, useRef, useEffect } from 'react';
import { HelpCircle, PlayCircle, BookOpen, MessageCircle, X, Send, User, Bot, ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { useWebhooks } from '../../hooks/useWebhooks';
import { supabase } from '../../lib/supabase';

export function HelpCenter() {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<'main' | 'chat'>('main');
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
    const [isSending, setIsSending] = useState(false);
    const { webhooks } = useWebhooks();
    const scrollRef = useRef<HTMLDivElement>(null);

    const guides = [
        {
            title: 'Primeiros Passos',
            icon: PlayCircle,
            description: 'Aprenda o básico do Lucro Certo.',
            link: '#',
        },
        {
            title: 'Fluxo de Caixa',
            icon: DollarSignIcon,
            description: 'Como organizar suas entradas e saídas.',
            link: '#',
        },
        {
            title: 'Gerindo Clientes',
            icon: BookOpen,
            description: 'Cadastro e gestão de pacientes/clientes.',
            link: '#',
        },
    ];

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isSending]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!message.trim() || isSending) return;

        const userMsg = message.trim();
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setMessage('');
        setIsSending(true);

        try {
            // Find the webhook configured for generic or support requests
            const supportWebhook = webhooks?.find(w => w.events.includes('SUPPORT_REQUEST') || w.events.includes('GENERIC_EVENT'));

            if (!supportWebhook) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    text: 'Ops! O suporte via IA ainda não foi configurado. Por favor, configure um Webhook com o evento "Suporte do Sistema" nas configurações.'
                }]);
                return;
            }

            // Using Supabase Edge Function to avoid CORS issues and use service role if needed
            const { data, error } = await supabase.functions.invoke('execute-webhook', {
                body: {
                    webhookId: supportWebhook.id,
                    eventType: 'SUPPORT_REQUEST',
                    payload: {
                        message: userMsg,
                        timestamp: new Date().toISOString(),
                    }
                }
            });

            if (error) throw error;

            // The Edge Function returns { success, statusCode, response, error }
            // where 'response' is the raw body from n8n
            let reply = 'Entendido! Como posso ajudar mais?';

            if (data && data.response) {
                const rawResponse = data.response;

                // Try to parse the inner response if it's a string containing JSON
                try {
                    const parsed = typeof rawResponse === 'string' ? JSON.parse(rawResponse) : rawResponse;

                    // Handle array response (common in n8n)
                    const content = Array.isArray(parsed) ? parsed[0] : parsed;

                    if (content && typeof content === 'object') {
                        reply = content.output || content.response || content.text || content.message || JSON.stringify(content);
                    } else {
                        reply = String(content);
                    }
                } catch {
                    // If not JSON, use the raw response string
                    reply = rawResponse;
                }
            } else if (data && !data.success && data.error) {
                throw new Error(data.error);
            }

            setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
        } catch (error: any) {
            console.error('Chat Error Details:', {
                message: error.message,
                status: error.status,
                context: error.context
            });

            const errorMessage = error.message?.includes('functions_http_error')
                ? 'O servidor de IA está offline ou a URL do Webhook está incorreta.'
                : 'Desculpe, tive um problema ao conectar com o serviço de IA. Verifique se o Webhook está ativo.';

            setMessages(prev => [...prev, { role: 'assistant', text: errorMessage }]);
        } finally {
            setIsSending(false);
        }
    };

    const handleClearChat = () => {
        if (confirm('Deseja limpar o histórico desta conversa?')) {
            setMessages([]);
        }
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
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 w-80 md:w-96 overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col max-h-[600px]">
                    <div className="p-4 bg-blue-600 text-white flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            {view === 'chat' && (
                                <button onClick={() => setView('main')} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                                    <ArrowLeft size={18} />
                                </button>
                            )}
                            <HelpCircle size={20} />
                            <span className="font-bold">{view === 'main' ? 'Central de Ajuda' : 'Assistente IA'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {view === 'chat' && messages.length > 0 && (
                                <button
                                    onClick={handleClearChat}
                                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                                    title="Limpar conversa"
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                            <button onClick={() => setIsOpen(false)} className="hover:rotate-90 transition-transform">
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {view === 'main' ? (
                            <div className="p-4 space-y-4">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Precisa de ajuda? Escolha um dos guias rápidos abaixo ou tire suas dúvidas com nossa IA.
                                </p>

                                <div className="space-y-2">
                                    {guides.map((guide, index) => (
                                        <a
                                            key={index}
                                            href={guide.link}
                                            className="flex items-start gap-3 p-3 rounded-xl border border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all group"
                                        >
                                            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                                <guide.icon size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-gray-900 dark:text-white">{guide.title}</h4>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{guide.description}</p>
                                            </div>
                                        </a>
                                    ))}
                                </div>

                                <div className="space-y-2 pt-2">
                                    <Button
                                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700"
                                        onClick={() => setView('chat')}
                                    >
                                        <Bot size={18} />
                                        Tirar dúvidas com IA
                                    </Button>

                                    <Button
                                        className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700"
                                        onClick={() => window.open('https://wa.me/5584998071213?text=Olá,%20preciso%20de%20ajuda%20com%20o%20Lucro%20Certo.', '_blank')}
                                    >
                                        <MessageCircle size={18} />
                                        Falar com Suporte (Zap)
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full min-h-[400px]">
                                <div ref={scrollRef} className="flex-1 p-4 space-y-4 overflow-y-auto">
                                    {messages.length === 0 && (
                                        <div className="text-center py-8 space-y-2">
                                            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Bot size={24} />
                                            </div>
                                            <h3 className="font-bold text-gray-900 dark:text-white">Olá! Eu sou o Assistente do Lucro Certo.</h3>
                                            <p className="text-xs text-gray-500">Como posso ajudar na sua gestão hoje? Pergunte qualquer coisa!</p>
                                        </div>
                                    )}
                                    {messages.map((msg, i) => (
                                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.role === 'user'
                                                ? 'bg-blue-600 text-white rounded-tr-none'
                                                : 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white rounded-tl-none border border-gray-200 dark:border-slate-600'
                                                }`}>
                                                <div className="flex items-center gap-1.5 mb-1 opacity-70 text-[10px] uppercase font-bold tracking-wider">
                                                    {msg.role === 'user' ? <User size={10} /> : <Bot size={10} />}
                                                    {msg.role === 'user' ? 'Você' : 'Assistente IA'}
                                                </div>
                                                <p className="whitespace-pre-wrap">{msg.text}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {isSending && (
                                        <div className="flex justify-start">
                                            <div className="bg-gray-100 dark:bg-slate-700 p-3 rounded-2xl rounded-tl-none border border-gray-200 dark:border-slate-600">
                                                <Loader2 size={18} className="animate-spin text-blue-600" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <form onSubmit={handleSendMessage} className="p-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-100 dark:border-slate-700 shrink-0">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={message}
                                            onChange={e => setMessage(e.target.value)}
                                            placeholder="Digite sua dúvida aqui..."
                                            className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2 pr-10 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!message.trim() || isSending}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 hover:scale-110 disabled:opacity-30 disabled:scale-100 transition-all p-1"
                                        >
                                            <Send size={18} />
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-slate-900 text-center border-t border-gray-100 dark:border-slate-700 shrink-0">
                        <button
                            onClick={() => {
                                localStorage.removeItem('lucro_certo_onboarding_seen');
                                window.location.reload();
                            }}
                            className="text-xs text-blue-600 hover:underline"
                        >
                            Reiniciar Tour de Boas-vindas
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-14 h-14 rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700 hover:scale-110 active:scale-95 transition-all flex items-center justify-center group"
                    title="Ajuda"
                >
                    <HelpCircle size={28} className="group-hover:rotate-12 transition-transform" />
                </button>
            )}
        </div>
    );
}
