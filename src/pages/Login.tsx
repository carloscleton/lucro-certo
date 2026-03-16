import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Wallet, ArrowRight, AlertTriangle, X, Eye, EyeOff } from 'lucide-react';
import { Tooltip } from '../components/ui/Tooltip';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import loginHero1 from '../assets/login-hero-1.png';
import loginHero2 from '../assets/login-hero-2.png';
import loginHero3 from '../assets/login-hero-3.png';
import loginHero4 from '../assets/login-hero-4.png';
import logoFull from '../assets/logo-full.png';
import gridPattern from '../assets/grid-pattern.png';
import { useAuth } from '../context/AuthContext';

export function Login() {
    const [searchParams] = useSearchParams();
    const mode = searchParams.get('mode');
    const emailParam = searchParams.get('email');

    // Generate a new seed every 12 hours (Morning/Afternoon cycle)
    const getSeed = () => {
        const now = new Date();
        const twelveHours = 1000 * 60 * 60 * 12; // 12 hours in milliseconds
        return Math.floor(now.getTime() / twelveHours);
    };

    const getHeroImage = (basePrompt: string) => {
        const seed = getSeed();
        const prompt = encodeURIComponent(`${basePrompt}, wide shot, centered composition, main subject in center or right, high quality, professional photography, sharp focus, vibrant colors, cinematic lighting`);
        return `https://image.pollinations.ai/prompt/${prompt}?width=1280&height=1280&seed=${seed}&nologo=true`;
    };

    // Carousel State & Data
    const [currentSlide, setCurrentSlide] = useState(0);

    const carouselItems = [
        {
            text: "A melhor ferramenta para organizar as finanças da sua empresa e da sua vida pessoal em um só lugar. Simplesmente essencial.",
            author: "Beatriz Oliveira",
            role: "Especialista Financeira",
            initials: "BO",
            color: "from-blue-400 to-purple-500",
            image: getHeroImage("Strategic wealth management, a premium 3D composition with glowing green glass charts and 3D bar graphs on a dark corporate background. Financial growth, clarity, professional, clean minimalist style, centered framing"),
            fallback: loginHero1
        },
        {
            text: "Mantenha o fluxo de caixa sempre positivo. Acompanhe entradas e saídas em tempo real e tome decisões mais inteligentes.",
            author: "Dica Financeira",
            role: "Gestão Empresarial",
            initials: "DF",
            color: "from-green-400 to-emerald-500",
            image: getHeroImage("Successful profit growth concept, stack of premium gold coins and rising green arrow chart against a dark sophisticated background. Crystal textures, reflection, high success, prosperity, centered subject"),
            fallback: loginHero2
        },
        {
            text: "Separe as finanças pessoais das empresariais. Esse é o primeiro passo para o sucesso financeiro saudável.",
            author: "Dica de Sucesso",
            role: "Empreendedorismo",
            initials: "DS",
            color: "from-orange-400 to-red-500",
            image: getHeroImage("Balance and organization concept, abstract 3D scales or geometric shapes in warm gold and deep green. Sophisticated corporate aesthetics, structured organization, professional minimalist, balanced framing"),
            fallback: loginHero3
        },
        {
            text: "Automatize seus processos financeiros e ganhe tempo para focar no que realmente importa: o crescimento constante.",
            author: "Lucro Certo",
            role: "Produtividade",
            initials: "LC",
            color: "from-blue-500 to-cyan-500",
            image: getHeroImage("Automation and productivity, high-tech digital gear system with glowing green data lines on a dark background. Efficiency, fluid motion, precision, futuristic financial technology"),
            fallback: loginHero4
        }
    ];

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % carouselItems.length);
        }, 6000);
        return () => clearInterval(timer);
    }, []);

    const [isSignUp, setIsSignUp] = useState(mode === 'signup');
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState(emailParam || '');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [showBannedModal, setShowBannedModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
    const [isUpdatePassword, setIsUpdatePassword] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { session, loading: authLoading } = useAuth();

    if (authLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-slate-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // Redirect if already logged in (but not while we are processing a login/signup form)
    useEffect(() => {
        if (session && !loading) {
            navigate('/dashboard');
        }
    }, [session, navigate, loading]);

    // Check for recovery hash in URL
    useEffect(() => {
        const hash = window.location.hash;
        if (hash && (hash.includes('access_token=') || hash.includes('type=recovery'))) {
            setIsUpdatePassword(true);
            setMessage(t('login.set_new_password'));
        }
    }, []);

    const handleAuth = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setShowBannedModal(false);
        setShowInviteModal(false);

        try {
            if (isUpdatePassword) {
                const { error } = await supabase.auth.updateUser({
                    password: password
                });
                if (error) throw error;
                setMessage(t('login.password_updated'));
                setIsUpdatePassword(false);
                setPassword('');
            } else if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            user_type: 'PF',
                        },
                    },
                });
                if (error) throw error;

                // Option 2: Automatic Checkout Redirect Check
                const checkoutPlan = searchParams.get('checkout-plan');
                const checkoutPrice = searchParams.get('checkout-price');

                if (checkoutPlan && checkoutPrice) {
                    // Try to log in immediately so we have the auth session to create a company
                    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
                        email,
                        password,
                    });

                    if (!signInError && authData?.user) {
                        try {
                            // Create a company for them automatically
                            const { data: createData, error: createError } = await supabase.rpc('create_company', {
                                name_input: fullName,
                                trade_name_input: fullName,
                                cnpj_input: '00000000000',
                                entity_type_input: 'PF'
                            });

                            if (!createError && createData?.success) {
                                const newCompanyId = createData.company_id;

                                // Update company with the selected plan values
                                await supabase.from('companies').update({
                                    subscription_plan: checkoutPlan,
                                    next_billing_value: parseFloat(checkoutPrice),
                                    subscription_status: 'unpaid'
                                }).eq('id', newCompanyId);

                                // Request checkout URL - passing headers explicitly to avoid 401 race conditions
                                const { data: { session: currentSession } } = await supabase.auth.getSession();
                                const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('platform-checkout', {
                                    body: { company_id: newCompanyId },
                                    headers: {
                                        Authorization: `Bearer ${currentSession?.access_token}`
                                    }
                                });

                                if (!checkoutError && checkoutData?.paymentUrl) {
                                    window.location.href = checkoutData.paymentUrl;
                                    return; // Stop here, redirecting
                                } else {
                                    console.error('Checkout error:', checkoutError || checkoutData);

                                    // Instead of blocking, we just let them log in
                                    // The 'unpaid' logic in Layout.tsx will allow them to retry the payment
                                    await supabase.from('companies').update({
                                        subscription_status: 'unpaid'
                                    }).eq('id', newCompanyId);

                                    setLoading(false);
                                    navigate('/dashboard');
                                    return;
                                }
                            }
                        } catch (e) {
                            console.error("Erro no checkout automático Option 2:", e);
                            alert("Ocorreu um erro ao preparar sua conta. Tente novamente.");
                            await supabase.auth.signOut();
                            setLoading(false);
                            navigate('/');
                            return;
                        }
                    }
                }

                setMessage(t('login.signup_success'));
                setIsSignUp(false);
                setError(null);
            } else {
                const { data: authData, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;

                if (authData?.user) {
                    // Check profile status immediately
                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('status')
                        .eq('id', authData.user.id)
                        .maybeSingle();

                    if (profileData?.status === 'blocked') {
                        await supabase.auth.signOut();
                        setShowBannedModal(true);
                        setLoading(false);
                        return;
                    }

                    // Check if company is blocked (Primary company)
                    const { data: membershipData } = await supabase
                        .from('company_members')
                        .select('company:companies(status)')
                        .eq('user_id', authData.user.id)
                        .eq('status', 'active')
                        .limit(1)
                        .maybeSingle();

                    const castedMembership = membershipData as any;
                    if (castedMembership?.company?.status === 'blocked') {
                        await supabase.auth.signOut();
                        setShowBannedModal(true);
                        setLoading(false);
                        return;
                    }

                    // CHECKOUT PARA USUÁRIOS EXISTENTES
                    const checkoutPlan = searchParams.get('checkout-plan');
                    const checkoutPrice = searchParams.get('checkout-price');

                    if (checkoutPlan && checkoutPrice) {
                        try {
                            const { data: companies } = await supabase
                                .from('company_members')
                                .select('company_id, role')
                                .eq('user_id', authData.user.id);

                            if (companies && companies.length > 0) {
                                const targetCompanyId = companies.find(c => c.role === 'owner')?.company_id || companies[0].company_id;

                                await supabase.from('companies').update({
                                    subscription_plan: checkoutPlan,
                                    next_billing_value: parseFloat(checkoutPrice),
                                    subscription_status: 'unpaid'
                                }).eq('id', targetCompanyId);

                                const { data: { session: currentSession } } = await supabase.auth.getSession();
                                const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('platform-checkout', {
                                    body: { company_id: targetCompanyId },
                                    headers: {
                                        Authorization: `Bearer ${currentSession?.access_token}`
                                    }
                                });

                                if (!checkoutError && checkoutData?.paymentUrl) {
                                    window.location.href = checkoutData.paymentUrl;
                                    return;
                                } else {
                                    console.error('Checkout error:', checkoutError || checkoutData);
                                    // Just navigate to dashboard, unpaid logic will handle it
                                    setLoading(false);
                                    navigate('/dashboard');
                                    return;
                                }
                            }
                        } catch (e) {
                            console.error("Erro no checkout de usuário existente:", e);
                        }
                    }
                }

                navigate('/dashboard');
            }
        } catch (err: any) {
            console.error('Auth error:', err.message);
            if (err.message.includes('invalid_grant') || err.message.toLowerCase().includes('banned') || err.message.toLowerCase().includes('user is banned')) {
                setShowBannedModal(true);
            } else if (err.message.includes('Invalid login credentials')) {
                // Check if invite exists
                const { data: hasInvite } = await supabase.rpc('check_invite_exists', { check_email: email });
                if (hasInvite) {
                    setShowInviteModal(true);
                } else {
                    setError(t('login.email_incorrect'));
                }
            } else if (err.message.includes('Email not confirmed')) {
                setError(t('login.email_not_confirmed'));
            } else if (err.message.toLowerCase().includes('user already registered') || err.message.toLowerCase().includes('already registered')) {
                setError("Este e-mail já está cadastrado. Por favor, faça login ou use outro e-mail.");
            } else if (err.message.includes('New password should be different from the old password')) {
                setError(t('login.new_password_different'));
            } else if (err.message.includes('Password should be at least 6 characters')) {
                setError(t('login.password_min_chars'));
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e: FormEvent) => {
        e.preventDefault();
        setResetLoading(true);
        setError(null);
        setMessage(null);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
                redirectTo: `${window.location.origin}/login`,
            });
            if (error) throw error;
            setMessage(t('login.recovery_email_sent'));
            setShowForgotPasswordModal(false);
        } catch (err: any) {
            console.error('Forgot password error:', err.message);
            setError(err.message);
        } finally {
            setResetLoading(false);
        }
    };
    return (
        <div className="min-h-screen flex bg-white relative">
            {/* Left Side - Form */}
            <div className="flex-1 flex items-center justify-center p-8 sm:p-12 lg:p-16 relative">
                {/* Background Pattern */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        backgroundImage: `url(${gridPattern})`,
                        backgroundSize: '400px',
                        opacity: 0.15
                    }}
                />
                <div className="w-full max-w-sm space-y-10 relative z-10">
                    <div className="space-y-4">
                        <div className="flex justify-center mb-8">
                            <img src={logoFull} alt="Lucro Certo" className="h-24 w-auto" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900 text-center">
                            {isUpdatePassword ? t('login.new_password_title') : (isSignUp ? t('login.create_account_title') : t('login.welcome_back'))}
                        </h1>
                        <p className="text-lg text-gray-500">
                            {isUpdatePassword
                                ? t('login.new_password_desc')
                                : (isSignUp
                                    ? t('login.create_account_desc')
                                    : t('login.login_desc'))}
                        </p>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-6">
                        {isSignUp && (
                            <Input
                                label={t('login.full_name')}
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder={t('login.full_name_placeholder')}
                                required={isSignUp}
                                autoComplete="name"
                                className="h-12"
                            />
                        )}

                        {!isUpdatePassword && (
                            <Input
                                label="Email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="seu@email.com"
                                required
                                autoComplete="email"
                                className="h-12"
                            />
                        )}

                        <div className="space-y-1">
                            <Input
                                label={isUpdatePassword ? t('login.new_password_title') : t('login.password_label')}
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
                                autoComplete="current-password"
                                className="h-12"
                                rightElement={
                                    <Tooltip content={showPassword ? t('login.hide_password') : t('login.show_password')}>
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="p-2 -mr-2 text-gray-400 hover:text-gray-600 transition-colors"
                                        >
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </Tooltip>
                                }
                            />
                            {!isSignUp && !isUpdatePassword && (
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        className="text-sm font-medium text-blue-600 hover:text-blue-500"
                                        onClick={() => {
                                            setForgotEmail(email);
                                            setShowForgotPasswordModal(true);
                                        }}
                                    >
                                        {t('login.forgot_password')}
                                    </button>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="p-4 text-sm text-red-800 rounded-lg bg-red-50 border border-red-100" role="alert">
                                {error}
                            </div>
                        )}

                        {message && !error && (
                            <div className="p-4 text-sm text-green-800 rounded-lg bg-green-50 border border-green-100" role="alert">
                                {message}
                            </div>
                        )}

                        <Button type="submit" isLoading={loading} className="w-full h-12 text-base shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all">
                            {isUpdatePassword ? t('login.save_new_password') : (isSignUp ? t('login.create_account_btn') : t('login.login_btn'))}
                            {!loading && <ArrowRight size={18} className="ml-2" />}
                        </Button>
                    </form>

                    <div className="pt-4 text-center border-t border-gray-100">
                        {!isUpdatePassword && (
                            <p className="text-sm text-gray-600">
                                {isSignUp ? t('login.already_have_account') : t('login.no_account')}
                                <button
                                    onClick={() => setIsSignUp(!isSignUp)}
                                    className="ml-2 font-semibold text-blue-600 hover:text-blue-500 hover:underline transition-all"
                                    type="button"
                                >
                                    {isSignUp ? t('login.do_login') : t('login.create_free_account')}
                                </button>
                            </p>
                        )}
                        {isUpdatePassword && (
                            <p className="text-sm text-gray-600">
                                {t('login.want_to_cancel')}
                                <button
                                    onClick={() => setIsUpdatePassword(false)}
                                    className="ml-2 font-semibold text-blue-600 hover:text-blue-500 hover:underline transition-all"
                                    type="button"
                                >
                                    {t('login.back_to_login')}
                                </button>
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Side - Carousel */}
            <div className="hidden lg:flex flex-1 relative bg-slate-900 overflow-hidden">
                {/* Background Images */}
                {carouselItems.map((item, index) => (
                    <img
                        key={index}
                        src={item.image}
                        alt="Background"
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${index === currentSlide ? 'opacity-90' : 'opacity-0'
                            }`}
                        onError={(e) => {
                            const img = e.currentTarget;
                            if (img.src !== item.fallback) {
                                img.src = item.fallback;
                            }
                        }}
                    />
                ))}

                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent opacity-90" />

                <div className="absolute bottom-0 left-0 right-0 p-8 sm:p-12 text-white z-10">
                    <div className="max-w-md relative min-h-[200px]">
                        {carouselItems.map((item, index) => (
                            <div
                                key={index}
                                className={`transition-all duration-1000 absolute bottom-0 left-0 right-0 ${index === currentSlide ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
                                    }`}
                            >
                                <div className="flex gap-1 mb-6">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <svg key={i} className="w-5 h-5 text-yellow-500 fill-current" viewBox="0 0 20 20">
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                    ))}
                                </div>
                                <blockquote className="text-xl font-medium leading-relaxed mb-6">
                                    "{item.text}"
                                </blockquote>
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center font-bold text-base shadow-lg`}>
                                        {item.initials}
                                    </div>
                                    <div>
                                        <cite className="not-italic font-semibold block text-lg">{item.author}</cite>
                                        <span className="text-slate-300 text-sm">{item.role}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Progress Dots */}
                    <div className="flex gap-2 mt-12 mb-2">
                        {carouselItems.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentSlide(index)}
                                className={`h-1.5 rounded-full transition-all duration-300 ${index === currentSlide ? 'w-8 bg-white' : 'w-2 bg-white/30 hover:bg-white/50'
                                    }`}
                                aria-label={`Go to slide ${index + 1}`}
                            />
                        ))}
                    </div>
                </div>
            </div>


            {/* Banned User Modal */}
            {showBannedModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 relative transform transition-all scale-100">
                        <button
                            onClick={() => setShowBannedModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-2">
                                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
                            </div>

                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                {t('login.access_blocked')}
                            </h2>

                            <p className="text-gray-600 dark:text-gray-300">
                                {t('login.account_suspended')}
                            </p>

                            <div className="bg-gray-50 dark:bg-slate-700/50 p-4 rounded-lg text-sm text-gray-500 dark:text-gray-400 w-full">
                                <p>{t('login.contact_support')}</p>
                            </div>

                            <Button
                                onClick={() => setShowBannedModal(false)}
                                className="w-full bg-red-600 hover:bg-red-700 text-white"
                            >
                                {t('common.understood')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invite Pending Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 relative transform transition-all scale-100">
                        <button
                            onClick={() => setShowInviteModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-2">
                                <Wallet className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            </div>

                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                {t('login.invite_found')}
                            </h2>

                            <p className="text-gray-600 dark:text-gray-300">
                                {t('login.invite_pending_msg')}
                            </p>

                            <div className="bg-blue-50 dark:bg-slate-700/50 p-4 rounded-lg text-sm text-blue-700 dark:text-blue-400 w-full">
                                <p>{t('login.create_to_accept')}</p>
                            </div>

                            <Button
                                onClick={() => {
                                    setShowInviteModal(false);
                                    setIsSignUp(true);
                                }}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {t('login.create_account_now')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Forgot Password Modal */}
            {showForgotPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 relative transform transition-all scale-100">
                        <button
                            onClick={() => setShowForgotPasswordModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex flex-col space-y-4">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                    <Eye size={24} className="text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                        {t('login.forgot_password_title')}
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {t('login.recovery_link_desc')}
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleForgotPassword} className="space-y-4">
                                <Input
                                    label={t('login.recovery_email_label')}
                                    type="email"
                                    value={forgotEmail}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                    placeholder="seu@email.com"
                                    required
                                    className="h-12"
                                />

                                <div className="pt-2 flex flex-col gap-3">
                                    <Button
                                        type="submit"
                                        isLoading={resetLoading}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12"
                                    >
                                        {t('login.send_recovery_link')}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setShowForgotPasswordModal(false)}
                                        className="w-full h-12"
                                    >
                                        {t('common.cancel')}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
