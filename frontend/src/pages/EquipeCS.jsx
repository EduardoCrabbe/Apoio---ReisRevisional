import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, Award, UserPlus, X, Trash2 } from 'lucide-react';

export default function EquipeCS() {
  const [equipe, setEquipe] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [novoCS, setNovoCS] = useState({ nome: '', email: '', nivel: 1 });

  useEffect(() => {
    const saved = localStorage.getItem('equipeCS');
    if (saved) {
      setEquipe(JSON.parse(saved));
    } else {
      const defaultEquipe = [
        { id: 1, nome: 'Edu crabbe', email: 'eduardo@reisrevisional.com.br', nivel: 1, totalClientes: 100, atendidos: 60, quitacoes: 4, comentarios: 12, ganhos: 345.50 },
        { id: 2, nome: 'Ana Souza', email: 'ana@reisrevisional.com.br', nivel: 3, totalClientes: 120, atendidos: 100, quitacoes: 8, comentarios: 20, ganhos: 850.00 }
      ];
      setEquipe(defaultEquipe);
      localStorage.setItem('equipeCS', JSON.stringify(defaultEquipe));
    }
  }, []);

  const handleAddCS = (e) => {
    if (e) e.preventDefault();
    if (!novoCS.nome || !novoCS.email) {
      alert('Por favor, preencha o Nome e o E-mail do CS!');
      return;
    }

    const newCsEntry = {
      id: Date.now(),
      nome: novoCS.nome,
      email: novoCS.email,
      nivel: Number(novoCS.nivel),
      totalClientes: 0,
      atendidos: 0,
      quitacoes: 0,
      comentarios: 0,
      ganhos: 0.0
    };

    const updatedEquipe = [...equipe, newCsEntry];
    setEquipe(updatedEquipe);
    localStorage.setItem('equipeCS', JSON.stringify(updatedEquipe));
    setIsModalOpen(false);
    setNovoCS({ nome: '', email: '', nivel: 1 });
  };

  const handleDeleteCS = (id) => {
    if (window.confirm("Tem certeza que deseja excluir este CS da equipe?")) {
      const updatedEquipe = equipe.filter(cs => cs.id !== id);
      setEquipe(updatedEquipe);
      localStorage.setItem('equipeCS', JSON.stringify(updatedEquipe));
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-brand-navy dark:text-white">Equipe CS</h2>
          <p className="text-brand-bronze mt-1">Acompanhe a volumetria e ganhos de toda a sua equipe de Customer Success.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => alert('Em breve: Gestão de Campanhas de Desconto!')} className="bg-brand-gold text-brand-navy dark:text-brand-navy px-4 py-2 rounded-xl font-bold shadow-md hover:bg-yellow-500 flex items-center gap-2 transition-colors">
            <TrendingUp className="w-5 h-5" />
            Adicionar Campanha
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-brand-navy text-white px-4 py-2 rounded-xl font-medium shadow-sm hover:bg-blue-900 flex items-center gap-2 transition-colors"
          >
            <UserPlus className="w-5 h-5 text-brand-gold" />
            Adicionar CS
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-brand-cream rounded-xl text-brand-bronze">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500">Tamanho da Equipe</p>
            <p className="text-2xl font-bold text-brand-navy">2 CSs</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-brand-cream rounded-xl text-brand-bronze">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500">Total Atendimentos</p>
            <p className="text-2xl font-bold text-brand-navy">160</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-brand-cream rounded-xl text-brand-bronze">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500">Comissões Pagas</p>
            <p className="text-2xl font-bold text-brand-navy">R$ 1.195,50</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-brand-cream border-b border-slate-100 text-brand-bronze text-xs uppercase tracking-wider">
              <th className="px-6 py-4 font-bold">CS</th>
              <th className="px-6 py-4 font-bold text-center">Nível</th>
              <th className="px-6 py-4 font-bold text-center">Total Clientes</th>
              <th className="px-6 py-4 font-bold text-center">Atendidos</th>
              <th className="px-6 py-4 font-bold text-center">Faltam Atender</th>
              <th className="px-6 py-4 font-bold text-center">Quitações</th>
              <th className="px-6 py-4 font-bold text-center">Comentários</th>
              <th className="px-6 py-4 font-bold text-right">Ganhos (R$)</th>
              <th className="px-6 py-4 font-bold text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {equipe.map((cs, index) => {
              const faltantes = cs.totalClientes - cs.atendidos;
              const atendidosPct = cs.totalClientes > 0 ? Math.round((cs.atendidos / cs.totalClientes) * 100) : 0;
              const faltantesPct = cs.totalClientes > 0 ? Math.round((faltantes / cs.totalClientes) * 100) : 0;

              return (
                <tr key={index} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-brand-navy">{cs.nome}</div>
                    <div className="text-xs text-slate-500">{cs.email}</div>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-brand-bronze text-center">{cs.nivel}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 font-medium text-center">{cs.totalClientes}</td>
                  <td className="px-6 py-4 text-sm text-emerald-600 font-bold text-center">
                    {cs.atendidos} <span className="text-xs font-normal text-emerald-500/70">({atendidosPct}%)</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-red-500 font-bold text-center">
                    {faltantes} <span className="text-xs font-normal text-red-400/70">({faltantesPct}%)</span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-indigo-600 text-center">
                    {cs.quitacoes}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-blue-500 text-center">
                    {cs.comentarios}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-brand-navy dark:text-white text-right">R$ {cs.ganhos.toFixed(2)}</td>
                  <td className="px-6 py-4 flex items-center justify-end gap-3 mt-1">
                    <button onClick={() => alert('Redirecionando para planilha detalhada do CS...')} className="text-sm text-brand-bronze hover:text-brand-navy font-bold underline">Ver Planilha</button>
                    <button onClick={() => handleDeleteCS(cs.id)} className="text-red-400 hover:text-red-600 transition-colors p-1" title="Excluir CS">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-brand-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-brand-cream dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 p-4 flex justify-between items-center">
              <h3 className="font-bold text-brand-navy dark:text-white text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand-gold" />
                Cadastrar Novo CS
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Nome Completo</label>
                <input 
                  type="text"
                  required
                  value={novoCS.nome}
                  onChange={e => setNovoCS({...novoCS, nome: e.target.value})}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#112240] dark:text-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-brand-navy transition-colors"
                  placeholder="Ex: Carlos Oliveira"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">E-mail</label>
                <input 
                  type="email"
                  required
                  value={novoCS.email}
                  onChange={e => setNovoCS({...novoCS, email: e.target.value})}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#112240] dark:text-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-brand-navy transition-colors"
                  placeholder="Ex: carlos@reisrevisional.com.br"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Nível de Comissionamento</label>
                <select
                  value={novoCS.nivel}
                  onChange={e => setNovoCS({...novoCS, nivel: e.target.value})}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#112240] dark:text-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-brand-navy transition-colors cursor-pointer"
                >
                  <option value={1}>Nível 1 (Iniciante)</option>
                  <option value={2}>Nível 2 (Intermediário)</option>
                  <option value={3}>Nível 3 (Avançado)</option>
                  <option value={4}>Nível 4 (Sênior)</option>
                  <option value={5}>Nível 5 (Especialista)</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-100 text-slate-600 dark:text-slate-300 dark:bg-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  onClick={handleAddCS}
                  className="flex-1 bg-brand-navy text-white font-bold py-3 rounded-xl hover:bg-blue-900 shadow-md transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
