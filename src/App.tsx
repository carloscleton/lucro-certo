import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, type ReactNode } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { EntityProvider, useEntity } from './context/EntityContext';
import { NotificationProvider } from './context/NotificationContext';
import { CRMProvider } from './context/CRMContext';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import { Clock } from 'lucide-react';

// Layout (sempre carregado após login)
import { Layout } from './components/layout/Layout';

// ─── Lazy imports por grupo ───────────────────────────────────────────────────

// Público / autenticação
const LandingPage      = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const Login            = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const AcceptInvite     = lazy(() => import('./pages/AcceptInvite').then(m => ({ default: m.AcceptInvite })));
const PaymentRequired  = lazy(() => import('./pages/PaymentRequired').then(m => ({ default: m.PaymentRequired })));

// Pagamentos públicos
const Checkout         = lazy(() => import('./pages/Checkout').then(m => ({ default: m.Checkout })));
const PublicProposal   = lazy(() => import('./pages/PublicProposal').then(m => ({ default: m.PublicProposal })));

// Loyalty público
const LoyaltyPublicPage = lazy(() => import('./pages/LoyaltyPublicPage').then(m => ({ default: m.LoyaltyPublicPage })));
const LoyaltyCheckout   = lazy(() => import('./pages/LoyaltyCheckout').then(m => ({ default: m.LoyaltyCheckout })));
const LoyaltyPortal     = lazy(() => import('./pages/LoyaltyPortal').then(m => ({ default: m.LoyaltyPortal })));

// Dashboard
const Dashboard        = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));

// Financeiro
const Payables         = lazy(() => import('./pages/Transactions').then(m => ({ default: m.Payables })));
const Receivables      = lazy(() => import('./pages/Transactions').then(m => ({ default: m.Receivables })));
const Categories       = lazy(() => import('./pages/Categories').then(m => ({ default: m.Categories })));
const Reports          = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const Commissions      = lazy(() => import('./pages/Commissions').then(m => ({ default: m.Commissions })));

// Vendas
const Quotes           = lazy(() => import('./pages/Quotes').then(m => ({ default: m.Quotes })));
const QuoteForm        = lazy(() => import('./pages/QuoteForm').then(m => ({ default: m.QuoteForm })));
const QuotePrint       = lazy(() => import('./pages/QuotePrint').then(m => ({ default: m.QuotePrint })));
const Invoices         = lazy(() => import('./pages/Invoices').then(m => ({ default: m.Invoices })));

// CRM
const Contacts         = lazy(() => import('./pages/Contacts').then(m => ({ default: m.Contacts })));
const CRM              = lazy(() => import('./pages/CRM').then(m => ({ default: m.CRM })));
const Agenda           = lazy(() => import('./pages/Agenda').then(m => ({ default: m.Agenda })));

// Marketing
const Marketing        = lazy(() => import('./pages/Marketing').then(m => ({ default: m.Marketing })));
const LeadRadar        = lazy(() => import('./pages/LeadRadar').then(m => ({ default: m.LeadRadar })));
const WhatsApp         = lazy(() => import('./pages/WhatsApp').then(m => ({ default: m.WhatsApp })));
const Loyalty          = lazy(() => import('./pages/Loyalty').then(m => ({ default: m.Loyalty })));
const Referrals        = lazy(() => import('./pages/Referrals').then(m => ({ default: m.Referrals })));

// Pagamentos internos
const Payments         = lazy(() => import('./pages/Payments').then(m => ({ default: m.Payments })));

// Loyalty (autenticado)

// Configurações / Cadastros
const Settings         = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Companies        = lazy(() => import('./pages/Companies').then(m => ({ default: m.Companies })));
const Services         = lazy(() => import('./pages/Services').then(m => ({ default: m.Services })));
const Products         = lazy(() => import('./pages/Products').then(m => ({ default: m.Products })));

// ─── Fallback de loading ──────────────────────────────────────────────────────

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-slate-900">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
        <p className="text-sm font-medium text-gray-500 animate-pulse">Carregando...</p>
      </div>
    </div>
  );
}

