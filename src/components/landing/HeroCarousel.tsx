import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

interface HeroCarouselProps {
    session: any;
    setIsVideoModalOpen: (open: boolean) => void;
    landingCampaigns?: any[];
}

export function HeroCarousel({ session, setIsVideoModalOpen, landingCampaigns }: HeroCarouselProps) {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    const translatedBanners: Banner[] = [
        {
            tag: t('landing.carousel.banners.b1.tag'),
            tagIcon: <BarChart3 size={16} />,
            tagColor: 'rgba(37, 99, 235, 0.1)',
            tagTextColor: '#2563eb',
            title: <>{t('landing.carousel.banners.b1.title_p1')}<span className="text-gradient">{t('landing.carousel.banners.b1.title_p2')}</span></>,
            description: t('landing.carousel.banners.b1.desc'),
            points: [
                t('landing.carousel.banners.b1.p1'),
                t('landing.carousel.banners.b1.p2'),
                t('landing.carousel.banners.b1.p3')
            ],
            image: bannerFinancial,
            accent: 'blue'
        },
        {
            tag: t('landing.carousel.banners.b2.tag'),
            tagIcon: <Radar size={16} />,
            tagColor: 'rgba(16, 185, 129, 0.1)',
            tagTextColor: '#10b981',
            title: <>{t('landing.carousel.banners.b2.title_p1')}<span className="text-gradient">{t('landing.carousel.banners.b2.title_p2')}</span>{t('landing.carousel.banners.b2.title_p3')}</>,
            description: t('landing.carousel.banners.b2.desc'),
            points: [
                t('landing.carousel.banners.b2.p1'),
                t('landing.carousel.banners.b2.p2'),
                t('landing.carousel.banners.b2.p3')
            ],
            image: bannerRadar,
            accent: 'emerald'
        },
        {
            tag: t('landing.carousel.banners.b3.tag'),
            tagIcon: <Sparkles size={16} />,
            tagColor: 'rgba(99, 102, 241, 0.1)',
            tagTextColor: '#6366f1',
            title: <>{t('landing.carousel.banners.b3.title_p1')}<span className="text-gradient">{t('landing.carousel.banners.b3.title_p2')}</span></>,
            description: t('landing.carousel.banners.b3.desc'),
            points: [
                t('landing.carousel.banners.b3.p1'),
                t('landing.carousel.banners.b3.p2'),
                t('landing.carousel.banners.b3.p3')
            ],
            image: bannerMarketing,
            accent: 'indigo'
        },
        {
            tag: t('landing.carousel.banners.b4.tag'),
            tagIcon: <Users size={16} />,
            tagColor: 'rgba(236, 72, 153, 0.1)',
            tagTextColor: '#ec4899',
            title: <>{t('landing.carousel.banners.b4.title_p1')}<span className="text-gradient">{t('landing.carousel.banners.b4.title_p2')}</span></>,
            description: t('landing.carousel.banners.b4.desc'),
            points: [
                t('landing.carousel.banners.b4.p1'),
                t('landing.carousel.banners.b4.p2'),
                t('landing.carousel.banners.b4.p3')
            ],
            image: bannerCRM,
            accent: 'pink'
        },
        {
            tag: t('landing.carousel.banners.b5.tag'),
            tagIcon: <DollarSign size={16} />,
            tagColor: 'rgba(245, 158, 11, 0.1)',
            tagTextColor: '#f59e0b',
            title: <>{t('landing.carousel.banners.b5.title_p1')}<span className="text-gradient">{t('landing.carousel.banners.b5.title_p2')}</span></>,
            description: t('landing.carousel.banners.b5.desc'),
            points: [
                t('landing.carousel.banners.b5.p1'),
                t('landing.carousel.banners.b5.p2'),
                t('landing.carousel.banners.b5.p3')
            ],
            image: bannerQuotes,
            accent: 'amber'
        },
        {
            tag: t('landing.carousel.banners.b6.tag'),
            tagIcon: <CreditCard size={16} />,
            tagColor: 'rgba(20, 184, 166, 0.1)',
            tagTextColor: '#14b8a6',
            title: <>{t('landing.carousel.banners.b6.title_p1')}<span className="text-gradient">{t('landing.carousel.banners.b6.title_p2')}</span></>,
            description: t('landing.carousel.banners.b6.desc'),
            points: [
                t('landing.carousel.banners.b6.p1'),
                t('landing.carousel.banners.b6.p2'),
                t('landing.carousel.banners.b6.p3')
            ],
            image: bannerWhatsApp,
            accent: 'teal'
        },
        {
            tag: t('landing.carousel.banners.b7.tag'),
            tagIcon: <Users size={16} />,
            tagColor: 'rgba(107, 114, 128, 0.1)',
            tagTextColor: '#4b5563',
            title: <>{t('landing.carousel.banners.b7.title_p1')}<span className="text-gradient">{t('landing.carousel.banners.b7.title_p2')}</span></>,
            description: t('landing.carousel.banners.b7.desc'),
            points: [
                t('landing.carousel.banners.b7.p1'),
                t('landing.carousel.banners.b7.p2'),
                t('landing.carousel.banners.b7.p3')
            ],
            image: bannerMulticompany,
            accent: 'slate'
        },
        {
            tag: t('landing.carousel.banners.b8.tag'),
            tagIcon: <DollarSign size={16} />,
            tagColor: 'rgba(212, 175, 55, 0.1)',
            tagTextColor: '#d4af37',
            title: <>{t('landing.carousel.banners.b8.title_p1')}<span className="text-gradient">{t('landing.carousel.banners.b8.title_p2')}</span></>,
            description: t('landing.carousel.banners.b8.desc'),
            points: [
                t('landing.carousel.banners.b8.p1'),
                t('landing.carousel.banners.b8.p2'),
                t('landing.carousel.banners.b8.p3')
            ],
            image: bannerMulticurrency,
            accent: 'gold'
        },
        {
            tag: t('landing.carousel.banners.b9.tag'),
            tagIcon: <Receipt size={16} />,
            tagColor: 'rgba(16, 185, 129, 0.1)',
            tagTextColor: '#10b981',
            title: <>{t('landing.carousel.banners.b9.title_p1')}<span className="text-gradient">{t('landing.carousel.banners.b9.title_p2')}</span>{t('landing.carousel.banners.b9.title_p3')}</>,
            description: t('landing.carousel.banners.b9.desc'),
            points: [
                t('landing.carousel.banners.b9.p1'),
                t('landing.carousel.banners.b9.p2'),
                t('landing.carousel.banners.b9.p3')
            ],
            image: bannerFiscal,
            accent: 'emerald'
        },
        {
            tag: t('landing.carousel.banners.b10.tag'),
            tagIcon: <Sparkles size={16} />,
            tagColor: 'rgba(99, 102, 241, 0.1)',
            tagTextColor: '#6366f1',
            title: <>{t('landing.carousel.banners.b10.title_p1')}<span className="text-gradient">{t('landing.carousel.banners.b10.title_p2')}</span></>,
            description: t('landing.carousel.banners.b10.desc'),
            points: [
                t('landing.carousel.banners.b10.p1'),
                t('landing.carousel.banners.b10.p2'),
                t('landing.carousel.banners.b10.p3')
            ],
            image: bannerMarketingCopilot,
            accent: 'indigo'
        },
        {
            tag: t('landing.carousel.banners.b11.tag'),
            tagIcon: <Award size={16} />,
            tagColor: 'rgba(79, 70, 229, 0.1)',
            tagTextColor: '#4f46e5',
            title: <>{t('landing.carousel.banners.b11.title_p1')}<span className="text-gradient">{t('landing.carousel.banners.b11.title_p2')}</span>{t('landing.carousel.banners.b11.title_p3')}</>,
            description: t('landing.carousel.banners.b11.desc'),
            points: [
                t('landing.carousel.banners.b11.p1'),
                t('landing.carousel.banners.b11.p2'),
                t('landing.carousel.banners.b11.p3')
            ],
            image: bannerLoyalty,
            accent: 'indigo'
        }
    ];

    // Compute active banners dynamically based on landingCampaigns
    const activeBanners = [...translatedBanners];
    
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
        if (isPaused) return;
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % activeBanners.length);
        }, 8000);
        return () => clearInterval(timer);
    }, [activeBanners.length, isPaused]);

    const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % activeBanners.length);
    const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + activeBanners.length) % activeBanners.length);

    return (
        <>
            <div className="landing-bg-glow" aria-hidden="true">
                <div className={`glow-1 accent-${activeBanners[currentSlide]?.accent || 'blue'}`}></div>
                <div className={`glow-2 accent-${activeBanners[currentSlide]?.accent || 'blue'}`}></div>
            </div>

            <header 
                className="hero-section carousel-mode"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
            >
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
                                            <div className="inline-flex items-center justify-center px-4 py-2.5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 shadow-sm rounded-2xl w-fit">
                                                {renderPriceHighlight(banner.price)}
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
                                                    {session ? t('landing.carousel.go_dashboard') : t('landing.hero.free_trial')}
                                                    <ChevronRight size={18} />
                                                </button>
                                                <button onClick={() => setIsVideoModalOpen(true)} className="btn-watch-video">
                                                    <PlayCircle size={18} />
                                                    {t('landing.hero.learn_system')}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                    <div className="hero-stats animate-stats">
                                        <div className="mini-stat">
                                            <span className="stat-val">+R$ 2.4M</span>
                                            <span className="stat-desc">{t('landing.hero.transacted')}</span>
                                        </div>
                                        <div className="mini-divider"></div>
                                        <div className="mini-stat">
                                            <span className="stat-val">1.2k+</span>
                                            <span className="stat-desc">{t('landing.hero.active_companies')}</span>
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
                    <button onClick={prevSlide} className="carousel-nav-btn prev" aria-label={t('landing.carousel.prev_slide')}>
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
                    <button onClick={nextSlide} className="carousel-nav-btn next" aria-label={t('landing.carousel.next_slide')}>
                        <ArrowRight size={16} strokeWidth={1.5} />
                    </button>
                </div>
            </header>
        </>
    );
}
