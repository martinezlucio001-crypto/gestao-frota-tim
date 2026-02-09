import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import DriverPortal from './DriverPortal.jsx'
import GestaoTIM from './GestaoTIM.jsx'

// Verificar a rota atual
const pathname = window.location.pathname;

// Rotas do sistema
const isDriverPortal = pathname === '/motorista' || pathname === '/motorista/';
const isNewAdminPanel = pathname.startsWith('/admin');
const isLegacyAdminPanel = pathname === '/gestao4554' || pathname === '/gestao4554/';

// Redirecionar /gestao4554 para /admin (compatibilidade)
if (isLegacyAdminPanel) {
  window.location.replace('/admin');
}

// Redirecionar raiz para motorista
if (pathname === '/' || pathname === '') {
  window.location.replace('/motorista');
}

// Renderizar o componente apropriado
const getComponent = () => {
  if (isDriverPortal) return <DriverPortal />;
  if (isNewAdminPanel) return <GestaoTIM />;
  return null; // Será redirecionado
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {getComponent()}
  </StrictMode>,
)