function SessionTimeoutWrapper({ children }: { children: ReactNode }) {
  const { showWarning, resetTimer } = useIdleTimeout();

  return (
    <>
      {children}
      {showWarning && (
        <div className="fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-right-full duration-500">
          <div className="bg-white dark:bg-slate-800 border-2 border-orange-500 rounded-2xl p-5 shadow-2xl max-w-sm flex gap-4 ring-4 ring-orange-500/10">
            <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-xl self-start">
              <Clock className="text-orange-600 animate-pulse" size={24} />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                Sessão Expirando!
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
                Você está inativo há quase 15 minutos. Por segurança, sua sessão será encerrada em breve.
              </p>
              <button 
                onClick={() => {
                  resetTimer();
                  window.location.href = '/';
                }}
                className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold rounded-lg transition-all shadow-lg shadow-orange-500/20 active:scale-95"
              >
                CONTINUAR CONECTADO
              </button>

            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, profile, loading: authLoading } = useAuth();
  const { currentEntity, isLoading: entityLoading } = useEntity();

  if (authLoading || entityLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          <p className="text-sm font-medium text-gray-500 animate-pulse">Autenticando ambiente...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    if (localStorage.getItem('loggingOut') === 'true') {
        return <Navigate to="/" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  // Verifica as condições de pagamento
  const status = currentEntity?.subscription_status || '';
  const isTrialExpired = (currentEntity as any)?.trial_ends_at && 
                         new Date((currentEntity as any).trial_ends_at) < new Date() &&
                         !((currentEntity as any)?.current_period_end && new Date((currentEntity as any).current_period_end) > new Date());

  // Se o ambiente atual estiver com pendência, teste expirado ou bloqueio manual
  const isBlocked = (currentEntity as any)?.status === 'blocked';
  
  // Is Admin? (Admin doesn't get blocked)
  const isAdmin = profile?.email?.toLowerCase() === 'carloscleton.nat@gmail.com';
  
  // Verifica se é uma conta pessoal antiga sem plano definido (Desativado o bloqueio total para evitar problemas com empresas de Cortesia)
  // const isOldAccountWithoutPlan = !plan && currentEntity.type === 'personal' && currentEntity.created_at && (
  //   (new Date().getTime() - new Date(currentEntity.created_at).getTime()) > 7 * 24 * 60 * 60 * 1000
  // );
  
  // Is Exempt (Cortesia)?
  const isExempt = currentEntity.settings?.billing_exempt === true;
  
  // Is temporary bypass active (24 hours)?
  const bypassUntil = currentEntity.settings?.bypass_until;
  const isBypassed = bypassUntil && new Date(bypassUntil) > new Date();
  
  if (!isAdmin && !isExempt && !isBypassed && (['unpaid', 'past_due'].includes(status) || isTrialExpired || isBlocked)) {
    return <Navigate to="/payment-required" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/pay/:id" element={<Checkout />} />
        <Route path="/clube/:slug" element={<LoyaltyPublicPage />} />
        <Route path="/checkout/loyalty/:planId" element={<LoyaltyCheckout />} />
        <Route path="/portal/:token" element={<LoyaltyPortal />} />
        <Route path="/p/:id" element={<PublicProposal />} />
        <Route path="/payment-required" element={<PaymentRequired />} />

        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="payables" element={<Payables />} />
          <Route path="receivables" element={<Receivables />} />
          <Route path="categories" element={<Categories />} />
          <Route path="companies" element={<Companies />} />
          <Route path="reports" element={<Reports />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="services" element={<Services />} />
          <Route path="products" element={<Products />} />
          <Route path="quotes" element={<Quotes />} />
          <Route path="quotes/new" element={<QuoteForm />} />
          <Route path="quotes/:id" element={<QuoteForm />} />
          <Route path="quotes/:id/print" element={<QuotePrint />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="settings" element={<Settings />} />
          <Route path="commissions" element={<Commissions />} />
          <Route path="whatsapp" element={<WhatsApp />} />
          <Route path="payments" element={<Payments />} />
          <Route path="crm" element={<CRM />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="marketing" element={<Marketing />} />
          <Route path="lead-radar" element={<LeadRadar />} />
          <Route path="loyalty" element={<Loyalty />} />
          <Route path="referrals" element={<Referrals />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <EntityProvider>
            <NotificationProvider>
              <CRMProvider>
                <SessionTimeoutWrapper>
                  <AppRoutes />
                </SessionTimeoutWrapper>
              </CRMProvider>
            </NotificationProvider>
          </EntityProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
