import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Users, LayoutDashboard, Settings, LogOut, Activity, Trophy, Calculator, Moon, Sun } from 'lucide-react';
import clsx from 'clsx';

export default function Sidebar({ role, user, isDarkMode, toggleDarkMode, onLogout }) {
  const isManager = role === 'Gerente' || role === 'Supervisor';
  const username = user?.email || 'Gerente';
  const displayName = user?.email?.split('@')[0] || (isManager ? 'Gerente' : 'CS');

  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!isManager) {
      const fetchStats = async () => {
        try {
          const res = await fetch(`http://127.0.0.1:8000/api/dashboard/stats?user=${username}`);
          if (res.ok) {
            const data = await res.json();
            setStats(data);
          }
        } catch (e) {
          console.error("Erro ao buscar stats para a sidebar", e);
        }
      };
      fetchStats();
    }
  }, [isManager, username]);

  const totalChart = stats ? (stats.atendidos + stats.naoAtendidos + stats.tentativas) : 0;
  const p1 = totalChart > 0 ? (stats.atendidos / totalChart) * 100 : 0;
  const p2 = totalChart > 0 ? (stats.tentativas / totalChart) * 100 : 0;
  const stop1 = p1;
  const stop2 = p1 + p2;

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Início' },
    ...(isManager ? [{ to: '/equipe-cs', icon: Users, label: 'Equipe CS' }] : []),
    ...(!isManager ? [{ to: '/meus-clientes', icon: Users, label: 'Meus Clientes' }] : []),
    { to: '/quitacoes', icon: Activity, label: 'Quitações' },
    { to: '/bonus', icon: Trophy, label: 'Bônus e Comissões' },
    { to: '/eproc-tracker', icon: Activity, label: 'Monitoramento' },
    ...(isManager ? [{ to: '/configuracoes', icon: Settings, label: 'Configurações' }] : []),
  ];

  return (
    <aside className="w-64 bg-brand-navy dark:bg-[#071120] text-white flex flex-col shadow-2xl transition-colors duration-300">
      <div className="h-24 flex flex-col items-center justify-center border-b border-white/10 dark:border-slate-800 pt-4">
        <h1 className="text-2xl font-serif tracking-widest text-white border-b border-brand-bronze pb-1 px-4">APOIO</h1>
        <span className="text-xs tracking-[0.3em] mt-2 text-white/80">ao CS</span>
      </div>
      
      <nav className="flex-1 px-4 py-8 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-brand-gold text-brand-navy shadow-md transform scale-[1.02]'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-6 border-t border-white/10 dark:border-slate-800 bg-white/5 dark:bg-slate-900/50">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 flex flex-col">
          <div className={`flex items-center justify-between ${!isManager && stats ? 'mb-4' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-gold text-brand-navy flex items-center justify-center font-bold text-lg">
                {isManager ? 'G' : 'E'}
              </div>
              <div>
                <div className="text-sm font-bold text-white">{isManager ? 'Gerente / Supervisor' : displayName}</div>
              </div>
            </div>
            
            <button 
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-brand-gold"
              title="Alternar Modo Escuro"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
          
          {!isManager && stats && (
            <div className="flex flex-col items-center border-t border-white/10 pt-4">
              <div 
                className="w-24 h-24 rounded-full flex items-center justify-center shadow-inner relative"
                style={{
                  background: `conic-gradient(
                    #10b981 0% ${stop1}%,
                    #f97316 ${stop1}% ${stop2}%,
                    #ef4444 ${stop2}% 100%
                  )`
                }}
              >
                <div className="w-16 h-16 bg-[#162743] dark:bg-slate-900 rounded-full flex items-center justify-center flex-col shadow-md">
                  <span className="text-sm font-black text-white">{totalChart}</span>
                </div>
              </div>
              <div className="flex gap-3 mt-3 text-[10px] font-bold text-white/80 tracking-wider">
                <div className="flex items-center gap-1" title="Atendidos"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div> {stats.atendidos}</div>
                <div className="flex items-center gap-1" title="Tentativas"><div className="w-2 h-2 bg-orange-500 rounded-full"></div> {stats.tentativas}</div>
                <div className="flex items-center gap-1" title="Não Atendidos"><div className="w-2 h-2 bg-red-500 rounded-full"></div> {stats.naoAtendidos}</div>
              </div>
            </div>
          )}
        </div>

        <button onClick={onLogout} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm font-medium px-2 py-2 w-full">
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
