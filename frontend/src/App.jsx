import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { PrivacidadeProvider } from './contexts/PrivacidadeContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import AreaCS from './pages/AreaCS';
import Bonus from './pages/Bonus';
import Configuracoes from './pages/Configuracoes';
import EquipeCS from './pages/EquipeCS';
import GestaoClientes from './pages/GestaoClientes';
import Quitacoes from './pages/Quitacoes';
import Login from './pages/Login';
import { getUser, getToken, clearSession } from './services/api';

function App() {
  // Sessão persistida: sobrevive a refresh (token + usuário no localStorage).
  const [user, setUser] = useState(() => (getToken() ? getUser() : null));
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const handleLogin = (userData) => setUser(userData);

  const handleLogout = () => {
    clearSession();
    setUser(null);
  };

  if (!user) {
    return (
      <Router>
        <Routes>
          <Route path="*" element={<Login onLogin={handleLogin} />} />
        </Routes>
      </Router>
    );
  }

  // O papel vem do usuário autenticado (JWT) — sem seletor de "visualizar como".
  const role = user.role === 'CS' ? 'CS' : 'Gerente';

  return (
    <PrivacidadeProvider>
      <Router>
        <div className="flex h-screen bg-brand-cream text-brand-navy dark:bg-[#0B192C] dark:text-slate-200 font-sans relative transition-colors duration-300">
          <Sidebar
            role={role}
            user={user}
            isDarkMode={isDarkMode}
            toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
            onLogout={handleLogout}
          />
          <main className="flex-1 overflow-y-auto p-8">
            <div className="w-full">
              <AnimatedRoutes role={role} user={user} />
            </div>
          </main>
        </div>
      </Router>
    </PrivacidadeProvider>
  );
}

// Transição de página: cada rota entra com opacity 0→1 + y 8→0 (0.2s ease-out).
// A Sidebar fica FORA daqui (não anima). Respeita prefers-reduced-motion.
function AnimatedRoutes({ role, user }) {
  const location = useLocation();
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <Routes location={location}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard role={role} user={user} />} />
          <Route path="/meus-clientes" element={<AreaCS user={user} role={role} />} />
          <Route path="/equipe-cs" element={<EquipeCS />} />
          <Route path="/gestao/clientes/:cs_id" element={role !== 'CS' ? <GestaoClientes /> : <Navigate to="/dashboard" replace />} />
          <Route path="/quitacoes" element={<Quitacoes role={role} />} />
          <Route path="/bonus" element={<Bonus role={role} user={user} />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default App;
