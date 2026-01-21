import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import DriverPortal from './DriverPortal.jsx'

// Verificar a rota atual
const pathname = window.location.pathname;
const isDriverPortal = pathname === '/motorista' || pathname === '/motorista/';
const isAdminPanel = pathname === '/gestao4554' || pathname === '/gestao4554/';

// Redirecionar raiz para motorista (ou você pode deixar vazio)
if (pathname === '/' || pathname === '') {
  window.location.replace('/motorista');
}

// Renderizar o componente apropriado
const getComponent = () => {
  if (isDriverPortal) return <DriverPortal />;
  if (isAdminPanel) return <App />;
  return null; // Será redirecionado
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {getComponent()}
  </StrictMode>,
)

