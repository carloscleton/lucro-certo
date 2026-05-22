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

// Import images used in detailed feature sections
import bannerMarketingCopilot from '../assets/landing/landing_hero_marketing_copilot.png';
import bannerMulticurrency from '../assets/landing/landing_hero_multicurrency.png';
import bannerLoyalty from '../assets/landing/landing_hero_loyalty.png';
import bannerFiscal from '../assets/landing/landing_hero_fiscal_management.png';
import bannerCRM from '../assets/landing/landing_hero_crm.png';
import bannerQuotes from '../assets/landing/landing_hero_quotes.png';
import bannerWhatsApp from '../assets/landing/landing_hero_whatsapp.png';
import bannerMulticompany from '../assets/landing/landing_hero_multicompany.png';

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
                        const active = activeCampaigns.filter((c: any) => c.is_active);
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
        if (showBanner && landingCampaigns.length > 0) {
            const popupCampaigns = landingCampaigns.filter(c => c.show_in_popup);
            if (popupCampaigns.length <= 1) return;
            const timer = setInterval(() => {
                setActivePopupIndex(prev => (prev + 1) % popupCampaigns.length);
            }, 6000); // 6 seconds slide
            return () => clearInterval(timer);
        }
    }, [showBanner, landingCampaigns]);

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

    return (
        <div className="landing-container">
            {/* Nav and Background */}
            <nav className="landing-nav">
                <div className="nav-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
                    <img src={logoFull} alt="Lucro Certo" className="h-12 w-auto" style={{ height: '48px' }} />
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
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {session ? (
                        <Link to="/dashboard" className="nav-btn">Acessar Sistema</Link>
                    ) : (
                        <>
                            <Link to="/login" className="nav-link">Acessar Conta</Link>
                            <Link to="/login?mode=signup" className="nav-btn">Começar Agora</Link>
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
                            {campaign.call_to_action && campaign.link && (
                                <a 
                                    href={campaign.link} 
                                    className="inline-block px-8 py-3 rounded-xl font-bold text-white transition-all transform hover:scale-105 shadow-lg text-base bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/30"
                                >
                                    {campaign.call_to_action}
                                </a>
                            )}
                        </div>
                        <div className="visual-image-container">
                            <img
                                src={campaign.image_url || "/images/landing/certificado-digital.png"}
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
                    <img src={logoFull} alt="Lucro Certo" className="h-10 w-auto" style={{ height: '40px' }} />
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
                                className={`relative bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-300 border-2 flex flex-col max-h-[85vh] overflow-hidden ${
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
                                    onClick={() => setShowBanner(false)}
                                    className="absolute top-3 right-3 p-1.5 bg-white/80 dark:bg-slate-700/80 hover:bg-white dark:hover:bg-slate-600 rounded-full transition-colors z-30 backdrop-blur-md shadow-sm border border-gray-200/50 dark:border-slate-600/50"
                                >
                                    <X size={18} className="text-gray-600 dark:text-gray-300" />
                                </button>
                                
                                {popupCampaigns.length > 1 && (
                                    <>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setActivePopupIndex(prev => (prev - 1 + popupCampaigns.length) % popupCampaigns.length); }}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-700 rounded-full shadow-md z-20 backdrop-blur-md transition-colors border border-gray-200/50 dark:border-slate-600/50 text-gray-700 dark:text-gray-200"
                                        >
                                            <ChevronLeft size={20} />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setActivePopupIndex(prev => (prev + 1) % popupCampaigns.length); }}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-700 rounded-full shadow-md z-20 backdrop-blur-md transition-colors border border-gray-200/50 dark:border-slate-600/50 text-gray-700 dark:text-gray-200"
                                        >
                                            <ChevronRight size={20} />
                                        </button>
                                    </>
                                )}
                                
                                <div className="text-center relative z-10 flex flex-col flex-1 min-h-0 mt-4 px-6">
                                    <div className="shrink-0">
                                        {currentCampaign.image_url ? (
                                            <div className="w-full flex justify-center mb-6">
                                                <img src={currentCampaign.image_url} alt="Banner" className="w-full h-auto max-h-[300px] object-contain rounded-xl shadow-sm border border-gray-100 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm" />
                                            </div>
                                        ) : (
                                            <>
                                                {currentCampaign.type === 'promo' && (
                                                    <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-purple-200 dark:shadow-none">
                                                        <Sparkles size={32} />
                                                    </div>
                                                )}
                                                {currentCampaign.type === 'info' && (
                                                    <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none">
                                                        <Award size={32} />
                                                    </div>
                                                )}
                                                {currentCampaign.type === 'alert' && (
                                                    <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full flex items-center justify-center shadow-lg shadow-amber-200 dark:shadow-none">
                                                        <AlertTriangle size={32} />
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        
                                        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3 tracking-tight">{currentCampaign.title}</h2>
                                    </div>

                                    <div className="overflow-y-auto px-2 pb-2 mt-1 mb-4 flex-grow custom-scrollbar">
                                        <div className="text-gray-600 dark:text-gray-300 whitespace-pre-line text-[15px] leading-relaxed text-left">
                                            {formatTextWithBold(currentCampaign.subtitle)}
                                        </div>
                                    </div>
                                    
                                    <div className="shrink-0 flex flex-col gap-3 items-center">
                                        {currentCampaign.call_to_action && currentCampaign.link && (
                                            <a 
                                                href={currentCampaign.link} 
                                                onClick={() => setShowBanner(false)}
                                                className={`inline-block w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-white transition-all transform hover:scale-105 shadow-lg text-base ${
                                                    currentCampaign.type === 'alert' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30' :
                                                    currentCampaign.type === 'info' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30' :
                                                    'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-500/30'
                                                }`}
                                            >
                                                {currentCampaign.call_to_action}
                                            </a>
                                        )}
                                        
                                        {popupCampaigns.length > 1 && (
                                            <div className="flex justify-center gap-2 mt-2">
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
                                </div>
                            </div>
                        </div>
                    );
                })()
            )}

            {isUnpaid && <PaymentRequired />}
        </div>
    );
}
