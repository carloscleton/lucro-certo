import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X, Layout, Zap, Upload, RefreshCw, Wand2, Copy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { storageService } from '../../lib/storageService';
import { API_BASE_URL } from '../../lib/constants';

const getWhatsAppNumber = (url: string) => {
    if (!url) return '';
    const match = url.match(/(?:wa\.me\/|phone=)(\d+)/);
    if (match && match[1]) {
        return match[1];
    }
    const clean = url.replace(/[+\s-]/g, '');
    if (/^\d+$/.test(clean) && clean.length >= 8) {
        return clean;
    }
    return '';
};

const formatWhatsAppMask = (raw: string) => {
    let digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    
    // If digits doesn't start with '55', prepend it automatically
    if (digits.length > 0 && !digits.startsWith('55')) {
        if (digits[0] !== '5') {
            digits = '55' + digits;
        } else if (digits.length >= 2 && digits[1] !== '5') {
            digits = '55' + digits.substring(1);
        }
    }
    
    // Format: 55(84) 9 9807-1213
    if (digits.length <= 2) {
        return digits; // "55"
    }
    if (digits.length <= 4) {
        return `55(${digits.substring(2, 4)}`;
    }
    if (digits.length <= 5) {
        return `55(${digits.substring(2, 4)}) ${digits.substring(4, 5)}`;
    }
    if (digits.length <= 9) {
        return `55(${digits.substring(2, 4)}) ${digits.substring(4, 5)} ${digits.substring(5)}`;
    }
    const truncated = digits.substring(0, 13);
    return `55(${truncated.substring(2, 4)}) ${truncated.substring(4, 5)} ${truncated.substring(5, 9)}-${truncated.substring(9)}`;
};

