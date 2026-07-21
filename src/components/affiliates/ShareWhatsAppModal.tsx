import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useEntity } from '../../context/EntityContext';
import { useNotification } from '../../context/NotificationContext';
import { supabase, withRetry } from '../../lib/supabase';
import { whatsappService } from '../../services/whatsappService';
import { MessageSquare, Copy, Check, Send, AlertTriangle, Loader2 } from 'lucide-react';

interface ShareWhatsAppModalProps {
    isOpen: boolean;
    onClose: () => void;
    referralLink: string;
}

export function ShareWhatsAppModal({ isOpen, onClose, referralLink }: ShareWhatsAppModalProps) {
    const { user } = useAuth();
    const { currentEntity } = useEntity();
    const { notify } = useNotification();

    const [phone, setPhone] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState(0);
    const [messageText, setMessageText] = useState('');
    const [copied, setCopied] = useState(false);
    const [sending, setSending] = useState(false);

    // States for WhatsApp instance detection
    const [activeInstance, setActiveInstance] = useState<any | null>(null);
    const [checkingInstances, setCheckingInstances] = useState(true);

    const templates = [
        {
            title: '🚀 Profissional e Completo',
            text: `Olá! Quero te indicar o *Lucro Certo*, o sistema de gestão financeira que uso e recomendo para empresas. Ele controla contas a pagar/receber, fluxo de caixa, CRM e emite notas fiscais automaticamente!\n\nFaça um teste gratuito por este link exclusivo:\n🔗 ${referralLink}`
        },
        {
            title: '🎁 Recomendação de Amigo',
            text: `Oi! Tudo bem? Estou usando o *Lucro Certo* para organizar o financeiro da minha empresa e achei sensacional. Acho que vai te ajudar muito a controlar o caixa e emitir Notas Fiscais com facilidade.\n\nDá uma olhada no site oficial e faz um teste grátis:\n🔗 ${referralLink}`
        },
        {
            title: '⚡ Direto e Rápido',
            text: `Recomendo o *Lucro Certo* para a gestão financeira e Notas Fiscais da sua empresa. Link para cadastro gratuito:\n🔗 ${referralLink}`
        }
    ];

    // Detect active instance on open
    useEffect(() => {
        if (!isOpen) return;
        const checkWhatsAppInstances = async () => {
            setCheckingInstances(true);
            try {
                let query = supabase.from('instances').select('*');
                if (currentEntity.type === 'company' && currentEntity.id) {
                    query = query.eq('company_id', currentEntity.id);
                } else {
                    query = query.eq('user_id', user?.id).is('company_id', null);
                }
                const { data } = await withRetry(() => query);
                
                // Find first connected instance that is active
                const connected = data?.find((inst: any) => inst.status === 'connected' && inst.is_active !== false);
                setActiveInstance(connected || null);
            } catch (err) {
                console.error('Error checking instances:', err);
            } finally {
                setCheckingInstances(false);
            }
        };
        checkWhatsAppInstances();
    }, [isOpen, currentEntity.id, user?.id]);

    // Update message text on template or link change
    useEffect(() => {
        if (templates[selectedTemplate]) {
            setMessageText(templates[selectedTemplate].text);
        }
    }, [selectedTemplate, referralLink]);

    const handleCopyText = () => {
        navigator.clipboard.writeText(messageText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Remove non-numeric characters from phone
        const cleanPhone = phone.replace(/\D/g, '');

        if (activeInstance) {
            // Direct sending requires a phone number
            if (!cleanPhone || cleanPhone.length < 10) {
                notify('warning', 'Por favor, informe o telefone do destinatário com DDD para envio automático.', 'Telefone Obrigatório');
                return;
            }

            setSending(true);
            try {
                notify('info', 'Enviando indicação em segundo plano...', 'Enviando');
                await whatsappService.sendMessage({
                    instanceName: activeInstance.instance_name,
                    number: cleanPhone,
                    text: messageText,
                    companyId: currentEntity.type === 'company' ? currentEntity.id : undefined,
                    token: activeInstance.evolution_instance_id
                });
                notify('success', 'Indicação enviada com sucesso!', 'Sucesso');
                onClose();
            } catch (error: any) {
                console.error('Failed to send auto message:', error);
                notify('error', `Falha ao enviar mensagem: ${error.message || 'Erro na API'}`, 'Erro de Envio');
            } finally {
                setSending(false);
            }
        } else {
            // Fallback manual send
            const formattedPhone = cleanPhone ? (cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`) : '';
            const encodedText = encodeURIComponent(messageText);
            const url = formattedPhone 
                ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
                : `https://api.whatsapp.com/send?text=${encodedText}`;
            
            window.open(url, '_blank');
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Compartilhar pelo WhatsApp" icon={MessageSquare}>
            <form onSubmit={handleSend} className="space-y-4 pt-2">
                
                {/* Instance connection status feedback */}
                {checkingInstances ? (
                    <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl text-xs text-gray-500 font-medium border border-gray-150">
                        <Loader2 className="animate-spin text-blue-500" size={14} />
                        <span>Verificando instância do WhatsApp...</span>
                    </div>
                ) : activeInstance ? (
                    <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/40 rounded-xl space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            Instância ativa conectada: "{activeInstance.instance_name}"
                        </div>
                        <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                            A indicação será disparada automaticamente em segundo plano por sua conta conectada.
                        </p>
                    </div>
                ) : (
                    <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-150 dark:border-amber-900/40 rounded-xl space-y-2">
                        <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300 font-bold">
                            <AlertTriangle className="shrink-0 text-amber-600 dark:text-amber-400" size={16} />
                            <span>Nenhum WhatsApp Conectado</span>
                        </div>
                        <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                            Você não possui instâncias de WhatsApp conectadas no painel. O envio será feito abrindo o WhatsApp Web. 
                            Se preferir enviar 100% automático, configure uma conta no menu lateral em <strong>WhatsApp (Uso)</strong>.
                        </p>
                    </div>
                )}

                {/* Seletor de Modelo */}
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Modelo da Mensagem</label>
                    <div className="grid grid-cols-1 gap-2">
                        {templates.map((tpl, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedTemplate(idx)}
                                className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                                    selectedTemplate === idx
                                        ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200 font-bold'
                                        : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                {tpl.title}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Telefone opcional / obrigatorio */}
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                        Telefone do Destinatário {activeInstance ? <span className="text-rose-500 font-bold">*</span> : <span className="text-gray-400 font-normal">(Opcional)</span>}
                    </label>
                    <input
                        type="text"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        required={!!activeInstance}
                        placeholder={activeInstance ? "Ex: (84) 99999-9999 (Obrigatório para envio automático)" : "Ex: (84) 99999-9999 (Opcional)"}
                        className="w-full bg-gray-50 dark:bg-slate-850 border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Preview e Edição da Mensagem */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Editar Texto de Envio</label>
                        <button
                            type="button"
                            onClick={handleCopyText}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                            {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                            {copied ? 'Copiado!' : 'Copiar Texto'}
                        </button>
                    </div>
                    <textarea
                        value={messageText}
                        onChange={e => setMessageText(e.target.value)}
                        rows={6}
                        className="w-full bg-gray-50 dark:bg-slate-850 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-sans resize-none"
                    />
                </div>

                {/* Ações */}
                <div className="flex items-center justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={onClose} disabled={sending}>
                        Cancelar
                    </Button>
                    <Button 
                        type="submit" 
                        disabled={sending || checkingInstances}
                        className={`font-bold flex items-center gap-1.5 shadow-md ${
                            activeInstance 
                                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/10' 
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/10'
                        }`}
                    >
                        {sending ? (
                            <>
                                <Loader2 className="animate-spin" size={14} />
                                Enviando...
                            </>
                        ) : (
                            <>
                                <Send size={14} />
                                {activeInstance ? 'Enviar Automaticamente' : 'Enviar pelo WhatsApp Web'}
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
