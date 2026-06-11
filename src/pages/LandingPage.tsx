import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    ShieldCheck,
    Radar,
    Sparkles,
    BarChart3,
    CheckCircle2,
    DollarSign,
    Users,
    CreditCard,
    X,
    Award,
    Gift,
    Receipt,
    AlertTriangle,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';
import { supabase } from '../lib/supabase';
import { PaymentRequired } from './PaymentRequired';
import logoFull from '../assets/logo-full.png';
import { API_BASE_URL } from '../lib/constants';

// Import images used in detailed feature sections
import bannerMarketingCopilot from '../assets/landing/landing_hero_marketing_copilot.png';
import bannerMulticurrency from '../assets/landing/landing_hero_multicurrency.png';
import bannerLoyalty from '../assets/landing/landing_hero_loyalty.png';
import bannerFiscal from '../assets/landing/landing_hero_fiscal_management.png';
import bannerCRM from '../assets/landing/landing_hero_crm.png';
import bannerQuotes from '../assets/landing/landing_hero_quotes.png';
import bannerWhatsApp from '../assets/landing/landing_hero_whatsapp.png';
import bannerMulticompany from '../assets/landing/landing_hero_multicompany.png';
import bannerCertificado from '../assets/landing/landing_hero_certificado_digital.png';

import { HeroCarousel } from '../components/landing/HeroCarousel';

import '../styles/LandingPage.css';



const formatTextWithBold = (text: string) => {
    if (!text) return null;
    
    // Split by **text** or *text*
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className="font-bold text-gray-900 dark:text-white">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return <strong key={index} className="font-bold text-gray-900 dark:text-white">{part.slice(1, -1)}</strong>;
        }
        return <span key={index}>{part}</span>;
    });
};

