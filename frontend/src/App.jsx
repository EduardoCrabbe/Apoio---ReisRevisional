import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import AreaCS from './pages/AreaCS';
import Bonus from './pages/Bonus';
import EprocTracker from './pages/EprocTracker';
import Configuracoes from './pages/Configuracoes';
import EquipeCS from './pages/EquipeCS';
import Quitacoes from './pages/Quitacoes';
import Login from './pages/Login';

function App() {
  const [user, setUser] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
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

  const role = user.role === 'CS' ? 'CS' : 'Gerente';

  return (
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
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard role={role} user={user} />} />
              <Route path="/meus-clientes" element={<AreaCS user={user} />} />
              <Route path="/equipe-cs" element={<EquipeCS />} />
              <Route path="/quitacoes" element={<Quitacoes role={role} />} />
              <Route path="/bonus" element={<Bonus role={role} user={user} />} />
              <Route path="/eproc-tracker" element={<EprocTracker user={user} />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;
