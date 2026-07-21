import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { MessageSquare, Copy, Check, Send } from 'lucide-react';

interface ShareWhatsAppModalProps {
    isOpen: boolean;
    onClose: () => void;
    referralLink: string;
}

export function ShareWhatsAppModal({ isOpen, onClose, referralLink }: ShareWhatsAppModalProps) {
    const [phone, setPhone] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState(0);
    const [messageText, setMessageText] = useState('');
    const [copied, setCopied] = useState(false);

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

    // Atualiza o texto da mensagem quando o template ou o link mudar
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

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Remove caracteres não numéricos do telefone
        const cleanPhone = phone.replace(/\D/g, '');
        const formattedPhone = cleanPhone ? (cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`) : '';

        const encodedText = encodeURIComponent(messageText);
        const url = formattedPhone 
            ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
            : `https://api.whatsapp.com/send?text=${encodedText}`;
        
        window.open(url, '_blank');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Compartilhar pelo WhatsApp" icon={MessageSquare}>
            <form onSubmit={handleSend} className="space-y-4 pt-2">
                <p className="text-xs text-gray-500 leading-relaxed">
                    Escolha um modelo de mensagem abaixo, customize se desejar e envie diretamente para seus contatos!
                </p>

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

                {/* Telefone opcional */}
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Telefone do Destinatário (Opcional)</label>
                    <input
                        type="text"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="Ex: (84) 99999-9999 (deixe em branco para escolher no WhatsApp)"
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
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-md shadow-emerald-500/10">
                        <Send size={14} />
                        Enviar no WhatsApp
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
