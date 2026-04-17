import { useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
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
    Award
} from 'lucide-react';

// Import banner images
import bannerFinancial from '../../assets/landing/landing_hero_financial.png';
import bannerRadar from '../../assets/landing/landing_hero_radar_leads.png';
import bannerMarketing from '../../assets/landing/landing_hero_marketing_ia.png';
import bannerQuotes from '../../assets/landing/landing_hero_quotes.png';
import bannerCRM from '../../assets/landing/landing_hero_crm.png';
import bannerWhatsApp from '../../assets/landing/landing_hero_whatsapp.png';
import bannerMulticompany from '../../assets/landing/landing_hero_multicompany.png';
import bannerLoyalty from '../../assets/landing/landing_hero_loyalty.png';
import bannerMulticurrency from '../../assets/landing/landing_hero_multicurrency.png';
import bannerMarketingCopilot from '../../assets/landing/landing_hero_marketing_copilot.png';

interface Banner {
    tag: string;
    tagIcon: ReactNode;
    tagColor: string;
    tagTextColor: string;
    title: ReactNode;
    description: string;
    points: string[];
    image: string;
    accent: string;
}

const banners: Banner[] = [
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
    },
    {
        tag: 'CONTROLE GLOBAL 2.0',
        tagIcon: <DollarSign size={16} />,
        tagColor: 'rgba(212, 175, 55, 0.1)',
        tagTextColor: '#d4af37',
        title: <>Sua Empresa em <span className="text-gradient">Qualquer Moeda</span></>,
        description: 'BRL, USD, EUR ou PYG. Agora o Lucro Certo aceita transações em múltiplas moedas com conversão inteligente.',
        points: ['Gestão Multi-Moedas', 'Taxas de Câmbio em Tempo Real', 'Relatórios Globais Consolidados'],
        image: bannerMulticurrency,
        accent: 'gold'
    },
    {
        tag: 'MARKETING COPILOT',
        tagIcon: <Sparkles size={16} />,
        tagColor: 'rgba(99, 102, 241, 0.1)',
        tagTextColor: '#6366f1',
        title: <>Sua Marca no <span className="text-gradient">Piloto Automático</span></>,
        description: 'Brand Kit completo com logo, cores e IA que gera posts e vídeos sincronizados com seu DNA.',
        points: ['Brand Kit Personalizado', 'Geração de Vídeos IA (Kling/Google)', 'Postagem Automática Agendada'],
        image: bannerMarketingCopilot,
        accent: 'indigo'
    },
    {
        tag: 'CLUBE DE FIDELIDADE',
        tagIcon: <Award size={16} />,
        tagColor: 'rgba(79, 70, 229, 0.1)',
        tagTextColor: '#4f46e5',
        title: <>Crie um <span className="text-gradient">Clube de Vantagens</span> Lucrativo</>,
        description: 'Venda assinaturas recorrentes para seus clientes. Planos de cashback, serviços e benefícios automáticos direto no sistema.',
        points: ['Faturamento Recorrente Mensal', 'Portal de Assinante Exclusivo', 'Régua de Cobrança (WhatsApp)'],
        image: bannerLoyalty,
        accent: 'indigo'
    }
];

interface HeroCarouselProps {
    session: any;
    setIsVideoModalOpen: (open: boolean) => void;
}

export function HeroCarousel({ session, setIsVideoModalOpen }: HeroCarouselProps) {
    const navigate = useNavigate();
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % banners.length);
        }, 8000);
        return () => clearInterval(timer);
    }, []);

    const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % banners.length);
    const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length);

    return (
        <>
            <div className="landing-bg-glow" aria-hidden="true">
                <div className={`glow-1 accent-${banners[currentSlide].accent}`}></div>
                <div className={`glow-2 accent-${banners[currentSlide].accent}`}></div>
            </div>

            <header className="hero-section carousel-mode">
                <div 
                    className="carousel-track" 
                    style={{ 
                        transform: `translateX(-${currentSlide * 100}%)`,
                        willChange: 'transform'
                    }}
                >
                    {banners.map((banner, index) => {
                        const isActive = currentSlide === index;
                        // Optimization: Avoid rendering detailed content for slides far away
                        // but since the slide needs to exist for the transform animation, 
                        // we use visibility and display hints.
                        return (
                            <div 
                                key={index} 
                                className="carousel-slide-content" 
                                aria-hidden={!isActive}
                                style={{ 
                                    visibility: Math.abs(currentSlide - index) <= 1 ? 'visible' : 'hidden',
                                    pointerEvents: isActive ? 'auto' : 'none'
                                }}
                            >
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
                                        <button onClick={() => navigate(session ? '/dashboard' : '/login?mode=signup&checkout-plan=trial&checkout-price=0')} className="btn-primary">
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
                                            loading={index === 0 ? "eager" : "lazy"}
                                            width="550"
                                            height="400"
                                        />
                                        <div className={`image-glow accent-${banner.accent}`}></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Carousel Controls */}
                <div className="carousel-controls">
                    <button onClick={prevSlide} className="carousel-nav-btn prev" aria-label="Slide Anterior">
                        <ArrowLeft size={16} strokeWidth={1.5} />
                    </button>
                    <div className="carousel-dots">
                        {banners.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentSlide(index)}
                                className={`carousel-dot ${currentSlide === index ? 'active' : ''}`}
                                aria-label={`Ir para slide ${index + 1}`}
                            />
                        ))}
                    </div>
                    <button onClick={nextSlide} className="carousel-nav-btn next" aria-label="Próximo Slide">
                        <ArrowRight size={16} strokeWidth={1.5} />
                    </button>
                </div>
            </header>
        </>
    );
}
