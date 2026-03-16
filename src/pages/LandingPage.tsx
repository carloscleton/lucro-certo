import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Radar,
    Sparkles,
    BarChart3,
    ChevronRight,
    PlayCircle,
    CheckCircle2,
    DollarSign,
    Users,
    CreditCard,
    ArrowLeft,
    ArrowRight,
    X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logoFull from '../assets/logo-full.png';

// Import banner images
import bannerFinancial from '../assets/landing/landing_hero_financial.png';
import bannerRadar from '../assets/landing/landing_hero_radar_leads.png';
import bannerMarketing from '../assets/landing/landing_hero_marketing_ia.png';
import bannerQuotes from '../assets/landing/landing_hero_quotes.png';
import bannerCRM from '../assets/landing/landing_hero_crm.png';
import bannerWhatsApp from '../assets/landing/landing_hero_whatsapp.png';
import bannerMulticompany from '../assets/landing/landing_hero_multicompany.png';

import '../styles/LandingPage.css';

const banners = [
    {
        tag: 'GESTÃO FINANCEIRA 2.0',
        tagIcon: <BarChart3 size={16} />,
        tagColor: 'rgba(37, 99, 235, 0.1)',
        tagTextColor: '#2563eb',
        title: <>Domine suas Finanças com <span className="text-gradient">Inteligência</span></>,
        description: 'Muito além de um controle financeiro. O Lucro Certo oferece previsibilidade real e organização absoluta.',
        points: ['Fluxo de Caixa em Tempo Real', 'Conciliação Bancária Automática', 'Relatórios de Lucratividade'],
        image: bannerFinancial,
        accent: 'blue'
    },
    {
        tag: 'RADAR DE LEADS IA',
        tagIcon: <Radar size={16} />,
        tagColor: 'rgba(16, 185, 129, 0.1)',
        tagTextColor: '#10b981',
        title: <>A IA que <span className="text-gradient">Encontra Clientes</span> para Você</>,
        description: 'Nossa tecnologia mapeia o mercado, qualifica leads e inicia abordagens automáticas no WhatsApp.',
        points: ['Prospecção Direcionada', 'Qualificação por Perfil', 'Abordagem Automática (API)'],
        image: bannerRadar,
        accent: 'emerald'
    },
    {
        tag: 'MARKETING COPILOT',
        tagIcon: <Sparkles size={16} />,
        tagColor: 'rgba(99, 102, 241, 0.1)',
        tagTextColor: '#6366f1',
        title: <>Suas Redes Sociais no <span className="text-gradient">Piloto Automático</span></>,
        description: 'Crie cronogramas, artes e legendas profissionais em segundos direto do seu celular.',
        points: ['Gerador de Imagens IA', 'Legendas Persuasivas', 'Calendário de Postagens'],
        image: bannerMarketing,
        accent: 'indigo'
    },
    {
        tag: 'CRM & VENDAS',
        tagIcon: <Users size={16} />,
        tagColor: 'rgba(236, 72, 153, 0.1)',
        tagTextColor: '#ec4899',
        title: <>Transforme Leads em <span className="text-gradient">Clientes Fiéis</span></>,
        description: 'Gestão completa do pipeline de vendas. Organize seus contatos e nunca perca uma oportunidade.',
        points: ['Funil de Vendas Visual', 'Histórico de Interações', 'Automação de Follow-up'],
        image: bannerCRM,
        accent: 'pink'
    },
    {
        tag: 'ORÇAMENTOS PROFISSIONAIS',
        tagIcon: <DollarSign size={16} />,
        tagColor: 'rgba(245, 158, 11, 0.1)',
        tagTextColor: '#f59e0b',
        title: <>Propostas que <span className="text-gradient">Vendem por Você</span></>,
        description: 'Crie orçamentos lindíssimos em segundos e envie via WhatsApp para seus clientes.',
        points: ['Modelos Customizáveis', 'Assinatura Digital Rápida', 'Status de Leitura (WhatsApp)'],
        image: bannerQuotes,
        accent: 'amber'
    },
    {
        tag: 'AUTOMAÇÃO WHATSAPP',
        tagIcon: <CreditCard size={16} />,
        tagColor: 'rgba(20, 184, 166, 0.1)',
        tagTextColor: '#14b8a6',
        title: <>Régua de Cobrança <span className="text-gradient">Automática</span></>,
        description: 'Reduza a inadimplência com lembretes inteligentes de pagamento direto no app favorito.',
        points: ['Lembretes de Vencimento', 'Links de Pagamento Direto', 'Baixa Automática no Caixa'],
        image: bannerWhatsApp,
        accent: 'teal'
    },
    {
        tag: 'MULTI-EMPRESAS',
        tagIcon: <Users size={16} />,
        tagColor: 'rgba(107, 114, 128, 0.1)',
        tagTextColor: '#4b5563',
        title: <>Gerencie <span className="text-gradient">Vários Negócios</span></>,
        description: 'Troque entre empresas com um clique. Tenha uma visão consolidada de todas as suas unidades.',
        points: ['Consolidação de Dados', 'Acessos Diferenciados', 'Interligação de Estoques'],
        image: bannerMulticompany,
        accent: 'slate'
    }
];

