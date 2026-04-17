import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Radar,
    Sparkles,
    BarChart3,
    CheckCircle2,
    DollarSign,
    Users,
    CreditCard,
    X,
    Award,
    Gift
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

import { HeroCarousel } from '../components/landing/HeroCarousel';

import '../styles/LandingPage.css';

const DEFAULT_PLANS: any[] = [
// ... (lines 152-180 kept as is)
];

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
    const [landingPlans, setLandingPlans] = useState<any[]>(DEFAULT_PLANS);
    const [selectedCurrency, setSelectedCurrency] = useState('BRL');
    const [currencySymbol, setCurrencySymbol] = useState('R$');

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const { data, error } = await supabase.from('app_settings').select('landing_plans').eq('id', 1).maybeSingle();
                if (error) {
                    console.error("Erro ao puxar planos do Supabase:", error);
                } else if (data?.landing_plans && Array.isArray(data.landing_plans)) {
                    // Only show enabled plans on the public landing page
                    const activePlans = data.landing_plans.filter((p: any) => p.enabled !== false);
                    setLandingPlans(activePlans);
                }
            } catch (err) {
                console.error("Erro ao puxar planos", err);
            }
        };
        fetchPlans();
    }, []);

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
            <HeroCarousel session={session} setIsVideoModalOpen={setIsVideoModalOpen} />

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
            </section>

            {/* AI Radar Highlight */}
            <section id="ai" className="features-section">
                <div className="visual-feature">
                    <div className="visual-image-container">
                        <img
                            src="/images/landing/ai-radar.png"
                            alt="AI Radar Feature"
                            className="visual-image"
                        />
                    </div>
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
                </div>

                <div className="visual-feature reverse">
                    <div className="visual-image-container">
                        <img
                            src={bannerMarketingCopilot}
                            alt="Marketing Copilot Feature"
                            className="visual-image"
                            style={{ borderRadius: '24px', boxShadow: '0 40px 80px -15px rgba(99, 102, 241, 0.3)' }}
                        />
                    </div>
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
                </div>

                {/* Multi-Currency Section */}
                <div className="visual-feature">
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
                    <div className="visual-image-container">
                        <img
                            src={bannerLoyalty}
                            alt="Clube de Fidelidade"
                            className="visual-image"
                            style={{ borderRadius: '24px', boxShadow: '0 40px 80px -15px rgba(79, 70, 229, 0.3)' }}
                        />
                    </div>
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
                </div>
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

            {isUnpaid && <PaymentRequired />}
        </div>
    );
}
