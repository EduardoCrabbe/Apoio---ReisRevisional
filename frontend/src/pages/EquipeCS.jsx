import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, Award, UserPlus, X, Trash2, Loader2 } from 'lucide-react';
import { api } from '../services/api';

export default function EquipeCS() {
  const [equipe, setEquipe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [novoCS, setNovoCS] = useState({ nome: '', email: '', senha: '', nivel: 1 });

  const fetchEquipe = async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/equipe');
      setEquipe(Array.isArray(data) ? data : []);
      setErro('');
    } catch (e) {
      setErro(e.message);
      setEquipe([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEquipe(); }, []);

  const handleNivel = async (csId, nivel) => {
    const anterior = equipe;
    setEquipe((prev) => prev.map((c) => c.cs_id === csId ? { ...c, nivel: Number(nivel) } : c));
    try {
      await api.put(`/api/equipe/${csId}/nivel`, { level_cs: Number(nivel) });
    } catch (e) {
      setEquipe(anterior);
      setErro(e.message);
    }
  };

  const handleDelete = async (csId) => {
    if (!window.confirm('Desativar este CS? O histórico financeiro é preservado.')) return;
    try {
      await api.del(`/api/equipe/${csId}`);
      fetchEquipe();
    } catch (e) {
      setErro(e.message);
    }
  };

  const handleAddCS = async () => {
    if (!novoCS.email || !novoCS.senha) {
      setErro('Preencha e-mail e senha (mínimo 8 caracteres).');
      return;
    }
    setSalvando(true);
    try {
      const user = await api.post('/api/auth/register', {
        email: novoCS.email,
        password: novoCS.senha,
        role: 'CS',
        nome_exibicao: novoCS.nome || undefined,
      });
      if (Number(novoCS.nivel) !== 1 && user?.id) {
        await api.put(`/api/equipe/${user.id}/nivel`, { level_cs: Number(novoCS.nivel) });
      }
      setIsModalOpen(false);
      setNovoCS({ nome: '', email: '', senha: '', nivel: 1 });
      setErro('');
      fetchEquipe();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const tamanho = equipe.length;
  const totalAtendimentos = equipe.reduce((acc, c) => acc + (c.atendidos || 0), 0);
  const totalGanhos = equipe.reduce((acc, c) => acc + (c.ganhosMes || 0), 0);
  const fmt = (v) => `R$ ${(v || 0).toFixed(2)}`;

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-brand-navy dark:text-white">Equipe CS</h2>
          <p className="text-brand-bronze mt-1">Volumetria e ganhos de toda a equipe de Customer Success (dados do mês corrente).</p>
        </div>
        <button onClick={() => { setErro(''); setIsModalOpen(true); }} className="bg-brand-navy text-white px-4 py-2 rounded-xl font-medium shadow-sm hover:bg-blue-900 flex items-center gap-2 transition-colors">
          <UserPlus className="w-5 h-5 text-brand-gold" /> Adicionar CS
        </button>
      </header>

      {erro && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{erro}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-brand-cream rounded-xl text-brand-bronze"><Users className="w-6 h-6" /></div>
          <div><p className="text-sm font-bold text-slate-500">Tamanho da Equipe</p><p className="text-2xl font-bold text-brand-navy">{tamanho} CS{tamanho !== 1 ? 's' : ''}</p></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-brand-cream rounded-xl text-brand-bronze"><TrendingUp className="w-6 h-6" /></div>
          <div><p className="text-sm font-bold text-slate-500">Clientes Atendidos</p><p className="text-2xl font-bold text-brand-navy">{totalAtendimentos}</p></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-brand-cream rounded-xl text-brand-bronze"><Award className="w-6 h-6" /></div>
          <div><p className="text-sm font-bold text-slate-500">Ganhos da Equipe (mês)</p><p className="text-2xl font-bold text-brand-navy">{fmt(totalGanhos)}</p></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-slate-400 p-12"><Loader2 className="w-5 h-5 animate-spin" /> Carregando equipe...</div>
        ) : equipe.length === 0 ? (
          <div className="p-12 text-center text-slate-500">Nenhum CS cadastrado ainda.</div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-brand-cream border-b border-slate-100 text-brand-bronze text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">CS</th>
                <th className="px-6 py-4 font-bold text-center">Nível</th>
                <th className="px-6 py-4 font-bold text-center">Total Clientes</th>
                <th className="px-6 py-4 font-bold text-center">Atendidos</th>
                <th className="px-6 py-4 font-bold text-center">Faltam Atender</th>
                <th className="px-6 py-4 font-bold text-center">Quitações (mês)</th>
                <th className="px-6 py-4 font-bold text-right">Ganhos (mês)</th>
                <th className="px-6 py-4 font-bold text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {equipe.map((cs) => (
                <tr key={cs.cs_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4"><div className="text-sm font-bold text-brand-navy">{cs.nome}</div></td>
                  <td className="px-6 py-4 text-center">
                    <select value={cs.nivel ?? 1} onChange={(e) => handleNivel(cs.cs_id, e.target.value)} className="border border-slate-200 rounded p-1.5 font-bold text-brand-navy bg-white cursor-pointer shadow-sm focus:outline-none focus:border-brand-gold">
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Nível {n}</option>)}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 font-medium text-center">{cs.totalClientes}</td>
                  <td className="px-6 py-4 text-sm text-emerald-600 font-bold text-center">{cs.atendidos} <span className="text-xs font-normal text-emerald-500/70">({cs.atendidosPct}%)</span></td>
                  <td className="px-6 py-4 text-sm text-red-500 font-bold text-center">{cs.faltam} <span className="text-xs font-normal text-red-400/70">({cs.faltamPct}%)</span></td>
                  <td className="px-6 py-4 text-sm font-bold text-indigo-600 text-center">{cs.quitacoesMes}</td>
                  <td className="px-6 py-4 text-sm font-bold text-brand-navy dark:text-white text-right">{fmt(cs.ganhosMes)}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleDelete(cs.cs_id)} className="text-red-400 hover:text-red-600 transition-colors p-1" title="Desativar CS"><Trash2 className="w-5 h-5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-brand-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-brand-cream dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 p-4 flex justify-between items-center">
              <h3 className="font-bold text-brand-navy dark:text-white text-lg flex items-center gap-2"><UserPlus className="w-5 h-5 text-brand-gold" /> Cadastrar Novo CS</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:text-slate-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Nome de Exibição</label>
                <input type="text" value={novoCS.nome} onChange={e => setNovoCS({ ...novoCS, nome: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#112240] dark:text-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-brand-navy" placeholder="Ex: Carlos" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">E-mail (@reisrevisional.com.br)</label>
                <input type="email" value={novoCS.email} onChange={e => setNovoCS({ ...novoCS, email: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#112240] dark:text-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-brand-navy" placeholder="carlos@reisrevisional.com.br" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Senha (mín. 8 caracteres)</label>
                <input type="password" value={novoCS.senha} onChange={e => setNovoCS({ ...novoCS, senha: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#112240] dark:text-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-brand-navy" placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Nível de Comissionamento</label>
                <select value={novoCS.nivel} onChange={e => setNovoCS({ ...novoCS, nivel: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#112240] dark:text-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-brand-navy cursor-pointer">
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Nível {n}</option>)}
                </select>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-100 text-slate-600 dark:text-slate-300 dark:bg-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Cancelar</button>
                <button type="button" disabled={salvando} onClick={handleAddCS} className="flex-1 bg-brand-navy text-white font-bold py-3 rounded-xl hover:bg-blue-900 shadow-md transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
