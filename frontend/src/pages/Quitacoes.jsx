import React, { useState, useEffect } from 'react';
import { CheckCircle2, FileText, Download, Calculator, Filter, Loader2 } from 'lucide-react';
import { api } from '../services/api';

export default function Quitacoes({ role }) {
  const isManager = role === 'Gerente' || role === 'Supervisor';
  const [filtroCS, setFiltroCS] = useState('Todos');
  const [quitados, setQuitados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await api.get('/api/quitacoes');
        setQuitados(Array.isArray(data) ? data : []);
        setErro('');
      } catch (e) {
        setErro(e.message);
        setQuitados([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const csDisponiveis = [...new Set(quitados.map((q) => q.cs).filter(Boolean))];
  const quitadosVisiveis = (isManager && filtroCS !== 'Todos')
    ? quitados.filter((q) => q.cs === filtroCS)
    : quitados;

  const totalOriginal = quitadosVisiveis.reduce((acc, q) => acc + (q.valor_original || 0), 0);
  const totalPago = quitadosVisiveis.reduce((acc, q) => acc + (q.valor_pago || 0), 0);
  const totalEconomia = totalOriginal - totalPago;
  const totalEconomiaPct = totalOriginal > 0 ? ((totalEconomia / totalOriginal) * 100).toFixed(1) : 0;

  const moeda = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const fmtData = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-brand-navy dark:text-white">Quitações</h2>
          <p className="text-brand-bronze mt-1">Relatório detalhado e acompanhamento de clientes liquidados.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isManager && csDisponiveis.length > 0 && (
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 shadow-sm">
              <Filter className="w-4 h-4 text-brand-bronze" />
              <select value={filtroCS} onChange={(e) => setFiltroCS(e.target.value)} className="text-sm text-brand-navy dark:text-slate-200 font-bold focus:outline-none bg-transparent dark:bg-slate-800 cursor-pointer">
                <option value="Todos">Todos os CSs</option>
                {csDisponiveis.map((cs) => <option key={cs} value={cs}>{cs}</option>)}
              </select>
            </div>
          )}
          <button onClick={() => alert('Exportação de relatório: em breve.')} className="bg-brand-gold text-brand-navy dark:text-white px-4 py-2 rounded-xl font-bold shadow-md hover:bg-[#b8952b] flex items-center gap-2 transition-all">
            <Download className="w-5 h-5" /> Exportar
          </button>
        </div>
      </header>

      {erro && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{erro}</div>}

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-slate-400 p-12"><Loader2 className="w-5 h-5 animate-spin" /> Carregando quitações...</div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-brand-cream dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-brand-bronze text-[10px] uppercase tracking-wider">
                <th className="px-4 py-3 font-bold">Cliente / CS</th>
                <th className="px-4 py-3 font-bold">Valores (Original / Pago)</th>
                <th className="px-4 py-3 font-bold">Economia Gerada</th>
                <th className="px-4 py-3 font-bold">Consulta Proc.</th>
                <th className="px-4 py-3 font-bold">Datas (Boleto / Pgto)</th>
                <th className="px-4 py-3 font-bold">Protesto</th>
                <th className="px-4 py-3 font-bold">Tarifas Rest.</th>
                <th className="px-4 py-3 font-bold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quitadosVisiveis.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 dark:bg-transparent dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-bold text-brand-navy dark:text-white">{item.cliente || item.customer_id}</div>
                    <div className="text-xs text-brand-bronze font-medium">Resp: {item.cs}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400 line-through">{moeda(item.valor_original)}</div>
                    <div className="text-sm font-bold text-brand-navy dark:text-white">{moeda(item.valor_pago)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-bold text-emerald-600">{moeda(item.economia)}</div>
                    <div className="text-xs font-medium text-emerald-500/80 bg-emerald-50 inline-block px-2 rounded-full">{item.percentual}%</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{item.consulta_processo}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                    <div><span className="font-medium text-slate-400">Envio:</span> {fmtData(item.data_boleto)}</div>
                    <div><span className="font-medium text-slate-400">Pgto:</span> {fmtData(item.data_pagamento)}</div>
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300">{item.protesto ? 'Cliente ciente' : 'Não possui'}</td>
                  <td className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300">{item.tarifas_restituiveis ? 'Sim' : 'Não'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-full"><CheckCircle2 className="w-3 h-3" /> Quitado</span>
                  </td>
                </tr>
              ))}
            </tbody>
            {quitadosVisiveis.length > 0 && (
              <tfoot className="bg-slate-50 dark:bg-slate-900/50 border-t-2 border-slate-200 dark:border-slate-700">
                <tr>
                  <td className="px-4 py-4 text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2"><Calculator className="w-4 h-4" /> TOTAL CONSOLIDADO</td>
                  <td className="px-4 py-4">
                    <div className="text-xs text-slate-500 dark:text-slate-400 line-through">{moeda(totalOriginal)}</div>
                    <div className="text-sm font-bold text-brand-navy dark:text-white">{moeda(totalPago)}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm font-bold text-emerald-600">{moeda(totalEconomia)}</div>
                    <div className="text-xs font-bold text-white bg-emerald-500 inline-block px-2 py-0.5 rounded-full">{totalEconomiaPct}% Global</div>
                  </td>
                  <td colSpan={5} className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400 text-right">Mostrando {quitadosVisiveis.length} quitação(ões).</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}

        {!loading && quitadosVisiveis.length === 0 && !erro && (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center">
            <FileText className="w-12 h-12 text-slate-300 mb-4" />
            <p>Nenhum cliente quitado no momento.</p>
          </div>
        )}
      </div>
    </div>
  );
}
