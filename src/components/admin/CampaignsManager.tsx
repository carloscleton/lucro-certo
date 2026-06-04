import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X, Layout, Zap, Upload, RefreshCw, Wand2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { storageService } from '../../lib/storageService';

export const CampaignsManager = ({ localBanner, setLocalBanner, notify, handleSaveSettings }: any) => {
    const campaigns = localBanner?.campaigns || [];
    
    React.useEffect(() => {
        // Migração transparente do banner antigo para o novo formato de campanhas (se houver banner antigo e a lista de campanhas estiver vazia)
        if (campaigns.length === 0 && localBanner && (localBanner.title || localBanner.subtitle) && !localBanner.migrated) {
            const newCampaign = {
                id: crypto.randomUUID(),
                title: localBanner.title || '',
                subtitle: localBanner.subtitle || '',
                call_to_action: localBanner.call_to_action || '',
                link: localBanner.link || '',
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

    const [editingId, setEditingId] = useState<string | null>(null);
    const [uploadingField, setUploadingField] = useState<string | null>(null);
    const [isGeneratingText, setIsGeneratingText] = useState(false);

    const handleAdd = () => {
        const newCampaign = {
            id: crypto.randomUUID(),
            title: '',
            subtitle: '',
            call_to_action: '',
            link: '',
            type: 'promo',
            price: '',
            image_url: '',
            show_in_popup: true,
            show_in_hero: false,
            show_as_section: true,
            is_active: true
        };
        setLocalBanner({ ...localBanner, campaigns: [...campaigns, newCampaign] });
        setEditingId(newCampaign.id);
    };

    const handleUpdate = (id: string, updates: any) => {
        const newCampaigns = campaigns.map((c: any) => c.id === id ? { ...c, ...updates } : c);
        setLocalBanner({ ...localBanner, campaigns: newCampaigns });
    };

    const handleDelete = (id: string) => {
        if (!confirm('Deseja realmente excluir esta campanha?')) return;
        const newCampaigns = campaigns.filter((c: any) => c.id !== id);
        setLocalBanner({ ...localBanner, campaigns: newCampaigns });
    };

    const toggleStatus = (id: string, currentStatus: boolean) => {
        handleUpdate(id, { is_active: !currentStatus });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, id: string, field: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploadingField(field);
            const fileExt = file.name.split('.').pop();
            const fileName = `landing_banners/banner_${field}_${Date.now()}.${fileExt}`;
            const { publicUrl } = await storageService.upload(file, 'social_media_assets', fileName);
            handleUpdate(id, { [field]: publicUrl });
            notify('success', 'Imagem enviada com sucesso!');
        } catch (error) {
            console.error('Upload error:', error);
            notify('error', 'Erro ao enviar imagem.');
        } finally {
            setUploadingField(null);
        }
    };

    const handleMagicText = async (campaign: any) => {
        const textToOrganize = campaign.subtitle || campaign.title;
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
                handleUpdate(campaign.id, { subtitle: data.text });
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
                                        onClick={() => setEditingId(editingId === campaign.id ? null : campaign.id)}
                                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                        {editingId === campaign.id ? <X size={18} /> : <Edit2 size={18} />}
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(campaign.id)}
                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Formulário de Edição (Expansível) */}
                            {editingId === campaign.id && (
                                <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 space-y-4">
                                    
                                    {/* Configurações de Exibição */}
                                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl">
                                        <h4 className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-3 uppercase flex items-center gap-2"><Layout size={14}/> Onde exibir esta campanha?</h4>
                                        <div className="flex flex-wrap gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={campaign.show_in_popup} onChange={(e) => handleUpdate(campaign.id, { show_in_popup: e.target.checked })} className="rounded border-gray-300 text-indigo-600" />
                                                <span className="text-sm font-medium">Pop-up Inicial</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={campaign.show_in_hero} onChange={(e) => handleUpdate(campaign.id, { show_in_hero: e.target.checked })} className="rounded border-gray-300 text-indigo-600" />
                                                <span className="text-sm font-medium">Carrossel do Topo</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={campaign.show_as_section} onChange={(e) => handleUpdate(campaign.id, { show_as_section: e.target.checked })} className="rounded border-gray-300 text-indigo-600" />
                                                <span className="text-sm font-medium">Seção Fixa na Página</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Campos Básicos */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Título</label>
                                            <input value={campaign.title} onChange={(e) => handleUpdate(campaign.id, { title: e.target.value })} className="w-full text-sm p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-indigo-500" placeholder="Ex: Adquira seu Certificado" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Tema Visual</label>
                                            <select value={campaign.type} onChange={(e) => handleUpdate(campaign.id, { type: e.target.value })} className="w-full text-sm p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-indigo-500">
                                                <option value="promo">Promoção (Verde/Destaque)</option>
                                                <option value="info">Informativo (Azul/Neutro)</option>
                                                <option value="alert">Alerta Importante (Amarelo/Vermelho)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Valor do Anúncio (Opcional)</label>
                                            <input value={campaign.price || ''} onChange={(e) => handleUpdate(campaign.id, { price: e.target.value })} className="w-full text-sm p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-indigo-500" placeholder="Ex: DE: R$ 180 Por apenas R$ 120" />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Subtítulo / Descrição</label>
                                            <button type="button" onClick={() => handleMagicText(campaign)} disabled={isGeneratingText} className="text-indigo-600 hover:text-indigo-700 text-[10px] font-bold flex items-center gap-1">
                                                {isGeneratingText ? <RefreshCw size={10} className="animate-spin" /> : <Wand2 size={10} />}
                                                Melhorar com IA
                                            </button>
                                        </div>
                                        <textarea value={campaign.subtitle} onChange={(e) => handleUpdate(campaign.id, { subtitle: e.target.value })} className="w-full text-sm p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-indigo-500 min-h-[80px]" placeholder="Dicas de desconto, vantagens do produto..." />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Texto do Botão</label>
                                            <input value={campaign.call_to_action} onChange={(e) => handleUpdate(campaign.id, { call_to_action: e.target.value })} className="w-full text-sm p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-indigo-500" placeholder="Ex: Eu Quero!" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Link do Botão</label>
                                            <input value={campaign.link} onChange={(e) => handleUpdate(campaign.id, { link: e.target.value })} className="w-full text-sm p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-indigo-500" placeholder="https://" />
                                        </div>
                                    </div>

                                    <div className="max-w-md">
                                        {/* Pop-up Image */}
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Imagem do Pop-up Inicial</label>
                                            <div className="flex items-center gap-2">
                                                {campaign.image_url && (
                                                    <div className="relative w-12 h-12 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex-shrink-0 group">
                                                        <img src={campaign.image_url} alt="Pop-up" className="w-full h-full object-cover" />
                                                        <button onClick={() => handleUpdate(campaign.id, { image_url: '' })} className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                                <div className="flex-1">
                                                    <label className={`flex items-center justify-center gap-1 w-full py-2 px-3 border border-dashed rounded-lg cursor-pointer transition-colors text-xs ${uploadingField === 'image_url' ? 'bg-gray-100 border-gray-300' : 'bg-gray-50 hover:bg-gray-100 border-gray-300'}`}>
                                                        {uploadingField === 'image_url' ? <RefreshCw size={12} className="animate-spin text-gray-500" /> : <Upload size={12} className="text-gray-500" />}
                                                        <span className="text-gray-600">{uploadingField === 'image_url' ? 'Enviando...' : 'Escolher'}</span>
                                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, campaign.id, 'image_url')} disabled={!!uploadingField} />
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            )}
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
        </div>
    );
};