export const CampaignsManager = ({ localBanner, setLocalBanner, notify, handleSaveSettings }: any) => {
    const campaigns = (localBanner?.campaigns || []).map((c: any) => ({
        ...c,
        whatsapp: c.whatsapp !== undefined ? c.whatsapp : getWhatsAppNumber(c.link || ''),
        email: c.email !== undefined ? c.email : '',
        webhook: c.webhook !== undefined ? c.webhook : ''
    }));
    
    React.useEffect(() => {
        // Migração transparente do banner antigo para o novo formato de campanhas (se houver banner antigo e a lista de campanhas estiver vazia)
        if (campaigns.length === 0 && localBanner && (localBanner.title || localBanner.subtitle) && !localBanner.migrated) {
            const newCampaign = {
                id: crypto.randomUUID(),
                title: localBanner.title || '',
                subtitle: localBanner.subtitle || '',
                call_to_action: localBanner.call_to_action || '',
                link: localBanner.link || '',
                whatsapp: getWhatsAppNumber(localBanner.link || ''),
                email: '',
                webhook: '',
                type: localBanner.type || 'promo',
                price: localBanner.price || '',
                image_url: localBanner.image_url || '',
                show_in_popup: localBanner.enabled || false,
                show_in_hero: localBanner.enabled || false,
                show_as_section: localBanner.enabled || false,
                is_active: localBanner.enabled || false,
            };
            setLocalBanner({ ...localBanner, campaigns: [newCampaign], migrated: true });
        }
    }, [campaigns.length, localBanner, setLocalBanner]);

    const [editingCampaign, setEditingCampaign] = useState<any | null>(null);
    const [isNewCampaign, setIsNewCampaign] = useState(false);
    const [uploadingField, setUploadingField] = useState<string | null>(null);
    const [isGeneratingText, setIsGeneratingText] = useState(false);
    const [isTestingWebhook, setIsTestingWebhook] = useState(false);

    const handleTestWebhook = async () => {
        if (!editingCampaign?.webhook) return;
        setIsTestingWebhook(true);
        try {
            const testPayload = {
                event: 'webhook_test',
                timestamp: new Date().toISOString(),
                lead: {
                    name: 'CLIENTE TESTE WEBHOOK',
                    phone: '5584998071213',
                    email: 'TESTE@LUCROCERTO.COM'
                },
                campaign: {
                    id: editingCampaign.id,
                    title: (editingCampaign.title || 'CAMPANHA TESTE').toUpperCase(),
                    subtitle: (editingCampaign.subtitle || 'SUBTÍTULO TESTE').toUpperCase(),
                    type: editingCampaign.type || 'promo',
                    price: editingCampaign.price || 'R$ 100'
                }
            };

            const base = API_BASE_URL.replace(/\/$/, '');
            const response = await fetch(`${base}/api/public/campaign-webhook`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    webhook_url: editingCampaign.webhook.trim(),
                    payload: testPayload
                })
            });

            if (response.ok) {
                notify('success', 'Webhook testado com sucesso! Verifique o recebimento.');
            } else {
                const errData = await response.json().catch(() => ({}));
                notify('error', `Erro ao testar: ${errData.message || 'Código ' + response.status}`);
            }
        } catch (err: any) {
            console.error("Erro no teste de webhook:", err);
            notify('error', `Falha ao testar webhook: ${err.message || 'Erro de conexão.'}`);
        } finally {
            setIsTestingWebhook(false);
        }
    };

    const handleAdd = () => {
        const newCampaign = {
            id: crypto.randomUUID(),
            title: '',
            subtitle: '',
            call_to_action: '',
            link: '',
            whatsapp: '',
            email: '',
            webhook: '',
            type: 'promo',
            price: '',
            image_url: '',
            show_in_popup: true,
            show_in_hero: false,
            show_as_section: true,
            is_active: true
        };
        setEditingCampaign(newCampaign);
        setIsNewCampaign(true);
    };

    const handleUpdate = (id: string, updates: any) => {
        const newCampaigns = campaigns.map((c: any) => c.id === id ? { ...c, ...updates } : c);
        setLocalBanner({ ...localBanner, campaigns: newCampaigns });
    };

    const handleDraftUpdate = (updates: any) => {
        if (!editingCampaign) return;
        setEditingCampaign((prev: any) => ({ ...prev, ...updates }));
    };

    const handleConfirmEdit = () => {
        if (!editingCampaign) return;
        
        let newCampaigns;
        if (isNewCampaign) {
            newCampaigns = [...campaigns, editingCampaign];
        } else {
            newCampaigns = campaigns.map((c: any) => c.id === editingCampaign.id ? editingCampaign : c);
        }
        
        setLocalBanner({ ...localBanner, campaigns: newCampaigns });
        setEditingCampaign(null);
        setIsNewCampaign(false);
        notify('success', isNewCampaign ? 'Nova campanha adicionada! Não se esqueça de salvar as alterações do site.' : 'Alterações salvas no rascunho local!');
    };

    const handleDelete = (id: string) => {
        if (!confirm('Deseja realmente excluir esta campanha?')) return;
        const newCampaigns = campaigns.filter((c: any) => c.id !== id);
        setLocalBanner({ ...localBanner, campaigns: newCampaigns });
    };

    const handleClone = (id: string) => {
        const campaignToClone = campaigns.find((c: any) => c.id === id);
        if (!campaignToClone) return;
        const clonedCampaign = {
            ...campaignToClone,
            id: crypto.randomUUID(),
            title: campaignToClone.title ? `${campaignToClone.title} (CÓPIA)` : 'CÓPIA',
            is_active: false
        };
        setEditingCampaign(clonedCampaign);
        setIsNewCampaign(true);
        notify('success', 'Campanha clonada! Ajuste os detalhes no modal e clique em Confirmar.');
    };

    const toggleStatus = (id: string, currentStatus: boolean) => {
        handleUpdate(id, { is_active: !currentStatus });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploadingField(field);
            const fileExt = file.name.split('.').pop();
            const fileName = `landing_banners/banner_${field}_${Date.now()}.${fileExt}`;
            const { publicUrl } = await storageService.upload(file, 'social_media_assets', fileName);
            handleDraftUpdate({ [field]: publicUrl });
            notify('success', 'Imagem enviada com sucesso!');
        } catch (error) {
            console.error('Upload error:', error);
            notify('error', 'Erro ao enviar imagem.');
        } finally {
            setUploadingField(null);
        }
    };

    const handleMagicText = async () => {
        if (!editingCampaign) return;
        const textToOrganize = editingCampaign.subtitle || editingCampaign.title;
        if (!textToOrganize) {
            notify('error', 'Digite algum texto para a IA organizar.');
            return;
        }
        setIsGeneratingText(true);
        try {
            const { data, error } = await supabase.functions.invoke('lead-radar-magic', {
                body: {
                    input: `Atue como um copywriter profissional. Resuma, formate com emojis adequados e torne o texto persuasivo para o subtítulo de um banner de landing page. Texto: ${textToOrganize}`,
                    mode: 'field_only'
                }
            });
            if (error) throw error;
            if (data?.text) {
                handleDraftUpdate({ subtitle: data.text });
                notify('success', 'Texto gerado com sucesso!');
            }
        } catch (error) {
            console.error('Magic error:', error);
            notify('error', 'Erro ao gerar texto.');
        } finally {
            setIsGeneratingText(false);
        }
    };

    return (
        <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                        <Zap size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">Gerenciador de Campanhas</h3>
                        <p className="text-xs text-gray-500">Crie pop-ups e seções dinâmicas na sua Landing Page</p>
                    </div>
                </div>
                <button
                    onClick={handleAdd}
                    className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-bold transition-colors"
                >
                    <Plus size={16} /> Nova Campanha
                </button>
            </div>

            <div className="space-y-4">
                {campaigns.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 dark:bg-slate-900 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">
                        Nenhuma campanha ativa. Clique em "Nova Campanha" para começar.
                    </div>
                ) : (
                    campaigns.map((campaign: any) => (
                        <div key={campaign.id} className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                            {/* Cabecalho do Item */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/50">
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => toggleStatus(campaign.id, campaign.is_active)}
                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${campaign.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                    >
                                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${campaign.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                                        {campaign.title || 'Campanha sem título'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => handleClone(campaign.id)}
                                        className="p-1.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                        title="Clonar Campanha"
                                    >
                                        <Copy size={18} />
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setEditingCampaign({ ...campaign });
                                            setIsNewCampaign(false);
                                        }}
                                        className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                        title="Editar Campanha"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(campaign.id)}
                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
            
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-700">
                <button
                    onClick={() => handleSaveSettings({ landing_banner: localBanner })}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 transition-colors"
                >
                    <Save size={18} />
                    Salvar Alterações do Site
                </button>
            </div>

            {/* Modal de Edição/Criação de Campanha */}
            {editingCampaign && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                                {isNewCampaign ? 'Nova Campanha' : 'Editar Campanha'}
                            </h3>
                            <button 
                                onClick={() => { setEditingCampaign(null); setIsNewCampaign(false); }} 
                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4 flex-grow overflow-y-auto">
                            {/* Onde exibir */}
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl">
                                <h4 className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-3 uppercase flex items-center gap-2">
                                    <Layout size={14}/> Onde exibir esta campanha?
                                </h4>
                                <div className="flex flex-wrap gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={editingCampaign.show_in_popup || false} 
                                            onChange={(e) => handleDraftUpdate({ show_in_popup: e.target.checked })} 
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
                                        />
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Pop-up Inicial</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={editingCampaign.show_in_hero || false} 
                                            onChange={(e) => handleDraftUpdate({ show_in_hero: e.target.checked })} 
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
                                        />
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Carrossel do Topo</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={editingCampaign.show_as_section || false} 
                                            onChange={(e) => handleDraftUpdate({ show_as_section: e.target.checked })} 
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
                                        />
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Seção Fixa na Página</span>
                                    </label>
                                </div>
                            </div>

                            {/* Campos Básicos */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1">Título</label>
                                    <input 
                                        value={(editingCampaign.title || '').toUpperCase()} 
                                        onChange={(e) => handleDraftUpdate({ title: e.target.value.toUpperCase() })} 
                                        className="w-full text-sm p-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-gray-900 dark:text-white" 
                                        placeholder="Ex: ADQUIRA SEU CERTIFICADO" 
                                        style={{ textTransform: 'uppercase' }}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1">Tema Visual</label>
                                    <select 
                                        value={editingCampaign.type || 'promo'} 
                                        onChange={(e) => handleDraftUpdate({ type: e.target.value })} 
                                        className="w-full text-sm p-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-gray-900 dark:text-white"
                                    >
                                        <option value="promo">Promoção (Verde/Destaque)</option>
                                        <option value="info">Informativo (Azul/Neutro)</option>
                                        <option value="alert">Alerta Importante (Amarelo/Vermelho)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1">Valor do Anúncio (Opcional)</label>
                                    <input 
                                        value={(editingCampaign.price || '').toUpperCase()} 
                                        onChange={(e) => handleDraftUpdate({ price: e.target.value.toUpperCase() })} 
                                        className="w-full text-sm p-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-gray-900 dark:text-white" 
                                        placeholder="Ex: DE: R$ 180 POR R$ 120" 
                                        style={{ textTransform: 'uppercase' }}
                                    />
                                </div>
                            </div>

                            {/* Subtítulo */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Subtítulo / Descrição</label>
                                    <button 
                                        type="button" 
                                        onClick={handleMagicText} 
                                        disabled={isGeneratingText} 
                                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-750 text-[10px] font-bold flex items-center gap-1"
                                    >
                                        {isGeneratingText ? <RefreshCw size={10} className="animate-spin" /> : <Wand2 size={10} />}
                                        Melhorar com IA
                                    </button>
                                </div>
                                <textarea 
                                    value={(editingCampaign.subtitle || '').toUpperCase()} 
                                    onChange={(e) => handleDraftUpdate({ subtitle: e.target.value.toUpperCase() })} 
                                    className="w-full text-sm p-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 min-h-[80px] text-gray-900 dark:text-white" 
                                    placeholder="Dicas de desconto, vantagens do produto..." 
                                    style={{ textTransform: 'uppercase' }}
                                />
                            </div>

                            {/* Texto do Botão */}
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1">Texto do Botão</label>
                                <input 
                                    value={(editingCampaign.call_to_action || '').toUpperCase()} 
                                    onChange={(e) => handleDraftUpdate({ call_to_action: e.target.value.toUpperCase() })} 
                                    className="w-full text-sm p-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-gray-900 dark:text-white" 
                                    placeholder="Ex: COMPRE AGORA" 
                                    style={{ textTransform: 'uppercase' }}
                                />
                            </div>

                            {/* WhatsApp e E-mail */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1">WhatsApp de Destino *</label>
                                    <input 
                                        required 
                                        value={formatWhatsAppMask(editingCampaign.whatsapp || '')} 
                                        onChange={(e) => {
                                            const cleanPhone = e.target.value.replace(/\D/g, '');
                                            handleDraftUpdate({ 
                                                whatsapp: cleanPhone,
                                                link: cleanPhone ? `https://wa.me/${cleanPhone}` : ''
                                            });
                                        }} 
                                        className="w-full text-sm p-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-gray-900 dark:text-white" 
                                        placeholder="Ex: 55(84) 9 9807-1213" 
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1">E-mail de Notificação (Opcional)</label>
                                    <input 
                                        type="email"
                                        value={(editingCampaign.email || '').toUpperCase()} 
                                        onChange={(e) => handleDraftUpdate({ email: e.target.value.toUpperCase() })} 
                                        className="w-full text-sm p-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-gray-900 dark:text-white" 
                                        placeholder="Ex: CONTATO@EMPRESA.COM" 
                                        style={{ textTransform: 'uppercase' }}
                                    />
                                </div>
                            </div>

                            {/* Novo Campo: Webhook de Leads */}
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1">Webhook de Notificação (Opcional)</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="url"
                                        value={editingCampaign.webhook || ''} 
                                        onChange={(e) => handleDraftUpdate({ webhook: e.target.value })} 
                                        className="flex-1 text-sm p-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-gray-900 dark:text-white" 
                                        placeholder="Ex: https://api.seuservico.com/leads" 
                                    />
                                    {editingCampaign.webhook && editingCampaign.webhook.trim() && (
                                        <button 
                                            type="button" 
                                            onClick={handleTestWebhook} 
                                            disabled={isTestingWebhook}
                                            className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-all shadow-sm shadow-emerald-500/20 flex items-center gap-1.5 whitespace-nowrap"
                                        >
                                            {isTestingWebhook ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                                            Testar
                                        </button>
                                    )}
                                </div>
                                <span className="text-[9px] text-gray-400 dark:text-gray-500 mt-1 block">URL para envio automático de dados em formato JSON (POST) ao capturar novos leads.</span>
                            </div>

                            {/* Imagem */}
                            <div className="max-w-md">
                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-2">Imagem do Pop-up Inicial</label>
                                <div className="flex items-center gap-2">
                                    {editingCampaign.image_url && (
                                        <div className="relative w-12 h-12 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden bg-gray-50 flex-shrink-0 group">
                                            <img src={editingCampaign.image_url} alt="Pop-up" className="w-full h-full object-cover" />
                                            <button 
                                                onClick={() => handleDraftUpdate({ image_url: '' })} 
                                                className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <label className={`flex items-center justify-center gap-1 w-full py-2 px-3 border border-dashed rounded-lg cursor-pointer transition-colors text-xs ${uploadingField === 'image_url' ? 'bg-gray-150 border-gray-300' : 'bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 border-gray-300 dark:border-slate-700'}`}>
                                            {uploadingField === 'image_url' ? <RefreshCw size={12} className="animate-spin text-gray-500" /> : <Upload size={12} className="text-gray-500" />}
                                            <span className="text-gray-600 dark:text-gray-400">{uploadingField === 'image_url' ? 'Enviando...' : 'Escolher Imagem'}</span>
                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'image_url')} disabled={!!uploadingField} />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                            <button 
                                onClick={() => { setEditingCampaign(null); setIsNewCampaign(false); }} 
                                className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 font-semibold rounded-xl text-sm hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleConfirmEdit} 
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-colors shadow-md shadow-emerald-500/10"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
