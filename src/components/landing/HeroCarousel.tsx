import { useState, useEffect, type ReactNode } from 'react';
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
    Award,
    Receipt,
    ShieldCheck
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
import bannerFiscal from '../../assets/landing/landing_hero_fiscal_management.png';
import bannerCertificado from '../../assets/landing/landing_hero_certificado_digital.png';

interface Banner {
    tag: string;
    tagIcon: ReactNode;
    tagColor: string;
    tagTextColor: string;
    title: ReactNode;
    description: string;
    points: string[];
    price?: string;
    image: string;
    accent: string;
    buttonText?: string;
    buttonLink?: string;
}

const formatTextWithBold = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return <strong key={index} className="font-bold">{part.slice(1, -1)}</strong>;
        }
        return <span key={index}>{part}</span>;
    });
};

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
        tag: 'GESTÃO FISCAL',
        tagIcon: <Receipt size={16} />,
        tagColor: 'rgba(16, 185, 129, 0.1)',
        tagTextColor: '#10b981',
        title: <>Emissão de <span className="text-gradient">Notas Fiscais</span> Simplificada</>,
        description: 'Emita NF-e e NFS-e em segundos diretamente do seu faturamento. Tudo sincronizado com as prefeituras e SEFAZ.',
        points: ['Emissão de NF-e e NFS-e', 'Histórico de PDF e XML', 'Sincronização Automática'],
        image: bannerFiscal,
        accent: 'emerald'
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
    landingCampaigns?: any[];
}

export function HeroCarousel({ session, setIsVideoModalOpen, landingCampaigns }: HeroCarouselProps) {
    const navigate = useNavigate();
    const [currentSlide, setCurrentSlide] = useState(0);

    // Compute active banners dynamically based on landingCampaigns
    const activeBanners = [...banners];
    
    if (landingCampaigns && landingCampaigns.length > 0) {
        const heroCampaigns = landingCampaigns.filter((c: any) => c.show_in_hero);
        
        // Add dynamic banners
        heroCampaigns.forEach((campaign, index) => {
            const fullText = campaign.subtitle || '';
            let lines = fullText.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
            
            // If they wrote everything in a single line with emojis, split by those
            if (lines.length === 1) {
                lines = fullText.split(/✅|🟢|🔵/).map((l: string) => l.trim()).filter((l: string) => l.length > 0);
            }

            let description = '';
            let points: string[] = [];

            if (lines.length > 0) {
                // First item is description if it doesn't look like a raw bullet point without context
                description = lines[0].replace(/^[✅🟢🔵\-\*\s]+/, '');
                
                // The rest are points, stripped of their emojis since the carousel has its own icons
                points = lines.slice(1).map((l: string) => l.replace(/^[✅🟢🔵\-\*\s]+/, '').trim());
            }
                
            // Limit to first 3 points for the carousel layout
            const displayPoints = points.slice(0, 3);
            
            // Make the last word of the title have a gradient, automatically!
            const titleWords = campaign.title.trim().split(' ');
            const lastWord = titleWords.length > 1 ? titleWords.pop() : '';
            const restOfTitle = titleWords.join(' ');

            // Insert custom campaigns early in the array
            activeBanners.splice(1 + index, 0, {
                tag: campaign.type === 'promo' ? 'OFERTA ESPECIAL' : campaign.type === 'info' ? 'NOVIDADE' : 'DESTAQUE',
                tagIcon: <ShieldCheck size={16} />,
                tagColor: 'rgba(16, 185, 129, 0.1)',
                tagTextColor: '#10b981',
                title: <>{restOfTitle} {lastWord && <span className="text-gradient">{lastWord}</span>}</>,
                description: description,
                points: displayPoints,
                price: campaign.price,
                image: campaign.hero_image_url || bannerCertificado,
                accent: 'emerald',
                buttonText: campaign.call_to_action,
                buttonLink: campaign.link
            });
        });
    }

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % activeBanners.length);
        }, 8000);
        return () => clearInterval(timer);
    }, [activeBanners.length]);

    const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % activeBanners.length);
    const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + activeBanners.length) % activeBanners.length);

    return (
        <>
            <div className="landing-bg-glow" aria-hidden="true">
                <div className={`glow-1 accent-${activeBanners[currentSlide]?.accent || 'blue'}`}></div>
                <div className={`glow-2 accent-${activeBanners[currentSlide]?.accent || 'blue'}`}></div>
            </div>

            <header className="hero-section carousel-mode">
                <div 
                    className="carousel-track" 
                    style={{ 
                        transform: `translateX(-${currentSlide * 100}%)`,
                        willChange: 'transform'
                    }}
                >
                    {activeBanners.map((banner, index) => {
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
                                        {formatTextWithBold(banner.description)}
                                    </p>

                                    <div className="benefit-points">
                                        {banner.points.map((point, i) => (
                                            <div key={i} className="benefit-item" style={{ animationDelay: `${0.4 + i * 0.1}s` }}>
                                                <div className="benefit-dot">
                                                    <CheckCircle2 size={12} />
                                                </div>
                                                {formatTextWithBold(point)}
                                            </div>
                                        ))}
                                    </div>

                                    {banner.price && (
                                        <div className="mb-2 mt-4 flex justify-center lg:justify-start">
                                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl w-fit">
                                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Apenas:</span>
                                                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{banner.price}</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="carousel-global-actions">
                                        {banner.buttonText && banner.buttonLink ? (
                                            <a 
                                                href={banner.buttonLink} 
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold text-white transition-all transform hover:scale-105 shadow-lg text-base bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/30"
                                            >
                                                {banner.buttonText}
                                                <ChevronRight size={18} />
                                            </a>
                                        ) : (
                                            <>
                                                <button onClick={() => navigate(session ? '/dashboard' : '/login?mode=signup&checkout-plan=trial&checkout-price=0')} className="btn-primary">
                                                    {session ? 'Ir para o Dashboard' : 'Teste Grátis por 7 dias'}
                                                    <ChevronRight size={18} />
                                                </button>
                                                <button onClick={() => setIsVideoModalOpen(true)} className="btn-secondary">
                                                    <PlayCircle size={18} />
                                                    Conhecer Sistema
                                                </button>
                                            </>
                                        )}
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
                                        <div className="hero-mockup" style={{ overflow: 'hidden' }}>
                                            <img
                                                src={banner.image}
                                                alt={banner.tag}
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover',
                                                    transform: banner.accent === 'emerald' && banner.image.includes('certificado') ? 'scale(1.25)' : 'none',
                                                    transition: 'transform 0.3s ease'
                                                }}
                                                loading={index === 0 ? "eager" : "lazy"}
                                                width="550"
                                                height="400"
                                            />
                                        </div>
                                        <div className={`image-glow accent-${activeBanners[currentSlide]?.accent || 'blue'}`}></div>
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
                        {activeBanners.map((_, index) => (
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