const renderPriceHighlight = (priceText: string) => {
    if (!priceText) return null;
    
    // Pattern: DE: [value] POR/PARA/APENAS [value]
    const dePorRegex = /de\s*:?\s*(.*?)\s+(por\s+apenas|por|para\s*:?|para|apenas|a)\s*(.*)/i;
    const match = priceText.match(dePorRegex);
    
    if (match) {
        const originalPrice = match[1].trim();
        const connector = match[2].trim();
        const promoPrice = match[3].trim();
        
        return (
            <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
                <span className="text-xs text-gray-400 dark:text-gray-500 line-through font-medium">
                    De {originalPrice}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-md text-[10px] font-bold uppercase tracking-wider">
                    {connector}
                </span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                    {promoPrice}
                </span>
            </div>
        );
    }
    
    return (
        <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
            {priceText}
        </span>
    );
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

export function LandingPage() {
    const navigate = useNavigate();
    const { currentEntity } = useEntity();
    const { session } = useAuth();
    
    useEffect(() => {
        localStorage.removeItem('loggingOut');
    }, []);

    const plan = currentEntity?.subscription_plan || '';
    const isTrialExpired = plan === 'trial' && (currentEntity as any)?.trial_ends_at && new Date((currentEntity as any).trial_ends_at) < new Date();
    const isUnpaid = ['unpaid', 'past_due'].includes(currentEntity?.subscription_status || '') || isTrialExpired;
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const [landingPlans, setLandingPlans] = useState<any[]>([]);
    const [landingCampaigns, setLandingCampaigns] = useState<any[]>([]);
    const [activePopupIndex, setActivePopupIndex] = useState(0);
    const [showBanner, setShowBanner] = useState(false);
    const [selectedCurrency, setSelectedCurrency] = useState('BRL');
    const [currencySymbol, setCurrencySymbol] = useState('R$');

    const [leadName, setLeadName] = useState('');
    const [leadPhone, setLeadPhone] = useState('');
    const [leadEmail, setLeadEmail] = useState('');
    const [isLeadFormActive, setIsLeadFormActive] = useState(false);
    const [isLeadSuccess, setIsLeadSuccess] = useState(false);

    useEffect(() => {
        setIsLeadFormActive(false);
        setIsLeadSuccess(false);
    }, [activePopupIndex, showBanner]);

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const { data, error } = await supabase.from('app_settings').select('landing_plans, landing_banner').eq('id', 1).maybeSingle();
                if (error) {
                    console.error("Erro ao puxar planos do Supabase:", error);
                } else {
                    if (data?.landing_plans && Array.isArray(data.landing_plans)) {
                        // Only show enabled plans on the public landing page
                        const activePlans = data.landing_plans.filter((p: any) => p.enabled !== false);
                        setLandingPlans(activePlans);
                    }
                    if (data?.landing_banner) {
                        const bannerData = data.landing_banner;
                        let activeCampaigns = bannerData.campaigns || [];
                        if (activeCampaigns.length === 0 && bannerData.enabled && bannerData.title) {
                             activeCampaigns = [{
                                id: 'legacy',
                                title: bannerData.title,
                                subtitle: bannerData.subtitle,
                                call_to_action: bannerData.call_to_action,
                                link: bannerData.link,
                                type: bannerData.type || 'promo',
                                image_url: bannerData.image_url,
                                show_in_popup: bannerData.enabled,
                                show_in_hero: bannerData.enabled,
                                show_as_section: bannerData.enabled,
                                is_active: bannerData.enabled,
                             }];
                        }
                        const active = activeCampaigns.filter((c: any) => c.is_active).map((c: any) => ({
                            ...c,
                            webhook: c.webhook || ''
                        }));
                        setLandingCampaigns(active);
                        if (active.some((c: any) => c.show_in_popup)) {
                            setShowBanner(true);
                        }
                    }
                }
            } catch (err) {
                console.error("Erro ao puxar planos", err);
            }
        };
        fetchPlans();
    }, []);

    useEffect(() => {
        if (showBanner && landingCampaigns.length > 0 && !isLeadFormActive) {
            const popupCampaigns = landingCampaigns.filter(c => c.show_in_popup);
            if (popupCampaigns.length <= 1) return;
            const timer = setInterval(() => {
                setActivePopupIndex(prev => (prev + 1) % popupCampaigns.length);
            }, 6000); // 6 seconds slide
            return () => clearInterval(timer);
        }
    }, [showBanner, landingCampaigns, isLeadFormActive]);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const updateCurrency = (code: string) => {
        setSelectedCurrency(code);
        const symbols: Record<string, string> = { 'BRL': 'R$', 'USD': '$', 'EUR': '€', 'PYG': 'Gs.' };
        setCurrencySymbol(symbols[code] || '$');
    };

    const handleDynamicCheckout = async (plan: any) => {
        if (plan.checkout_url) {
            window.open(plan.checkout_url, '_blank');
            return;
        }

        // Option 2: Redirect to signup with plan details, allowing them to register first
        const planSearch = (plan.name?.toLowerCase() || '') + (plan.observation?.toLowerCase() || '');
        const isBoth = planSearch.includes('pf') && planSearch.includes('pj');
        const isPJ = planSearch.includes('pj');
        const regType = isBoth ? 'BOTH' : (isPJ ? 'PJ' : 'PF');
        
        navigate(`/login?mode=signup&checkout-plan=${encodeURIComponent(plan.name)}&checkout-price=${plan.price}&currency=${selectedCurrency}&registration-type=${regType}`);
    };


    const handleLeadSubmit = async (e: React.FormEvent, currentCampaign: any) => {
        e.preventDefault();
        if (!leadName.trim() || !leadPhone.trim()) {
            return;
        }

        const cleanLeadPhone = leadPhone.replace(/\D/g, '');
        const cleanEmail = leadEmail.trim().toUpperCase() || null;
        const cleanName = leadName.trim().toUpperCase();

        console.log("Submetendo Lead:", { cleanName, cleanLeadPhone, cleanEmail });
        console.log("Configurações da Campanha:", currentCampaign);

        // Dispara webhook se configurado
        if (currentCampaign.webhook && currentCampaign.webhook.trim()) {
            const webhookUrl = currentCampaign.webhook.trim();
            const leadPayload = {
                event: 'lead_captured',
                timestamp: new Date().toISOString(),
                lead: {
                    name: cleanName,
                    phone: cleanLeadPhone,
                    email: cleanEmail
                },
                campaign: {
                    id: currentCampaign.id,
                    title: currentCampaign.title,
                    subtitle: currentCampaign.subtitle,
                    call_to_action: currentCampaign.call_to_action || '',
                    link: currentCampaign.link || '',
                    whatsapp: currentCampaign.whatsapp || '',
                    email: currentCampaign.email || '',
                    webhook: currentCampaign.webhook || '',
                    type: currentCampaign.type,
                    price: currentCampaign.price || null,
                    image_url: currentCampaign.image_url || null,
                    show_in_popup: !!currentCampaign.show_in_popup,
                    show_in_hero: !!currentCampaign.show_in_hero,
                    show_as_section: !!currentCampaign.show_as_section,
                    whatsapp_instance_name: currentCampaign.whatsapp_instance_name || ''
                }
            };

            console.log("Disparando Webhook para:", webhookUrl, leadPayload);

            try {
                const base = API_BASE_URL.replace(/\/$/, '');
                const response = await fetch(`${base}/api/public/campaign-webhook`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        webhook_url: webhookUrl,
                        payload: leadPayload
                    })
                });
                
                if (response.ok) {
                    console.log("Webhook enviado com sucesso!");
                } else {
                    console.error("Erro ao enviar webhook:", response.status);
                }
            } catch (err) {
                console.error("Erro ao enviar payload para o webhook:", err);
            }
        } else {
            console.log("Nenhum webhook configurado para esta campanha.");
        }
        
        setIsLeadSuccess(true);
        setLeadName('');
        setLeadPhone('');
        setLeadEmail('');
    };

    return (
        <div className="landing-container">
            {/* Nav and Background */}
            <nav className="landing-nav">
                <div className="nav-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
                    <img src={logoFull} alt="Lucro Certo" className="h-9 md:h-12 w-auto" />
                </div>
                <div className="nav-links">
                    <a href="#features" className="nav-link">Funcionalidades</a>
                    <a href="#ai" className="nav-link">Inteligência Artificial</a>
                    {landingPlans.length > 0 && <a href="#pricing" className="nav-link">Planos</a>}
                    
                    <div className="flex items-center gap-1 bg-white/10 p-1 rounded-lg backdrop-blur-md border border-white/20 ml-4">
                        {['BRL', 'USD', 'EUR', 'PYG'].map(code => (
                            <button
                                key={code}
                                onClick={() => updateCurrency(code)}
                                className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${selectedCurrency === code ? 'bg-white text-blue-600 shadow-sm' : 'text-white/60 hover:text-white'}`}
                            >
                                {code}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-4">
                    {session ? (
                        <Link to="/dashboard" className="nav-btn text-xs md:text-sm px-3 md:px-6 py-2 md:py-3 whitespace-nowrap">Acessar Sistema</Link>
                    ) : (
                        <>
                            <Link to="/login" className="nav-link text-xs md:text-sm font-semibold whitespace-nowrap">
                                <span className="inline sm:hidden">Entrar</span>
                                <span className="hidden sm:inline">Acessar Conta</span>
                            </Link>
                            <Link to="/login?mode=signup" className="nav-btn text-xs md:text-sm px-3 md:px-6 py-2 md:py-3 whitespace-nowrap">Começar Agora</Link>
                        </>
                    )}
                </div>
            </nav>

            {/* Hero Carousel Section */}
            <HeroCarousel session={session} setIsVideoModalOpen={setIsVideoModalOpen} landingCampaigns={landingCampaigns} />

            {/* Trust Bar (Media) */}
            <section className="media-bar" style={{ padding: '2rem 5%', background: '#fff', borderBottom: '1px solid var(--glass-border)', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '1.5rem', letterSpacing: '1px' }}>O SISTEMA QUE É DESTAQUE NO MERCADO FINANCEIRO</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '4rem', alignItems: 'center', opacity: 0.6, filter: 'grayscale(1)' }}>
                    <img src="/images/landing/media-logos.png" alt="Destaque na Mídia" style={{ maxHeight: '40px', width: 'auto' }} />
                </div>
            </section>

            {/* Stats Bar */}
            <section className="stats-bar">
                <div className="stat-item">
                    <span className="stat-number">98%</span>
                    <span className="stat-label">Precisão Financeira</span>
                </div>
                <div className="stat-item">
                    <span className="stat-number">+5</span>
                    <span className="stat-label">Moedas Suportadas</span>
                </div>
                <div className="stat-item">
                    <span className="stat-number">24/7</span>
                    <span className="stat-label">Extração de Leads</span>
                </div>
                <div className="stat-item">
                    <span className="stat-number">10x</span>
                    <span className="stat-label">Mais Produtividade</span>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="features-section">
                <div className="section-header">
                    <h2>Controle Total, Esforço Zero</h2>
                    <p>Ferramentas projetadas para empresários que não têm tempo a perder.</p>
                </div>

                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon">
                            <BarChart3 size={32} />
                        </div>
                        <h3>Controle Financeiro Total</h3>
                        <p>Gestão completa de Contas a Pagar e Receber. Organize seu fluxo de caixa por categorias, centros de custo e receba alertas de vencimento.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">
                            <Users size={32} />
                        </div>
                        <h3>CRM & Vendas</h3>
                        <p>Gestão de contatos, histórico de interações e pipeline de vendas. Transforme leads em clientes com um fluxo organizado.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">
                            <DollarSign size={32} />
                        </div>
                        <h3>Orçamentos & Pedidos</h3>
                        <p>Crie orçamentos profissionais com um clique, envie via WhatsApp e converta em vendas rapidamente com controle de status.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon" style={{ background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5' }}>
                            <Gift size={32} />
                        </div>
                        <h3>Clube de Fidelidade</h3>
                        <p>Fidelize seus clientes com planos de assinatura e recorrência. Gere previsibilidade de caixa com faturamento automático.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon" style={{ background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899' }}>
                            <Receipt size={32} />
                        </div>
                        <h3>Notas Fiscais (NF-e/NFS-e)</h3>
                        <p>Emita notas fiscais de serviço e produtos diretamente pelo sistema. Histórico completo com download de XML e PDF em um clique.</p>
                    </div>
                </div>
            </section>

            {/* Detailed Finance Section */}
            <section className="features-section" style={{ paddingTop: 0 }}>
                <div className="visual-feature">
                    <div className="visual-content">
                        <div style={{ color: 'var(--primary-blue)', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BarChart3 size={20} />
                            GESTÃO DE CAIXA PROFISSIONAL
                        </div>
                        <h3>Domine cada centavo da sua empresa</h3>
                        <p>
                            Esqueça as planilhas complicadas. O Lucro Certo oferece um Livro Analítico completo para você visualizar exatamente para onde seu dinheiro está indo.
                        </p>
                        <ul className="feature-list">
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Contas a Pagar e Receber:</strong> Controle absoluto de prazos e valores.</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>DRE Automática:</strong> Demonstrativo de Resultados do Exercício em tempo real.</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Anexos Digitalizados:</strong> Guarde comprovantes e notas direto na transação.</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Fluxo de Caixa Mensal:</strong> Previsão de saldo para os próximos meses.</li>
                        </ul>
                    </div>
                    <div className="visual-image-container">
                        <img
                            src="/images/landing/financial-management.png"
                            alt="Gestão Financeira Lucro Certo"
                            className="visual-image"
                        />
                    </div>
                </div>
            {/* AI Radar Highlight */}
            <div id="ai" className="visual-feature reverse">
                    <div className="visual-content">
                        <div style={{ color: '#10b981', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Radar size={20} />
                            RADAR DE LEADS IA
                        </div>
                        <h3>Deixe a IA caçar os seus clientes</h3>
                        <p>
                            Nossa tecnologia exclusiva mapeia o Google Maps e Redes Sociais atrás do seu cliente ideal. O sistema não só encontra, como também qualifica e entra em contato sozinho.
                        </p>
                        <ul className="feature-list">
                            <li><CheckCircle2 size={18} className="check-icon" /> Mineração automática agendada</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> Abordagem no WhatsApp via Bots</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> Filtros por região e nicho de atuação</li>
                        </ul>
                    </div>
                    <div className="visual-image-container">
                        <img
                            src="/images/landing/ai-radar.png"
                            alt="AI Radar Feature"
                            className="visual-image"
                        />
                    </div>
                </div>

                <div className="visual-feature">
                    <div className="visual-content">
                        <div style={{ color: '#6366f1', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Sparkles size={20} />
                            MARKETING COPILOT
                        </div>
                        <h3>Sua Marca no Piloto Automático com Brand Kit</h3>
                        <p>
                            Chega de perder horas pensando no que postar. O Copilot cria cronogramas, artes e legendas profissionais sincronizadas com o seu Brand Kit (logo, cores e tom de voz).
                        </p>
                        <ul className="feature-list">
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Brand Kit Centralizado:</strong> Sua logo e cores em tudo.</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Geração de Legendas & Vídeos:</strong> IA que entende seu negócio.</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Autopilot Agendado:</strong> Postagens automáticas no Instagram.</li>
                        </ul>
                    </div>
                    <div className="visual-image-container">
                        <img
                            src={bannerMarketingCopilot}
                            alt="Marketing Copilot Feature"
                            className="visual-image"
                            style={{ borderRadius: '24px', boxShadow: '0 40px 80px -15px rgba(99, 102, 241, 0.3)' }}
                        />
                    </div>
                </div>

                {/* CRM & VENDAS Section */}
                <div className="visual-feature reverse">
                    <div className="visual-content">
                        <div style={{ color: '#ec4899', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Users size={20} />
                            CRM & VENDAS
                        </div>
                        <h3>Transforme Leads em Clientes Fiéis</h3>
                        <p>
                            Gestão completa do pipeline de vendas. Organize seus contatos e nunca perca uma oportunidade.
                        </p>
                        <ul className="feature-list">
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Funil de Vendas Visual:</strong> Acompanhe as negociações etapa por etapa.</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Histórico de Interações:</strong> Tudo documentado no perfil do cliente.</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Automação de Follow-up:</strong> Lembretes automáticos para sua equipe.</li>
                        </ul>
                    </div>
                    <div className="visual-image-container">
                        <img
                            src={bannerCRM}
                            alt="CRM e Vendas"
                            className="visual-image"
                            style={{ borderRadius: '24px', boxShadow: '0 40px 80px -15px rgba(236, 72, 153, 0.2)' }}
                        />
                    </div>
                </div>

                {/* ORÇAMENTOS PROFISSIONAIS Section */}
                <div className="visual-feature">
                    <div className="visual-content">
                        <div style={{ color: '#f59e0b', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <DollarSign size={20} />
                            ORÇAMENTOS PROFISSIONAIS
                        </div>
                        <h3>Propostas que Vendem por Você</h3>
                        <p>
                            Crie orçamentos lindíssimos em segundos e envie via WhatsApp para seus clientes com aprovação digital.
                        </p>
                        <ul className="feature-list">
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Modelos Customizáveis:</strong> Templates com a cara da sua empresa.</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Assinatura Digital Rápida:</strong> Seus clientes aprovam no próprio celular.</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Status de Leitura:</strong> Saiba exatamente quando o cliente abriu a proposta.</li>
                        </ul>
                    </div>
                    <div className="visual-image-container">
                        <img
                            src={bannerQuotes}
                            alt="Orçamentos Profissionais"
                            className="visual-image"
                            style={{ borderRadius: '24px', boxShadow: '0 40px 80px -15px rgba(245, 158, 11, 0.3)' }}
                        />
                    </div>
                </div>

                {/* AUTOMAÇÃO WHATSAPP Section */}
                <div className="visual-feature reverse">
                    <div className="visual-content">
                        <div style={{ color: '#14b8a6', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CreditCard size={20} />
                            AUTOMAÇÃO WHATSAPP
                        </div>
                        <h3>Régua de Cobrança Automática</h3>
                        <p>
                            Reduza a inadimplência com lembretes inteligentes de pagamento enviados diretamente para o WhatsApp dos seus clientes.
                        </p>
                        <ul className="feature-list">
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Lembretes de Vencimento:</strong> Mensagens automáticas via WhatsApp.</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Links de Pagamento Direto:</strong> Envie a fatura pronta para pagamento (Pix/Cartão).</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Baixa Automática no Caixa:</strong> Tudo é reconciliado assim que o cliente paga.</li>
                        </ul>
                    </div>
                    <div className="visual-image-container">
                        <img
                            src={bannerWhatsApp}
                            alt="Automação WhatsApp"
                            className="visual-image"
                            style={{ borderRadius: '24px', boxShadow: '0 40px 80px -15px rgba(20, 184, 166, 0.2)' }}
                        />
                    </div>
                </div>

                {/* MULTI-EMPRESAS Section */}
                <div className="visual-feature">
                    <div className="visual-content">
                        <div style={{ color: '#4b5563', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Users size={20} />
                            MULTI-EMPRESAS
                        </div>
                        <h3>Gerencie Vários Negócios</h3>
                        <p>
                            Troque entre empresas com um clique. Tenha uma visão consolidada de todas as suas unidades sem precisar sair do sistema.
                        </p>
                        <ul className="feature-list">
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Consolidação de Dados:</strong> Veja o lucro total de todas as empresas juntas.</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Acessos Diferenciados:</strong> Defina quem pode ver cada filial.</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Interligação de Estoques:</strong> Movimente produtos entre as lojas facilmente.</li>
                        </ul>
                    </div>
                    <div className="visual-image-container">
                        <img
                            src={bannerMulticompany}
                            alt="Multi-Empresas"
                            className="visual-image"
                            style={{ borderRadius: '24px', boxShadow: '0 40px 80px -15px rgba(75, 85, 99, 0.3)' }}
                        />
                    </div>
                </div>

                {/* Multi-Currency Section */}
                <div className="visual-feature reverse">
                    <div className="visual-content">
                        <div style={{ color: '#d4af37', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <DollarSign size={20} />
                            CONTROLE MULTI-MOEDAS
                        </div>
                        <h3>Expanda seus horizontes sem fronteiras</h3>
                        <p>
                            O Lucro Certo agora é global. Controle suas contas em BRL, USD, EUR ou PYG com conversão automática e relatórios consolidados em uma única tela.
                        </p>
                        <ul className="feature-list">
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Conversão Inteligente:</strong> Câmbio atualizado automaticamente.</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Faturamento Internacional:</strong> Receba em qualquer moeda.</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Visão Global:</strong> Entenda o lucro total do seu império.</li>
                        </ul>
                    </div>
                    <div className="visual-image-container">
                        <img
                            src={bannerMulticurrency}
                            alt="Multi-Currency Feature"
                            className="visual-image"
                            style={{ borderRadius: '24px', boxShadow: '0 40px 80px -15px rgba(212, 175, 55, 0.2)' }}
                        />
                    </div>
                </div>

                {/* Platform Billing Section */}
                <div className="visual-feature">
                    <div className="visual-content">
                        <div style={{ color: '#ec4899', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CreditCard size={20} />
                            FATURAMENTO AUTOMÁTICO
                        </div>
                        <h3>Gestão de Assinantes Sem Stress</h3>
                        <p>
                            Venda o acesso ao seu sistema e deixe que a nossa plataforma cuide do resto. Régua de cobrança automática, bloqueio de inadimplentes e renovação instantânea.
                        </p>
                        <ul className="feature-list">
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Régua de Cobrança:</strong> WhatsApp automático antes do vencimento.</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Checkout Integrado:</strong> Seus clientes pagam via PIX ou Cartão em segundos.</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Gestão Centralizada:</strong> Painel administrativo para controle total de associados.</li>
                        </ul>
                    </div>
                    <div className="visual-image-container">
                        <img
                            src="/images/landing/platform-billing.png"
                            alt="Faturamento da Plataforma"
                            className="visual-image"
                            style={{ borderRadius: '24px', boxShadow: '0 40px 80px -15px rgba(236, 72, 153, 0.2)' }}
                        />
                    </div>
                </div>

                {/* Loyalty Club Section */}
                <div className="visual-feature reverse">
                    <div className="visual-content">
                        <div style={{ color: '#4f46e5', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Award size={20} />
                            CLUBE DE FIDELIDADE
                        </div>
                        <h3>Transforme sua Prestação de Serviço em Recorrência</h3>
                        <p>
                            Chega de depender apenas de vendas avulsas. Com o Clube de Fidelidade, você cria planos de benefícios que seus clientes pagam todo mês, garantindo estabilidade financeira.
                        </p>
                        <ul className="feature-list">
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Planos Personalizados:</strong> Defina quais serviços e descontos fazem parte de cada nível.</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Cashback Automático:</strong> Incentive novas compras devolvendo parte do valor ao cliente fiel.</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Gestão de Assinaturas:</strong> Controle quem está ativo, inadimplente ou em período extra.</li>
                        </ul>
                    </div>
                    <div className="visual-image-container">
                        <img
                            src={bannerLoyalty}
                            alt="Clube de Fidelidade"
                            className="visual-image"
                            style={{ borderRadius: '24px', boxShadow: '0 40px 80px -15px rgba(79, 70, 229, 0.3)' }}
                        />
                    </div>
                </div>

                {/* Fiscal Management Section */}
                <div className="visual-feature">
                    <div className="visual-content">
                        <div style={{ color: '#0ea5e9', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Receipt size={20} />
                            GESTÃO FISCAL DESCOMPLICADA
                        </div>
                        <h3>Emita Notas Fiscais em Segundos</h3>
                        <p>
                            Diga adeus aos portais lentos das prefeituras. Com o Lucro Certo, você emite NF-e e NFS-e direto do seu faturamento, com preenchimento automático de dados.
                        </p>
                        <ul className="feature-list">
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Emissão em 1 Clique:</strong> Gere notas direto dos seus orçamentos aprovados.</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Histórico Centralizado:</strong> XML e PDF organizados e prontos para o seu contador.</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Envio Automático:</strong> Seus clientes recebem a nota por e-mail e WhatsApp na hora.</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> <strong>Sincronização Total:</strong> Status atualizado em tempo real com a SEFAZ e Prefeituras.</li>
                        </ul>
                    </div>
                    <div className="visual-image-container">
                        <img
                            src={bannerFiscal}
                            alt="Gestão Fiscal Lucro Certo"
                            className="visual-image"
                            style={{ borderRadius: '24px', boxShadow: '0 40px 80px -15px rgba(14, 165, 233, 0.2)' }}
                        />
                    </div>
                </div>

                {/* Dynamic Marketing Campaigns Sections */}
                {landingCampaigns.filter((c: any) => c.show_as_section).map((campaign: any, index: number) => (
                    <div key={campaign.id} className={`visual-feature ${index % 2 !== 0 ? 'reverse' : ''}`}>
                        <div className="visual-content">
                            <div style={{ color: '#10b981', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ShieldCheck size={20} />
                                {campaign.type === 'promo' ? 'OFERTA ESPECIAL' : campaign.type === 'info' ? 'NOVIDADE' : 'DESTAQUE'}
                            </div>
                            <h3>{campaign.title}</h3>
                            <div className="mb-8 flex flex-col gap-3 text-[1.05rem] text-slate-600 dark:text-slate-300 leading-relaxed">
                                {campaign.subtitle?.split('\n').map((line: string, i: number) => line.trim() ? (
                                    <div key={i} className="flex items-start">
                                        <span className="flex-1">{formatTextWithBold(line)}</span>
                                    </div>
                                ) : null)}
                            </div>
                            {campaign.price && (
                                <div className="mb-6 flex justify-center lg:justify-start">
                                    <div className="inline-flex items-center justify-center px-4 py-2.5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 shadow-sm rounded-2xl w-fit">
                                        {renderPriceHighlight(campaign.price)}
                                    </div>
                                </div>
                            )}
                            {campaign.call_to_action && campaign.link && (
                                <a 
                                    href={campaign.link} 
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block px-8 py-3 rounded-xl font-bold text-white transition-all transform hover:scale-105 shadow-lg text-base bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/30"
                                >
                                    {campaign.call_to_action}
                                </a>
                            )}
                        </div>
                        <div className="visual-image-container">
                            <img
                                src={campaign.section_image_url || bannerCertificado}
                                alt={campaign.title}
                                className="visual-image"
                                style={{ borderRadius: '24px', boxShadow: '0 40px 80px -15px rgba(16, 185, 129, 0.2)' }}
                            />
                        </div>
                    </div>
                ))}
            </section>

            {/* FAQ Section */}
            <section id="faq" className="features-section" style={{ background: 'rgba(37, 99, 235, 0.02)' }}>
                <div className="section-header">
                    <h2>Perguntas Frequentes</h2>
                    <p>Tudo o que você precisa saber para começar com segurança.</p>
                </div>
                <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="faq-item" style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                        <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-dark)' }}>O sistema aceita moedas estrangeiras?</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Sim! O Lucro Certo agora suporta BRL, USD, EUR e PYG, permitindo que você gerencie transações internacionais com conversão de câmbio em tempo real e relatórios consolidados.</p>
                    </div>
                    <div className="faq-item" style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                        <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-dark)' }}>Como funciona a integração com Webhooks?</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Nossa API robusta permite que você conecte o Lucro Certo a qualquer ferramenta externa. Com os Webhooks, você recebe notificações automáticas de pagamentos, novos leads e status de cobrança em tempo real.</p>
                    </div>
                    <div className="faq-item" style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                        <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-dark)' }}>O que é o Clube de Fidelidade?</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>É um módulo que permite criar planos de assinatura para seus clientes. Eles pagam um valor mensal fixo e têm direito a benefícios como descontos em serviços, cashback ou atendimentos exclusivos, tudo faturado automaticamente.</p>
                    </div>
                    <div className="faq-item" style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                        <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-dark)' }}>O sistema emite notas fiscais para todo o Brasil?</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Sim! O Lucro Certo está integrado com os principais webservices nacionais, suportando a emissão de NFS-e para milhares de cidades e NF-e de produtos para todos os estados brasileiros.</p>
                    </div>
                    <div className="faq-item" style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                        <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-dark)' }}>O Lucro Certo é seguro?</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Sim. Utilizamos criptografia de nível bancário e servidores seguros na AWS e Supabase para garantir que seus dados financeiros e de clientes estejam sempre protegidos.</p>
                    </div>
                </div>
            </section>

            {/* Pricing */}
            {landingPlans.length > 0 && (
                <section id="pricing" className="pricing-section">
                    <div className="section-header">
                        <h2>O Plano Certo para Você</h2>
                        <p>Sem taxas escondidas. Transparência total para o seu lucro.</p>
                    </div>

                    <div className="pricing-grid">
                        {landingPlans.map((plan, idx) => (
                            <div key={idx} className={`pricing-card ${plan.is_popular ? 'popular' : ''}`}>
                                {plan.is_popular && <div className="popular-badge">Mais Popular</div>}
                                <h3>{plan.name}</h3>
                                <div className="price">{currencySymbol} {plan.price}<span>/{plan.period}</span></div>
                                {plan.observation && (
                                    <div className="text-sm font-medium mb-4 px-2" style={{ color: "var(--primary-color, #2563eb)", marginTop: "-10px" }}>
                                        {plan.observation}
                                    </div>
                                )}
                                <ul className="feature-list" style={{ textAlign: 'left', marginBottom: '2rem' }}>
                                    {plan.features.map((feat: string, fIdx: number) => (
                                        <li key={fIdx}>
                                            <CheckCircle2 size={18} className="check-icon" />
                                            {feat.startsWith('**') && feat.endsWith('**') ?
                                                <strong>{feat.replace(/\*\*/g, '')}</strong> :
                                                feat
                                            }
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    onClick={() => handleDynamicCheckout(plan)}
                                    className={`btn-pricing ${plan.button_type === 'primary' ? 'btn-primary' : 'btn-secondary'} flex items-center justify-center gap-2`}
                                >
                                    {plan.button_text}
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Footer */}
            <footer style={{ padding: '4rem 5%', borderTop: '1px solid var(--glass-border)', textAlign: 'center' }}>
                <div className="nav-logo" style={{ justifyContent: 'center', marginBottom: '1.5rem' }}>
                    <img src={logoFull} alt="Lucro Certo" className="h-8 md:h-10 w-auto" />
                </div>
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                    © 2026 Lucro Certo. Todos os direitos reservados.
                </p>
                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
                    <a href="#" className="nav-link">Privacidade</a>
                    <a href="#" className="nav-link">Termos de Uso</a>
                    <a href="#" className="nav-link">Suporte</a>
                </div>
            </footer>
            {/* Video Modal */}
            {isVideoModalOpen && (
                <div className="video-modal-overlay" onClick={() => setIsVideoModalOpen(false)}>
                    <div className="video-modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="video-modal-close" onClick={() => setIsVideoModalOpen(false)}>
                            <X size={24} />
                        </button>
                        <div className="video-wrapper">
                            <iframe
                                width="100%"
                                height="100%"
                                src="https://www.youtube.com/embed/vDxFacAITnA?autoplay=1"
                                title="Apresentação Lucro Certo"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            ></iframe>
                        </div>
                    </div>
                </div>
            )}

            {/* Banner Modal */}
            {showBanner && landingCampaigns.filter(c => c.show_in_popup).length > 0 && (
                (() => {
                    const popupCampaigns = landingCampaigns.filter(c => c.show_in_popup);
                    const currentCampaign = popupCampaigns[activePopupIndex];
                    if (!currentCampaign) return null;
                    
                    return (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                            <div 
                                className={`relative bg-white dark:bg-slate-800 rounded-3xl w-full ${
                                    currentCampaign.image_url 
                                        ? 'max-w-4xl md:h-[480px] h-[85vh] grid grid-cols-1 md:grid-cols-2' 
                                        : 'max-w-[400px] h-[480px] max-h-[80vh] flex flex-col'
                                } shadow-2xl animate-in zoom-in-95 duration-300 border-2 overflow-hidden ${
                                    currentCampaign.type === 'alert' ? 'border-amber-500 shadow-amber-500/20' :
                                    currentCampaign.type === 'info' ? 'border-blue-500 shadow-blue-500/20' :
                                    'border-purple-500 shadow-purple-500/20'
                                }`}
                                style={{
                                    backgroundImage: 'url(/images/landing/modal-bg.png)',
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center'
                                }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-t from-white/95 via-white/70 to-transparent dark:from-slate-900/95 dark:via-slate-900/70 dark:to-transparent z-0 pointer-events-none"></div>

                                <button 
                                    onClick={() => {
                                        setShowBanner(false);
                                        setLeadName('');
                                        setLeadPhone('');
                                        setLeadEmail('');
                                    }}
                                    className="absolute top-4 right-4 p-1.5 bg-white/80 dark:bg-slate-700/80 hover:bg-white dark:hover:bg-slate-600 rounded-full transition-colors z-30 backdrop-blur-md shadow-sm border border-gray-200/50 dark:border-slate-600/50"
                                >
                                    <X size={18} className="text-gray-600 dark:text-gray-300" />
                                </button>
                                
                                {popupCampaigns.length > 1 && !isLeadFormActive && (
                                    <>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setActivePopupIndex(prev => (prev - 1 + popupCampaigns.length) % popupCampaigns.length); }}
                                            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-700 rounded-full shadow-md z-20 backdrop-blur-md transition-colors border border-gray-200/50 dark:border-slate-600/50 text-gray-700 dark:text-gray-200"
                                        >
                                            <ChevronLeft size={20} />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setActivePopupIndex(prev => (prev + 1) % popupCampaigns.length); }}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-700 rounded-full shadow-md z-20 backdrop-blur-md transition-colors border border-gray-200/50 dark:border-slate-600/50 text-gray-700 dark:text-gray-200"
                                        >
                                            <ChevronRight size={20} />
                                        </button>
                                    </>
                                )}
                                
                                {currentCampaign.image_url ? (
                                    <>
                                        {/* Left Column (Image) */}
                                        <div className="w-full h-[260px] md:h-full relative overflow-hidden z-10 shadow-[0_5px_15px_rgba(0,0,0,0.15)] md:shadow-[5px_0_20px_rgba(0,0,0,0.12)] border-b md:border-b-0 md:border-r border-gray-100/50 dark:border-slate-700/30 flex items-center justify-center">
                                            {/* Blurred background image for premium color matching aura */}
                                            <div 
                                                className="absolute inset-0 bg-cover bg-center filter blur-2xl opacity-100 scale-110 pointer-events-none"
                                                style={{ backgroundImage: `url(${currentCampaign.image_url})` }}
                                            />
                                            {/* Proportional foreground image */}
                                            <img 
                                                src={currentCampaign.image_url} 
                                                alt="Banner" 
                                                className="relative z-10 max-w-full max-h-full p-4 drop-shadow-lg rounded-3xl" 
                                                style={{ objectFit: 'contain' }}
                                            />
                                            {/* Gradient overlay for depth */}
                                            <div className="absolute inset-0 bg-gradient-to-r from-black/15 via-transparent to-black/5 pointer-events-none z-20"></div>
                                        </div>

                                        {/* Right Column (Content) */}
                                        <div className="relative z-20 flex flex-col justify-between p-6 md:p-8 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md h-[calc(85vh-260px)] md:h-full min-h-0 animate-in fade-in duration-300 w-full">
                                            {isLeadSuccess ? (
                                                <div className="flex flex-col items-center justify-center text-center p-6 gap-4 h-full my-auto animate-in fade-in duration-350 w-full">
                                                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/10 animate-bounce">
                                                        <CheckCircle2 size={32} />
                                                    </div>
                                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Cadastro Confirmado!</h3>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[280px]">Seus dados foram enviados com sucesso para processamento.</p>
                                                    <button 
                                                        onClick={() => { setShowBanner(false); setIsLeadSuccess(false); }}
                                                        className="mt-4 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-500/20"
                                                    >
                                                        Fechar
                                                    </button>
                                                </div>
                                            ) : isLeadFormActive ? (
                                                <form onSubmit={(e) => handleLeadSubmit(e, currentCampaign)} className="flex flex-col gap-3 text-left w-full h-full justify-between">
                                                    <div className="space-y-3 flex-grow overflow-y-auto pr-1">
                                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Preencha seus dados</h3>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">Por favor, insira as informações obrigatórias para prosseguir.</p>
                                                        
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Nome Completo *</label>
                                                            <input 
                                                                type="text" 
                                                                required 
                                                                value={leadName} 
                                                                onChange={(e) => setLeadName(e.target.value.toUpperCase())} 
                                                                placeholder="SEU NOME COMPLETO" 
                                                                className="w-full text-xs p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:border-purple-500 text-gray-900 dark:text-white"
                                                                style={{ textTransform: 'uppercase' }}
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">WhatsApp / Telefone *</label>
                                                            <input 
                                                                type="tel" 
                                                                required 
                                                                value={leadPhone} 
                                                                onChange={(e) => setLeadPhone(formatWhatsAppMask(e.target.value))} 
                                                                placeholder="55(84) 9 9807-1213" 
                                                                className="w-full text-xs p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:border-purple-500 text-gray-900 dark:text-white"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">E-mail (Opcional)</label>
                                                            <input 
                                                                type="email" 
                                                                value={leadEmail} 
                                                                onChange={(e) => setLeadEmail(e.target.value.toUpperCase())} 
                                                                placeholder="SEU-EMAIL@DOMINIO.COM" 
                                                                className="w-full text-xs p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:border-purple-500 text-gray-900 dark:text-white"
                                                                style={{ textTransform: 'uppercase' }}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="shrink-0 flex gap-2 w-full mt-2">
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setIsLeadFormActive(false)} 
                                                            className="flex-1 px-3 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 font-bold rounded-lg text-xs transition-all"
                                                        >
                                                            Voltar
                                                        </button>
                                                        <button 
                                                            type="submit" 
                                                            className={`flex-[2] text-center px-4 py-2 rounded-lg font-bold text-white transition-all transform hover:scale-[1.02] shadow-lg text-xs ${
                                                                currentCampaign.type === 'alert' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30' :
                                                                currentCampaign.type === 'info' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30' :
                                                                'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-500/30'
                                                            }`}
                                                        >
                                                            Finalizar Cadastro
                                                        </button>
                                                    </div>
                                                </form>
                                            ) : (
                                                <>
                                                    <div className="shrink-0 text-left">
                                                        <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mb-3 tracking-tight leading-tight">{currentCampaign.title}</h2>
                                                    </div>

                                                    <div className="overflow-y-auto px-1 pb-2 mt-1 mb-4 flex-grow custom-scrollbar">
                                                        <div className="text-gray-600 dark:text-gray-300 whitespace-pre-line text-sm leading-relaxed text-left">
                                                            {formatTextWithBold(currentCampaign.subtitle)}
                                                        </div>
                                                    </div>
                                                    
                                                    {currentCampaign.price && (
                                                        <div className="shrink-0 w-full flex items-center justify-center mb-4 px-4 py-3 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 shadow-sm rounded-2xl">
                                                            {renderPriceHighlight(currentCampaign.price)}
                                                        </div>
                                                    )}
                                                    <div className="shrink-0 w-full flex flex-col gap-3 items-center md:items-start">
                                                        {currentCampaign.call_to_action && currentCampaign.link && (
                                                            <button 
                                                                onClick={() => setIsLeadFormActive(true)}
                                                                className={`inline-block w-full text-center px-8 py-3 rounded-xl font-bold text-white transition-all transform hover:scale-[1.02] shadow-lg text-sm ${
                                                                    currentCampaign.type === 'alert' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30' :
                                                                    currentCampaign.type === 'info' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30' :
                                                                    'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-500/30'
                                                                }`}
                                                            >
                                                                {currentCampaign.call_to_action}
                                                            </button>
                                                        )}
                                                        
                                                        {popupCampaigns.length > 1 && (
                                                            <div className="flex justify-center w-full gap-2 mt-2">
                                                                {popupCampaigns.map((_, idx) => (
                                                                    <button
                                                                        key={idx}
                                                                        onClick={() => setActivePopupIndex(idx)}
                                                                        className={`w-2 h-2 rounded-full transition-all ${idx === activePopupIndex ? 'bg-purple-600 w-4' : 'bg-gray-300'}`}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="relative z-20 flex flex-col w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md min-h-0 text-center p-6 md:p-8 h-full justify-between animate-in fade-in duration-300">
                                        {isLeadSuccess ? (
                                            <div className="flex flex-col items-center justify-center text-center p-6 gap-4 h-full my-auto animate-in fade-in duration-350 w-full">
                                                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/10 animate-bounce">
                                                    <CheckCircle2 size={32} />
                                                </div>
                                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Cadastro Confirmado!</h3>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[280px]">Seus dados foram enviados com sucesso para processamento.</p>
                                                <button 
                                                    type="button"
                                                    onClick={() => { setShowBanner(false); setIsLeadSuccess(false); }}
                                                    className="mt-4 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-500/20"
                                                >
                                                    Fechar
                                                </button>
                                            </div>
                                        ) : isLeadFormActive ? (
                                            <form onSubmit={(e) => handleLeadSubmit(e, currentCampaign)} className="flex flex-col gap-3 text-left w-full h-full justify-between">
                                                <div className="space-y-3 flex-grow overflow-y-auto pr-1">
                                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Preencha seus dados</h3>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">Por favor, insira as informações obrigatórias para prosseguir.</p>
                                                    
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Nome Completo *</label>
                                                        <input 
                                                            type="text" 
                                                            required 
                                                            value={leadName} 
                                                            onChange={(e) => setLeadName(e.target.value.toUpperCase())} 
                                                            placeholder="SEU NOME COMPLETO" 
                                                            className="w-full text-xs p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:border-purple-500 text-gray-900 dark:text-white"
                                                            style={{ textTransform: 'uppercase' }}
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">WhatsApp / Telefone *</label>
                                                        <input 
                                                            type="tel" 
                                                            required 
                                                            value={leadPhone} 
                                                            onChange={(e) => setLeadPhone(formatWhatsAppMask(e.target.value))} 
                                                            placeholder="55(84) 9 9807-1213" 
                                                            className="w-full text-xs p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:border-purple-500 text-gray-900 dark:text-white"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">E-mail (Opcional)</label>
                                                        <input 
                                                            type="email" 
                                                            value={leadEmail} 
                                                            onChange={(e) => setLeadEmail(e.target.value.toUpperCase())} 
                                                            placeholder="SEU-EMAIL@DOMINIO.COM" 
                                                            className="w-full text-xs p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:border-purple-500 text-gray-900 dark:text-white"
                                                            style={{ textTransform: 'uppercase' }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="shrink-0 flex gap-2 w-full mt-4">
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setIsLeadFormActive(false)} 
                                                        className="flex-1 px-3 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 font-bold rounded-lg text-xs transition-all"
                                                    >
                                                        Voltar
                                                    </button>
                                                    <button 
                                                        type="submit" 
                                                        className={`flex-[2] text-center px-4 py-2 rounded-lg font-bold text-white transition-all transform hover:scale-[1.02] shadow-lg text-xs ${
                                                            currentCampaign.type === 'alert' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30' :
                                                            currentCampaign.type === 'info' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30' :
                                                            'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-500/30'
                                                        }`}
                                                    >
                                                        Finalizar Cadastro
                                                    </button>
                                                </div>
                                            </form>
                                        ) : (
                                            <>
                                                <div className="shrink-0">
                                                    {currentCampaign.type === 'promo' && (
                                                        <div className="w-12 h-12 mx-auto mb-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-purple-200 dark:shadow-none">
                                                            <Sparkles size={24} />
                                                        </div>
                                                    )}
                                                    {currentCampaign.type === 'info' && (
                                                        <div className="w-12 h-12 mx-auto mb-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none">
                                                            <Award size={24} />
                                                        </div>
                                                    )}
                                                    {currentCampaign.type === 'alert' && (
                                                        <div className="w-12 h-12 mx-auto mb-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full flex items-center justify-center shadow-lg shadow-amber-200 dark:shadow-none">
                                                            <AlertTriangle size={24} />
                                                        </div>
                                                    )}
                                                    
                                                    <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mb-3 tracking-tight leading-tight">{currentCampaign.title}</h2>
                                                </div>

                                                <div className="overflow-y-auto px-1 pb-2 mt-1 mb-4 flex-grow custom-scrollbar">
                                                    <div className="text-gray-600 dark:text-gray-300 whitespace-pre-line text-sm leading-relaxed text-left">
                                                        {formatTextWithBold(currentCampaign.subtitle)}
                                                    </div>
                                                </div>
                                                
                                                {currentCampaign.price && (
                                                    <div className="shrink-0 w-full flex items-center justify-center mb-4 px-4 py-3 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 shadow-sm rounded-2xl">
                                                        {renderPriceHighlight(currentCampaign.price)}
                                                    </div>
                                                )}
                                                <div className="shrink-0 w-full flex flex-col gap-3 items-center">
                                                    {currentCampaign.call_to_action && currentCampaign.link && (
                                                        <button 
                                                            onClick={() => setIsLeadFormActive(true)}
                                                            className={`inline-block w-full text-center px-8 py-3 rounded-xl font-bold text-white transition-all transform hover:scale-[1.02] shadow-lg text-sm ${
                                                                currentCampaign.type === 'alert' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30' :
                                                                currentCampaign.type === 'info' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30' :
                                                                'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-500/30'
                                                            }`}
                                                        >
                                                            {currentCampaign.call_to_action}
                                                        </button>
                                                    )}
                                                    
                                                    {popupCampaigns.length > 1 && (
                                                        <div className="flex justify-center w-full gap-2 mt-2">
                                                            {popupCampaigns.map((_, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    onClick={() => setActivePopupIndex(idx)}
                                                                    className={`w-2 h-2 rounded-full transition-all ${idx === activePopupIndex ? 'bg-purple-600 w-4' : 'bg-gray-300'}`}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()
            )}

            {isUnpaid && <PaymentRequired />}
        </div>
    );
}
