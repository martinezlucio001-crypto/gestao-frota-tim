import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import DriverPortal from './DriverPortal.jsx'
import GestaoTIM from './GestaoTIM.jsx'
import LandingPage from './LandingPage.jsx'

// Verificar a rota atual
const pathname = window.location.pathname;

// Rotas do sistema
const isDriverPortal = pathname === '/motorista' || pathname === '/motorista/';
const isNewAdminPanel = pathname.startsWith('/admin');
const isLegacyAdminPanel = pathname === '/gestao4554' || pathname === '/gestao4554/';
const isLandingPage = pathname === '/' || pathname === '';

// Redirecionar /gestao4554 para /admin (compatibilidade)
if (isLegacyAdminPanel) {
  window.location.replace('/admin');
}

// Não redirecionar mais raiz!

// Renderizar o componente apropriado
const getComponent = () => {
  if (isDriverPortal) return <DriverPortal />;
  if (isNewAdminPanel) return <GestaoTIM />;
  if (isLandingPage) return <LandingPage />;
  return <div>Página não encontrada (404)</div>; // Fallback
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {getComponent()}
  </StrictMode>,
)


