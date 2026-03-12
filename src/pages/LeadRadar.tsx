import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Target,
    Zap,
    BarChart3,
    Rocket,
    Search,
    CheckCircle2,
    MessageSquare,
    Users,
    Trash2,
    Plus,
    Save,
    BrainCircuit,
    Info,
    User,
    Wand2,
    X,
    Briefcase,
    Phone,
    ExternalLink,
    MapPin
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useEntity } from '../context/EntityContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

interface AISettings {
    id?: string;
    agent_name: string;
    business_niche: string;
    business_description: string;
    services_catalog: any[];
    is_active: boolean;
    auto_approach: boolean;
    daily_lead_quota: number;
    target_location: string;
}

export function LeadRadar() {
    const { t } = useTranslation();
    const { currentEntity } = useEntity();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isMagicLoading, setIsMagicLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'stats' | 'config' | 'catalog'>('stats');
    const [leads, setLeads] = useState<any[]>([]);
    const [stats, setStats] = useState({ found: 0, approached: 0, converted: 0 });

    // Form State
    const [settings, setSettings] = useState<AISettings>({
        agent_name: '',
        business_niche: '',
        business_description: '',
        services_catalog: [],
        is_active: false,
        auto_approach: false,
        daily_lead_quota: 50,
        target_location: ''
    });

    const [magicInput, setMagicInput] = useState('');
    const [showMagicModal, setShowMagicModal] = useState(false);
    const [selectedLead, setSelectedLead] = useState<any>(null);

    useEffect(() => {
        if (currentEntity.id) {
            fetchSettings();
            fetchLeads();
        }
    }, [currentEntity.id]);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('company_ai_settings')
                .select('*')
                .eq('company_id', currentEntity.id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (data) {
                setSettings({
                    ...data,
                    services_catalog: Array.isArray(data.services_catalog) ? data.services_catalog : []
                });
            }
        } catch (error) {
            console.error('Error fetching AI settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchLeads = async () => {
        try {
            const { data, error } = await supabase
                .from('radar_leads')
                .select('*')
                .eq('company_id', currentEntity.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) {
                setLeads(data);

                // Calculate Stats
                const found = data.length;
                const approached = data.filter(l => l.status === 'approached' || l.status === 'converted').length;
                const converted = data.filter(l => l.status === 'converted').length;
                setStats({ found, approached, converted });
            }
        } catch (error) {
            console.error('Error fetching leads:', error);
        }
    };

    const handleDeleteLead = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!window.confirm('Tem certeza que deseja excluir este lead permanentemente?')) return;

        try {
            const { error } = await supabase.from('radar_leads').delete().eq('id', id);
            if (error) throw error;

            setLeads(prev => {
                const newLeads = prev.filter(l => l.id !== id);
                // Atualiza stats
                const found = newLeads.length;
                const approached = newLeads.filter(l => l.status === 'approached' || l.status === 'converted').length;
                const converted = newLeads.filter(l => l.status === 'converted').length;
                setStats({ found, approached, converted });
                return newLeads;
            });
        } catch (error) {
            console.error('Error deleting lead:', error);
            alert('Erro ao excluir o lead.');
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const payload = {
                company_id: currentEntity.id,
                ...settings
            };

            const { error } = await supabase
                .from('company_ai_settings')
                .upsert(payload, { onConflict: 'company_id' });

            if (error) throw error;
            alert(t('lead_radar.save_success', 'Configurações do Radar salvas com sucesso!'));
        } catch (error) {
            console.error('Error saving AI settings:', error);
            alert('Erro ao salvar as configurações.');
        } finally {
            setSaving(false);
        }
    };

    const handleAddService = () => {
        setSettings({
            ...settings,
            services_catalog: [
                ...settings.services_catalog,
                { name: '', price: '', notes: '' }
            ]
        });
    };

    const handleRemoveService = (index: number) => {
        setSettings({
            ...settings,
            services_catalog: settings.services_catalog.filter((_, i) => i !== index)
        });
    };

    const handleServiceChange = (index: number, field: string, value: string) => {
        const newCatalog = [...settings.services_catalog];
        newCatalog[index][field] = value;
        setSettings({ ...settings, services_catalog: newCatalog });
    };

    const runAIMagic = async () => {
        if (!magicInput) return;
        setIsMagicLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('lead-radar-magic', {
                body: { input: magicInput }
            });

            if (error) throw error;

            if (data) {
                setSettings({
                    ...settings,
                    agent_name: data.agent_name || settings.agent_name,
                    business_niche: data.business_niche || settings.business_niche,
                    business_description: data.business_description || settings.business_description,
                    services_catalog: Array.isArray(data.services_catalog) ? data.services_catalog : settings.services_catalog
                });

                setShowMagicModal(false);
                setMagicInput('');
                setActiveTab('config');
                alert('A IA preencheu os campos com base na sua descrição!');
            }
        } catch (error) {
            console.error('Error in AI Magic:', error);
            alert('Erro ao processar com IA. Verifique sua conexão.');
        } finally {
            setIsMagicLoading(false);
        }
    };

    const generateFieldMagic = async (field: string) => {
        try {
            const { data, error } = await supabase.functions.invoke('lead-radar-magic', {
                body: {
                    input: `Empresa: ${currentEntity.name}. Gere apenas o ${field} de forma criativa e profissional.`,
                    mode: 'field_only'
                }
            });

            if (error) throw error;
            if (data) {
                setSettings({ ...settings, [field]: data[field] });
            }
        } catch (e) {
            console.error('Magic Field Error:', e);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-xl text-violet-600">
                            <Target size={28} />
                        </div>
                        {t('lead_radar.title', 'Radar de Leads')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        {t('lead_radar.subtitle', 'Encontre clientes qualificados e converta automaticamente com IA.')}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={async () => {
                            try {
                                // 1. Verificar se a configuração básica foi feita
                                const isMissingConfig = !settings.agent_name || !settings.business_niche || !settings.business_description || !settings.target_location;

                                if (isMissingConfig) {
                                    alert("Por favor, preencha as Configurações do Agente (Nome, Nicho, Descrição e Região) e clique em SALVAR antes de minerar.");
                                    setActiveTab('config');
                                    return;
                                }

                                // 2. Se o agente estiver offline, ativa ele automaticamente antes de minerar
                                if (!settings.is_active) {
                                    const confirmActive = confirm("O Agente está OFFLINE. Gostaria de ATIVÁ-LO e iniciar a mineração agora?");
                                    if (!confirmActive) return;

                                    setSaving(true);
                                    const { error: updateError } = await supabase
                                        .from('company_ai_settings')
                                        .upsert({
                                            company_id: currentEntity.id,
                                            ...settings,
                                            is_active: true
                                        }, { onConflict: 'company_id' });

                                    if (updateError) throw updateError;
                                    setSettings(prev => ({ ...prev, is_active: true }));
                                    setSaving(false);
                                }

                                const { error } = await supabase.functions.invoke('lead-radar-miner', {
                                    body: { company_id: currentEntity.id }
                                });
                                if (error) throw error;
                                alert('O Agente foi ativado e a prospecção iniciada com sucesso!');
                                fetchLeads();
                            } catch (e) {
                                console.error('Mining/Activation Error:', e);
                                alert('Erro ao iniciar mineração ou ativar agente.');
                                setSaving(false);
                            }
                        }}
                        className="border-amber-200 dark:border-amber-800 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                        isLoading={saving}
                    >
                        <Rocket size={18} className="mr-2" />
                        Minerar Agora
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setShowMagicModal(true)}
                        className="border-violet-200 dark:border-violet-800 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                    >
                        <Wand2 size={18} className="mr-2" />
                        {t('lead_radar.ai_magic', 'IA Magia')}
                    </Button>
                    <Button
                        onClick={handleSave}
                        isLoading={saving}
                        className="bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-200 dark:shadow-none"
                    >
                        <Save size={18} className="mr-2" />
                        {t('common.save', 'Salvar')}
                    </Button>
                </div>
            </header>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    title={t('lead_radar.stats_found', 'Leads Minerados')}
                    value={stats.found.toString()}
                    icon={Search}
                    color="blue"
                    trend="+12% hoje"
                />
                <StatCard
                    title={t('lead_radar.stats_approached', 'Abordagens Feitas')}
                    value={stats.approached.toString()}
                    icon={MessageSquare}
                    color="violet"
                    trend="Automático"
                />
                <StatCard
                    title={t('lead_radar.stats_converted', 'Conversões/Agendamentos')}
                    value={stats.converted.toString()}
                    icon={CheckCircle2}
                    color="emerald"
                    trend={`R$ ${(stats.converted * 125).toLocaleString('pt-BR')},00`}
                />
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('lead_radar.agent_status', 'Status do Agente')}</span>
                        <div className={`w-3 h-3 rounded-full ${settings.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            size="sm"
                            variant={settings.is_active ? 'outline' : 'primary'}
                            onClick={() => setSettings({ ...settings, is_active: !settings.is_active })}
                            className={settings.is_active ? 'text-red-500 border-red-200 hover:bg-red-50' : 'bg-green-600 hover:bg-green-700'}
                        >
                            {settings.is_active ? t('lead_radar.deactivate_agent', 'Desativar') : t('lead_radar.activate_agent', 'Ativar')}
                        </Button>
                        <span className="text-xs font-semibold text-gray-400">
                            {settings.is_active ? 'ONLINE' : 'OFFLINE'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Main Tabs */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-xl overflow-hidden">
                <div className="flex border-b border-gray-100 dark:border-slate-700">
                    <TabButton
                        active={activeTab === 'stats'}
                        onClick={() => setActiveTab('stats')}
                        icon={BarChart3}
                        label="Painel de Controle"
                    />
                    <TabButton
                        active={activeTab === 'config'}
                        onClick={() => setActiveTab('config')}
                        icon={BrainCircuit}
                        label={t('lead_radar.settings', 'Configurações')}
                    />
                    <TabButton
                        active={activeTab === 'catalog'}
                        onClick={() => setActiveTab('catalog')}
                        icon={Rocket}
                        label={t('lead_radar.services_catalog', 'Catálogo')}
                    />
                </div>

                <div className="p-6">
                    {activeTab === 'stats' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Zap size={20} className="text-amber-500" />
                                    Leads Qualificados em Tempo Real
                                </h3>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="sm" className="text-violet-600">
                                        {t('lead_radar.view_leads', 'Ver Todos')}
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {leads.slice(0, 10).map(lead => (
                                    <LeadItem
                                        key={lead.id}
                                        name={`${lead.name} (${lead.platform})`}
                                        source={lead.location || 'Brasil'}
                                        text={lead.description}
                                        status={lead.status}
                                        isPJ={lead.platform === 'google_maps'}
                                        onClick={() => setSelectedLead(lead)}
                                        onDelete={(e: React.MouseEvent) => handleDeleteLead(e, lead.id)}
                                    />
                                ))}
                                {leads.length === 0 && (
                                    <div className="text-center py-10">
                                        <p className="text-gray-500 text-sm">{t('lead_radar.no_leads', 'Nenhum lead encontrado hoje ainda. O robô está trabalhando!')}</p>
                                    </div>
                                )}
                            </div>

                            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-800/30 flex gap-4 mt-8">
                                <Info className="text-amber-600 shrink-0" size={24} />
                                <div>
                                    <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Como funciona o Radar?</p>
                                    <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 italic">
                                        "Nossos scout accounts monitoram plataformas sociais e o Google Maps. Quando a IA identifica alguém precisando do seu serviço no raio de atuação definido, ela qualifica o interesse e pode iniciar uma abordagem automática via WhatsApp se estiver configurado."
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'config' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <User size={18} className="text-violet-500" />
                                    {t('lead_radar.agent_identity', 'Identidade do Agente')}
                                </h3>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('lead_radar.agent_name', 'Nome do Agente')}</label>
                                        <button
                                            onClick={() => generateFieldMagic('agent_name')}
                                            className="text-violet-500 hover:text-violet-600 transition-colors p-1"
                                            title="Gerar nome com IA"
                                        >
                                            <Wand2 size={14} />
                                        </button>
                                    </div>
                                    <Input
                                        value={settings.agent_name}
                                        onChange={(e) => setSettings({ ...settings, agent_name: e.target.value })}
                                        placeholder={t('lead_radar.agent_name_placeholder', 'Ex: Dr. Vital - Assistente')}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('lead_radar.business_niche', 'Nicho de Atuação')}</label>
                                        <button
                                            onClick={() => generateFieldMagic('business_niche')}
                                            className="text-violet-500 hover:text-violet-600 transition-colors p-1"
                                            title="Gerar nicho com IA"
                                        >
                                            <Wand2 size={14} />
                                        </button>
                                    </div>
                                    <Input
                                        value={settings.business_niche}
                                        onChange={(e) => setSettings({ ...settings, business_niche: e.target.value })}
                                        placeholder={t('lead_radar.business_niche_placeholder', 'Ex: Laboratório Clínico')}
                                    />
                                </div>

                                <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-2xl border border-gray-100 dark:border-slate-600 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{t('lead_radar.auto_approach', 'Abordagem Automática')}</p>
                                        <p className="text-xs text-gray-500">{t('lead_radar.auto_approach_desc', 'Inicia conversa via Zap automaticamente')}</p>
                                    </div>
                                    <button
                                        onClick={() => setSettings({ ...settings, auto_approach: !settings.auto_approach })}
                                        className={`w-12 h-6 rounded-full transition-colors flex items-center p-1 ${settings.auto_approach ? 'bg-violet-600 justify-end' : 'bg-gray-300 justify-start'}`}
                                    >
                                        <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Search size={18} className="text-violet-500" />
                                    {t('lead_radar.business_description', 'Conhecimento da Empresa')}
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">O que o robô deve saber?</label>
                                        <button
                                            onClick={() => generateFieldMagic('business_description')}
                                            className="text-violet-500 hover:text-violet-600 transition-colors p-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                                        >
                                            <Wand2 size={14} />
                                            Gerar com IA
                                        </button>
                                    </div>
                                    <textarea
                                        value={settings.business_description}
                                        onChange={(e) => setSettings({ ...settings, business_description: e.target.value })}
                                        className="w-full h-40 p-4 text-sm bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-2xl focus:ring-2 focus:ring-violet-500 outline-none transition-all dark:text-white"
                                        placeholder={t('lead_radar.business_description_placeholder', 'Descreva seus diferenciais, horário de funcionamento, etc.')}
                                    />
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                            <Target size={16} className="text-violet-500" />
                                            {t('lead_radar.target_location', 'Região de Atuação')}
                                        </label>
                                        <Input
                                            placeholder="Ex: Natal, RN ou Brasil"
                                            value={settings.target_location}
                                            onChange={(e) => setSettings({ ...settings, target_location: e.target.value })}
                                        />
                                        <p className="text-[10px] text-gray-500 italic">Onde o robô deve focar as buscas de novos clientes.</p>
                                    </div>

                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex justify-between">
                                        Quota Diária de Leads
                                        <span className="text-violet-600 font-bold">{settings.daily_lead_quota}</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="10"
                                        max="200"
                                        step="10"
                                        value={settings.daily_lead_quota}
                                        onChange={(e) => setSettings({ ...settings, daily_lead_quota: parseInt(e.target.value) })}
                                        className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-600"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'catalog' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('lead_radar.services_catalog', 'Catálogo Inteligente')}</h3>
                                <Button size="sm" variant="outline" onClick={handleAddService}>
                                    <Plus size={16} className="mr-1" />
                                    {t('lead_radar.add_service', 'Novo Item')}
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {settings.services_catalog.map((service, index) => (
                                    <div key={index} className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-2xl border border-gray-100 dark:border-slate-600 relative group animate-in zoom-in-95 duration-200">
                                        <button
                                            onClick={() => handleRemoveService(index)}
                                            className="absolute -top-2 -right-2 p-1.5 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                        <div className="space-y-3">
                                            <Input
                                                value={service.name}
                                                onChange={(e) => handleServiceChange(index, 'name', e.target.value)}
                                                placeholder={t('lead_radar.service_name', 'Nome do Serviço')}
                                                className="bg-white dark:bg-slate-800"
                                            />
                                            <div className="flex gap-2">
                                                <Input
                                                    value={service.price}
                                                    onChange={(e) => handleServiceChange(index, 'price', e.target.value)}
                                                    placeholder={t('lead_radar.service_price', 'Preço')}
                                                    className="bg-white dark:bg-slate-800"
                                                />
                                                <Input
                                                    value={service.notes}
                                                    onChange={(e) => handleServiceChange(index, 'notes', e.target.value)}
                                                    placeholder={t('lead_radar.service_notes', 'Obs')}
                                                    className="bg-white dark:bg-slate-800"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {settings.services_catalog.length === 0 && (
                                    <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl">
                                        <Rocket className="mx-auto text-gray-300 mb-2" size={32} />
                                        <p className="text-gray-500 text-sm">Seu catálogo está vazio. Adicione itens para a IA saber o que oferecer.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* AI Magic Modal */}
            {showMagicModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
                        <div className="p-6 bg-gradient-to-br from-violet-600 to-indigo-700 text-white relative">
                            <button
                                onClick={() => setShowMagicModal(false)}
                                className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <Wand2 size={24} />
                                {t('lead_radar.ai_magic', 'IA Magia de Configuração')}
                            </h3>
                            <p className="text-white/80 text-sm mt-2">{t('lead_radar.ai_magic_desc', 'Cole o site ou uma breve descrição da empresa e eu farei o trabalho pesado para você.')}</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <textarea
                                value={magicInput}
                                onChange={(e) => setMagicInput(e.target.value)}
                                placeholder="Ex: Somos uma clínica dentária no centro de São Paulo. Fazemos limpeza, clareamento e implantes. Atendemos de seg a sex das 08h às 18h."
                                className="w-full h-40 p-4 bg-gray-50 dark:bg-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-violet-500 transition-all dark:text-white dark:border-slate-600"
                            />
                            <div className="flex justify-end gap-3">
                                <Button variant="ghost" onClick={() => setShowMagicModal(false)}>Cancelar</Button>
                                <Button
                                    onClick={runAIMagic}
                                    isLoading={isMagicLoading}
                                    className="bg-violet-600 hover:bg-violet-700 text-white"
                                >
                                    <Zap size={18} className="mr-2" />
                                    Processar com IA
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lead Detail Modal */}
            {selectedLead && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
                        <div className="p-6 bg-violet-600 text-white flex justify-between items-center">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <User size={24} />
                                Detalhes do Lead
                            </h3>
                            <button onClick={() => setSelectedLead(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nome / Perfil</label>
                                    <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedLead.name}</p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Plataforma</label>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                                        <ExternalLink size={14} className="text-violet-500" />
                                        {selectedLead.platform}
                                    </p>
                                </div>
                                {selectedLead.contact_number && (
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Contato</label>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                                            <Phone size={14} className="text-violet-500" />
                                            {selectedLead.contact_number}
                                        </p>
                                    </div>
                                )}
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Localização</label>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                                        <MapPin size={14} className="text-violet-500" />
                                        {selectedLead.location || 'Não especificado'}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-2xl border border-violet-100 dark:border-violet-900/30">
                                    <label className="text-[10px] font-bold text-violet-500 uppercase tracking-wider block mb-1">Análise da IA (Score: {selectedLead.score})</label>
                                    <p className="text-xs text-violet-900 dark:text-violet-200 leading-relaxed italic">
                                        {selectedLead.ai_summary || 'Aguardando análise detalhada...'}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mensagem Capturada</label>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">"{selectedLead.description}"</p>
                                </div>
                                {selectedLead.external_url && (
                                    <a
                                        href={selectedLead.external_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 text-xs text-violet-600 hover:underline font-bold"
                                    >
                                        <ExternalLink size={14} />
                                        Acessar perfil/post original
                                    </a>
                                )}
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-slate-900/50 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setSelectedLead(null)}>Fechar</Button>
                            <Button className="bg-violet-600 hover:bg-violet-700 text-white">
                                <MessageSquare size={18} className="mr-2" />
                                Chamar agora
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ title, value, icon: Icon, color, trend }: any) {
    const colors: any = {
        blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
        violet: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30',
        emerald: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm transition-transform hover:scale-[1.02] cursor-default">
            <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-xl ${colors[color] || colors.blue}`}>
                    <Icon size={20} />
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">{trend}</span>
            </div>
            <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">{value}</p>
            <p className="text-xs font-semibold text-gray-400 mt-1 uppercase tracking-wider">{title}</p>
        </div>
    );
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold transition-all relative ${active
                ? 'text-violet-600 dark:text-violet-400'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
        >
            <Icon size={18} />
            {label}
            {active && <div className="absolute bottom-0 left-0 right-0 h-1 bg-violet-600 rounded-t-full"></div>}
        </button>
    );
}

function LeadItem({ name, source, text, status, isPJ, onDelete, onClick }: any) {
    return (
        <div
            onClick={onClick}
            className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-slate-700 hover:border-violet-200 dark:hover:border-violet-900/30 transition-colors group cursor-pointer"
        >
            <div className="flex items-center gap-4 overflow-hidden">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isPJ ? 'bg-blue-100 text-blue-600' : 'bg-violet-100 text-violet-600'}`}>
                    {isPJ ? <Briefcase size={18} /> : <Users size={18} />}
                </div>
                <div className="overflow-hidden">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 dark:text-white truncate">{name}</span>
                        <span className="text-[10px] bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-gray-100 dark:border-slate-600 text-gray-500">{source}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5 italic">"{text}"</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status === 'abordado' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    {status === 'abordado' ? 'ABORDADO' : 'PENDENTE'}
                </span>
                <button
                    onClick={onDelete}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
}


