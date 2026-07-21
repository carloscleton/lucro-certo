import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n/i18n'
import App from './App.tsx'

// Silenciar avisos de tamanho do Recharts (ResponsiveContainer)
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('The width') || args[0].includes('The height')) &&
    args[0].includes('should be greater than 0')
  ) {
    return;
  }
  originalWarn(...args);
};

// Interceptar e tratar erros de oscilação de rede (Failed to fetch / network error) no console
window.addEventListener('unhandledrejection', (event) => {
  const reasonStr = String(event.reason?.message || event.reason || '');
  if (reasonStr.includes('Failed to fetch') || reasonStr.includes('TypeError')) {
    console.debug('⚠️ Micro-oscilação de rede suprimida:', reasonStr);
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
