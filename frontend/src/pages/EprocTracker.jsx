import React, { useState, useEffect } from 'react';
import { FileText, RefreshCw, Info, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

/**
 * Monitoramento Eproc (lado servidor) — Etapa 9.
 *
 * O scraping é responsabilidade EXCLUSIVA do agente que roda na máquina do CS.
 * Esta tela apenas EXIBE os resultados já triados que o servidor recebeu
 * (GET /api/robo/resultados). O CPF e o número do processo NUNCA chegam aqui.
 *
 * Tema: segue o mesmo mecanismo claro/escuro das demais telas (base clara +
 * variantes `dark:`); o fundo e o padding vêm do layout em App.jsx.
 */
export default function EprocTracker() {
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/robo/resultados');
      setResultados(Array.isArray(data) ? data : []);
      setErro('');
    } catch (e) {
      setErro(e.message);
      setResultados([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, 60000);
    return () => clearInterval(interval);
  }, []);

  const fmtData = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR');
  };

  const badge = (triagem) => {
    if (!triagem) return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
    if (triagem.includes('VERMELHO')) return 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/50 dark:text-red-400 dark:border-red-800';
    if (triagem.includes('NORMAL') || triagem.includes('REGISTRO')) return 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400 dark:border-emerald-800';
    return 'bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-400 dark:border-yellow-800';
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-brand-navy dark:text-white tracking-tight">Monitoramento Eproc</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Resultados triados recebidos do agente que roda na máquina do CS.</p>
        </div>
        <button onClick={carregar} className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold bg-white dark:bg-[#112240] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-colors">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {/* Explicação do modelo desacoplado (LGPD: CPF não viaja). */}
      <div className="bg-white dark:bg-[#112240] border border-slate-100 dark:border-slate-800 rounded-xl p-4 flex items-start gap-3 shadow-sm">
        <Info className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          A varredura é executada pelo <strong>agente local</strong> (CPF e nº do processo nunca saem da máquina do CS).
          Aqui o servidor mostra apenas os campos seguros: classe, movimentação, descrição e triagem.
        </p>
      </div>

      <div className="bg-white dark:bg-[#112240] rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-brand-cream/50 dark:bg-slate-900/20">
          <h3 className="font-semibold text-brand-navy dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-400" /> Resultados Recebidos ({resultados.length})
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 text-slate-400 dark:text-slate-400 p-12"><Loader2 className="w-5 h-5 animate-spin" /> Carregando...</div>
        ) : erro ? (
          <div className="p-6 flex items-center gap-3 text-red-500 dark:text-red-400"><AlertCircle className="w-6 h-6" /> {erro}</div>
        ) : resultados.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center gap-3">
            <ShieldCheck className="w-12 h-12 text-emerald-500" />
            <p>Nenhum resultado recebido ainda. O agente envia os dados após cada varredura.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium">Cliente (DJ)</th>
                  <th className="px-6 py-4 font-medium">Classe</th>
                  <th className="px-6 py-4 font-medium">Movimentação</th>
                  <th className="px-6 py-4 font-medium">Recebido</th>
                  <th className="px-6 py-4 font-medium">Triagem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {resultados.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-brand-navy dark:text-white">
                      {r.nome || r.customer_id}
                      <div className="text-xs text-slate-400 dark:text-slate-500">DJ: {r.customer_id}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{r.classe || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="text-slate-600 dark:text-slate-300">{r.data_movimentacao || '-'}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 line-clamp-1">{r.descricao || ''}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-400 dark:text-slate-400 text-xs">{fmtData(r.recebido_em)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${badge(r.triagem)}`}>{r.triagem}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
