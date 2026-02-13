import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { AcceptInvite } from './pages/AcceptInvite';
import { Dashboard } from './pages/Dashboard';
import { Payables, Receivables } from './pages/Transactions';
import { Categories } from './pages/Categories';
import { Companies } from './pages/Companies';
import { Reports } from './pages/Reports';
import { Contacts } from './pages/Contacts';
import { Services } from './pages/Services';
import { Products } from './pages/Products';
import { Quotes } from './pages/Quotes';
import { QuoteForm } from './pages/QuoteForm';
import { QuotePrint } from './pages/QuotePrint';
import { Settings } from './pages/Settings';
import { Commissions } from './pages/Commissions';
import { WhatsApp } from './pages/WhatsApp';
import { Payments } from './pages/Payments';
import { Checkout } from './pages/Checkout';
import { CRM } from './pages/CRM';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { EntityProvider } from './context/EntityContext';
import { NotificationProvider } from './context/NotificationContext';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) return <div className="flex h-screen items-center justify-center">Carregando...</div>;

  if (!session) return <Navigate to="/login" replace />;

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/pay/:id" element={<Checkout />} />

      <Route path="/" element={
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
        <Route path="settings" element={<Settings />} />
        <Route path="commissions" element={<Commissions />} />
        <Route path="whatsapp" element={<WhatsApp />} />
        <Route path="payments" element={<Payments />} />
        <Route path="crm" element={<CRM />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <EntityProvider>
            <NotificationProvider>
              <AppRoutes />
            </NotificationProvider>
          </EntityProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
