import React, { useState, useEffect } from 'react';
import { Save, Loader2, CheckCircle, AlertOctagon } from 'lucide-react';
import { api } from '../services/api';

export default function Configuracoes() {
  const [equipe, setEquipe] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvandoPrompt, setSalvandoPrompt] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const carregar = async () => {
    setLoading(true);
    try {
      const [eq, pr] = await Promise.all([
        api.get('/api/equipe'),
        api.get('/api/settings/ai-prompt'),
      ]);
      setEquipe(Array.isArray(eq) ? eq : []);
      setPrompt(pr?.ai_prompt || '');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const handleNivel = async (csId, nivel) => {
    const anterior = equipe;
    setEquipe((prev) => prev.map((c) => c.cs_id === csId ? { ...c, nivel: Number(nivel) } : c));
    try {
      await api.put(`/api/equipe/${csId}/nivel`, { level_cs: Number(nivel) });
      showToast('Nível atualizado.');
    } catch (e) {
      setEquipe(anterior);
      showToast(e.message, 'error');
    }
  };

  const salvarPrompt = async () => {
    setSalvandoPrompt(true);
    try {
      await api.put('/api/settings/ai-prompt', { ai_prompt: prompt });
      showToast('Prompt salvo com sucesso!');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSalvandoPrompt(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl pb-12 relative">
      <header>
        <h2 className="text-3xl font-bold text-brand-navy dark:text-white">Configurações do Sistema</h2>
        <p className="text-slate-500 mt-1">Acesso restrito a Gerente.</p>
      </header>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">Níveis de Comissionamento da Equipe</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          O nível afeta apenas lançamentos FUTUROS — os valores já lançados ficam congelados.
        </p>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-slate-400 p-8"><Loader2 className="w-5 h-5 animate-spin" /> Carregando...</div>
          ) : equipe.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Nenhum CS cadastrado.</div>
          ) : (
            <table className="w-full text-left border-collapse mb-2">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 font-bold">Nome do CS</th>
                  <th className="px-4 py-3 font-bold text-center">Clientes</th>
                  <th className="px-4 py-3 font-bold text-center">Nível Atual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                {equipe.map((cs) => (
                  <tr key={cs.cs_id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-4 text-brand-navy dark:text-slate-200 font-bold">{cs.nome}</td>
                    <td className="px-4 py-4 text-center text-slate-500">{cs.totalClientes}</td>
                    <td className="px-4 py-4 text-center">
                      <select value={cs.nivel ?? 1} onChange={(e) => handleNivel(cs.cs_id, e.target.value)} className="border border-slate-200 dark:border-slate-600 rounded p-1.5 font-bold text-brand-navy dark:text-slate-200 bg-white dark:bg-[#112240] cursor-pointer shadow-sm focus:outline-none focus:border-brand-gold">
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Nível {n}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">Prompt da Inteligência Artificial</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Prompt base usado pela IA para transcrever e resumir os atendimentos (em primeira pessoa, sem expor CPF).
        </p>
        <textarea
          className="w-full h-48 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-gold transition-all resize-none"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
        />
        <div className="flex justify-end mt-4">
          <button onClick={salvarPrompt} disabled={salvandoPrompt || loading} className="bg-brand-navy text-white px-6 py-2 rounded-xl font-bold shadow-sm hover:bg-blue-900 transition-colors flex items-center gap-2 disabled:opacity-60">
            {salvandoPrompt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Prompt
          </button>
        </div>
      </div>

      {toast.show && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border z-50 ${toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          {toast.type === 'error' ? <AlertOctagon className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
