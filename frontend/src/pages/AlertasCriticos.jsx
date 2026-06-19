import React, { useState, useEffect } from 'react';
import { Siren, RefreshCw, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '../services/api';

export default function AlertasCriticos() {
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = async () => {
    setLoading(true);
    setErro('');
    try {
      const data = await api.get('/api/robo/alertas');
      setAlertas(Array.isArray(data) ? data : []);
    } catch (e) {
      setErro(e.message);
      setAlertas([]);
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

  return (
    <div className="space-y-6 pb-12">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-brand-navy dark:text-white flex items-center gap-3">
            <Siren className="w-8 h-8 text-red-500" />
            Alertas Críticos
          </h2>
          <p className="text-brand-bronze mt-1">
            Movimentações de risco detectadas pelo robô no Eproc (busca e apreensão, mandados, petições).
          </p>
        </div>
        <button
          onClick={carregar}
          className="flex items-center gap-2 bg-white dark:bg-[#112240] border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-300 px-4 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </header>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-slate-400 p-12">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando alertas...
        </div>
      )}

      {!loading && erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-6 flex items-center gap-3 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">
          <AlertTriangle className="w-6 h-6 flex-shrink-0" />
          <div>
            <p className="font-bold">Não foi possível carregar os alertas.</p>
            <p className="text-sm">{erro}</p>
          </div>
        </div>
      )}

      {!loading && !erro && alertas.length === 0 && (
        <div className="bg-white dark:bg-[#112240] border border-slate-100 dark:border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center gap-3">
          <ShieldCheck className="w-12 h-12 text-emerald-500" />
          <p className="text-lg font-bold text-brand-navy dark:text-white">Nenhum alerta crítico no momento.</p>
          <p className="text-sm text-slate-400">A última varredura do robô não encontrou movimentações de risco na sua carteira.</p>
        </div>
      )}

      {!loading && !erro && alertas.length > 0 && (
        <div className="space-y-3">
          {alertas.map((a) => (
            <div
              key={a.id}
              className="bg-white dark:bg-[#112240] border-l-4 border-red-500 border-t border-r border-b border-slate-100 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4">
                <div className="bg-red-100 dark:bg-red-900/40 p-2.5 rounded-lg flex-shrink-0">
                  <Siren className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-brand-navy dark:text-white">{a.nome || a.customer_id}</h3>
                    <span className="text-[10px] uppercase font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">
                      DJ: {a.customer_id}
                    </span>
                    {a.classe && (
                      <span className="text-[10px] uppercase font-bold bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">
                        {a.classe}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{a.descricao || 'Movimentação crítica detectada.'}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Movimentação: {a.data_movimentacao || '-'} · Recebido em {fmtData(a.recebido_em)}
                  </p>
                </div>
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400 whitespace-nowrap">
                {a.triagem}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
