import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Radar,
    Sparkles,
    BarChart3,
    ChevronRight,
    PlayCircle,
    CheckCircle2,
    DollarSign,
    Users
} from 'lucide-react';
import '../styles/LandingPage.css';
import logoFull from '../assets/logo-full.png';

export function LandingPage() {
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="landing-container">
            <div className="landing-bg-glow">
                <div className="glow-1"></div>
                <div className="glow-2"></div>
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
                    <Link to="/login" className="nav-link">Acessar Conta</Link>
                    <Link to="/login" className="nav-btn">Começar Agora</Link>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="hero-section">
                <div className="hero-content">
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '100px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', marginBottom: '1.5rem', fontSize: '0.85rem', fontWeight: 'bold' }}>
                        <Sparkles size={16} />
                        NOVA VERSÃO 2.0 COM IA GENERATIVA
                    </div>
                    <h1>
                        O Sistema Financeiro que <span className="text-gradient">Encontra Clientes</span> para Você
                    </h1>
                    <p>
                        Muito além de um controle financeiro. O Lucro Certo utiliza IA de ponta para prospectar leads, vender no automático e organizar sua empresa em um só lugar.
                    </p>
                    <div className="hero-actions">
                        <button onClick={() => navigate('/login')} className="btn-primary">
                            Teste Grátis por 7 dias
                            <ChevronRight size={20} />
                        </button>
                        <button className="btn-secondary">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <PlayCircle size={20} />
                                Ver Vídeo
                            </div>
                        </button>
                    </div>

                    <div style={{ marginTop: '3rem', display: 'flex', gap: '2rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>+R$ 2.4M</span>
                            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Transacionados</span>
                        </div>
                        <div style={{ width: '1px', height: '40px', background: 'rgba(255,255,255,0.1)' }}></div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>1.2k+</span>
                            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Empresas Ativas</span>
                        </div>
                    </div>
                </div>

                <div className="hero-image-container">
                    <img
                        src="/images/landing/hero-mockup.png"
                        alt="Lucro Certo Dashboard Mockup"
                        className="hero-mockup"
                    />
                </div>
            </header>

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
        </div>
    );
}