export function LandingPage() {
    const navigate = useNavigate();
    const { session } = useAuth();
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % banners.length);
        }, 8000);
        return () => clearInterval(timer);
    }, []);

    const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % banners.length);
    const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="landing-container">
            <div className="landing-bg-glow">
                <div className={`glow-1 accent-${banners[currentSlide].accent}`}></div>
                <div className={`glow-2 accent-${banners[currentSlide].accent}`}></div>
            </div>

            {/* Navbar */}
            <nav className="landing-nav">
                <div className="nav-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
                    <img src={logoFull} alt="Lucro Certo" className="h-12 w-auto" style={{ height: '48px' }} />
                </div>
                <div className="nav-links">
                    <a href="#features" className="nav-link">Funcionalidades</a>
                    <a href="#ai" className="nav-link">Inteligência Artificial</a>
                    <a href="#pricing" className="nav-link">Planos</a>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {session ? (
                        <Link to="/dashboard" className="nav-btn">Acessar Sistema</Link>
                    ) : (
                        <>
                            <Link to="/login" className="nav-link">Acessar Conta</Link>
                            <Link to="/login" className="nav-btn">Começar Agora</Link>
                        </>
                    )}
                </div>
            </nav>

            {/* Hero Carousel Section */}
            <header className="hero-section carousel-mode">
                <div className="carousel-track" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
                    {banners.map((banner, index) => (
                        <div key={index} className="carousel-slide-content" aria-hidden={currentSlide !== index}>
                            <div className="hero-content">
                                <div className="banner-badge" style={{
                                    borderColor: banner.tagTextColor,
                                    color: banner.tagTextColor,
                                }}>
                                    {banner.tagIcon}
                                    {banner.tag}
                                </div>
                                <h1 className="animate-title">
                                    {banner.title}
                                </h1>
                                <p className="animate-p">
                                    {banner.description}
                                </p>

                                <div className="benefit-points">
                                    {banner.points.map((point, i) => (
                                        <div key={i} className="benefit-item" style={{ animationDelay: `${0.4 + i * 0.1}s` }}>
                                            <div className="benefit-dot">
                                                <CheckCircle2 size={12} />
                                            </div>
                                            {point}
                                        </div>
                                    ))}
                                </div>

                                <div className="carousel-global-actions">
                                    <button onClick={() => navigate(session ? '/dashboard' : '/login')} className="btn-primary">
                                        {session ? 'Ir para o Dashboard' : 'Teste Grátis por 7 dias'}
                                        <ChevronRight size={18} />
                                    </button>
                                    <button onClick={() => setIsVideoModalOpen(true)} className="btn-secondary">
                                        <PlayCircle size={18} />
                                        Conhecer Sistema
                                    </button>
                                </div>
                                <div className="hero-stats animate-stats">
                                    <div className="mini-stat">
                                        <span className="stat-val">+R$ 2.4M</span>
                                        <span className="stat-desc">Transacionados</span>
                                    </div>
                                    <div className="mini-divider"></div>
                                    <div className="mini-stat">
                                        <span className="stat-val">1.2k+</span>
                                        <span className="stat-desc">Empresas Ativas</span>
                                    </div>
                                </div>
                            </div>

                            <div className="hero-image-container animate-image">
                                <div className="image-wrapper">
                                    <img
                                        src={banner.image}
                                        alt={banner.tag}
                                        className="hero-mockup"
                                    />
                                    <div className={`image-glow accent-${banner.accent}`}></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Carousel Controls */}
                <div className="carousel-controls">
                    <button onClick={prevSlide} className="carousel-nav-btn prev">
                        <ArrowLeft size={16} strokeWidth={1.5} />
                    </button>
                    <div className="carousel-dots">
                        {banners.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentSlide(index)}
                                className={`carousel-dot ${currentSlide === index ? 'active' : ''}`}
                            />
                        ))}
                    </div>
                    <button onClick={nextSlide} className="carousel-nav-btn next">
                        <ArrowRight size={16} strokeWidth={1.5} />
                    </button>
                </div>
            </header>

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
                            src="/images/landing/marketing-ia.png"
                            alt="Marketing IA Feature"
                            className="visual-image"
                        />
                    </div>
                    <div className="visual-content">
                        <div style={{ color: '#6366f1', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Sparkles size={20} />
                            MARKETING COPILOT
                        </div>
                        <h3>Suas Redes Sociais no Piloto Automático</h3>
                        <p>
                            Chega de perder horas pensando no que postar. O Copilot cria cronogramas, artes e legendas profissionais sincronizadas com o DNA da sua marca.
                        </p>
                        <ul className="feature-list">
                            <li><CheckCircle2 size={18} className="check-icon" /> Geração de legendas com GPT-4</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> Criação de imagens e vídeos com IA</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> Postagem direta no Instagram e Facebook</li>
                        </ul>
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
            </section>

            {/* FAQ Section */}
            <section id="faq" className="features-section" style={{ background: 'rgba(37, 99, 235, 0.02)' }}>
                <div className="section-header">
                    <h2>Perguntas Frequentes</h2>
                    <p>Tudo o que você precisa saber para começar com segurança.</p>
                </div>
                <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="faq-item" style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                        <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-dark)' }}>O Lucro Certo é seguro?</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Sim. Utilizamos criptografia de nível bancário e servidores seguros na AWS e Supabase para garantir que seus dados financeiros e de clientes estejam sempre protegidos.</p>
                    </div>
                    <div className="faq-item" style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                        <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-dark)' }}>Como funciona o Radar de Leads?</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Nossa IA varre fontes públicas e mapas para encontrar empresas no perfil que você definiu. Ela extrai contatos e já pode iniciar o primeiro contato via WhatsApp automaticamente.</p>
                    </div>
                    <div className="faq-item" style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                        <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-dark)' }}>Posso testar antes de assinar?</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Com certeza! Oferecemos 7 dias de teste grátis com acesso total às funcionalidades de gestão financeira para você conhecer o sistema na prática.</p>
                    </div>
                </div>
            </section>

            {/* Pricing */}
            <section id="pricing" className="pricing-section">
                <div className="section-header">
                    <h2>O Plano Certo para Você</h2>
                    <p>Sem taxas escondidas. Transparência total para o seu lucro.</p>
                </div>

                <div className="pricing-grid">
                    <div className="pricing-card">
                        <h3>Essencial</h3>
                        <div className="price">R$ 97<span>/mês</span></div>
                        <ul className="feature-list" style={{ textAlign: 'left', marginBottom: '2rem' }}>
                            <li><CheckCircle2 size={18} className="check-icon" /> Gestão Financeira Completa</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> CRM até 500 contatos</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> Relatórios Básicos</li>
                        </ul>
                        <button onClick={() => navigate('/login')} className="btn-secondary btn-pricing">Escolher Plano</button>
                    </div>

                    <div className="pricing-card popular">
                        <div className="popular-badge">Mais Popular</div>
                        <h3>Profissional + IA</h3>
                        <div className="price">R$ 197<span>/mês</span></div>
                        <ul className="feature-list" style={{ textAlign: 'left', marginBottom: '2rem' }}>
                            <li><CheckCircle2 size={18} className="check-icon" /> Tudo do Essencial</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> **Radar de Leads (IA)**</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> **Marketing Copilot (IA)**</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> WhatsApp Ilimitado</li>
                        </ul>
                        <button onClick={() => navigate('/login')} className="btn-primary btn-pricing">Começar agora</button>
                    </div>

                    <div className="pricing-card">
                        <h3>Empresarial</h3>
                        <div className="price">R$ 497<span>/mês</span></div>
                        <ul className="feature-list" style={{ textAlign: 'left', marginBottom: '2rem' }}>
                            <li><CheckCircle2 size={18} className="check-icon" /> Tudo do Profissional</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> Multi-empresas (até 5)</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> Suporte VIP 24h</li>
                            <li><CheckCircle2 size={18} className="check-icon" /> API de Integração</li>
                        </ul>
                        <button onClick={() => navigate('/login')} className="btn-secondary btn-pricing">Falar com Consultor</button>
                    </div>
                </div>
            </section>

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
                            {/* Placeholder para o vídeo do usuário. Pode ser iframe do YouTube ou tag <video> */}
                            <iframe
                                width="100%"
                                height="100%"
                                src="https://www.youtube.com/embed/ScMzIvxBSi4?autoplay=1"
                                title="Apresentação Lucro Certo"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            ></iframe>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
