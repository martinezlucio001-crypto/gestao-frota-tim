import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import DriverPortal from './DriverPortal.jsx'

// Verificar se é portal do motorista
const isDriverPortal = window.location.pathname === '/motorista' || window.location.pathname === '/motorista/';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isDriverPortal ? <DriverPortal /> : <App />}
  </StrictMode>,
)

