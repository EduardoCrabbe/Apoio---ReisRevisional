import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, Calendar as CalendarIcon, Clock, AlertCircle,
  RefreshCw, PhoneForwarded, DollarSign, BellRing, PieChart, Trash2,
} from 'lucide-react';
import { api } from '../services/api';

const STATS_VAZIO = {
  totalAtivos: 0, atendidos: 0, tentativas: 0, naoAtendidos: 0,
  percentuais: { atendidos: 0, tentativas: 0, naoAtendidos: 0 },
  ganhosTotais: 0, prioridades: [],
};

export default function Dashboard({ role }) {
  const isManager = role === 'Gerente' || role === 'Supervisor';
  const navigate = useNavigate();

  const [stats, setStats] = useState(STATS_VAZIO);
  const [tarefas, setTarefas] = useState([]);
  const [alertas, setAlertas] = useState(0);
  const [erro, setErro] = useState('');

  const [novaTarefa, setNovaTarefa] = useState({
    setor: 'Atendimento', classificacao: 'REGULAR', prazo: '', detalhes: '',
  });

  const fetchStats = async () => {
    try {
      setStats(await api.get('/api/dashboard/stats'));
      setErro('');
    } catch (e) {
      setErro(e.message);
      setStats(STATS_VAZIO);
    }
  };

  const fetchTarefas = async () => {
    try {
      setTarefas(await api.get('/api/tarefas'));
    } catch {
      setTarefas([]);
    }
  };

  const fetchAlertas = async () => {
    try {
      const data = await api.get('/api/robo/alertas');
      setAlertas(Array.isArray(data) ? data.length : 0);
    } catch {
      setAlertas(0);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchTarefas();
    fetchAlertas();
    const interval = setInterval(fetchAlertas, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleAddTarefa = async (e) => {
    e.preventDefault();
    if (!novaTarefa.detalhes) return;
    try {
      await api.post('/api/tarefas', {
        setor: novaTarefa.setor,
        classificacao: novaTarefa.classificacao,
        prazo: novaTarefa.prazo || null,
        detalhes: novaTarefa.detalhes,
      });
      setNovaTarefa({ setor: 'Atendimento', classificacao: 'REGULAR', prazo: '', detalhes: '' });
      fetchTarefas();
    } catch (err) {
      setErro(err.message);
    }
  };

  const concluirTarefa = async (id) => {
    setTarefas((prev) => prev.filter((t) => t.id !== id)); // some da lista de abertas
    try {
      await api.post(`/api/tarefas/${id}/concluir`);
    } catch (err) {
      setErro(err.message);
      fetchTarefas();
    }
  };

  const adiarTarefa = async (id) => {
    try {
      await api.post(`/api/tarefas/${id}/adiar`);
      fetchTarefas();
    } catch (err) {
      setErro(err.message);
    }
  };

  const excluirTarefa = async (id) => {
    setTarefas((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.del(`/api/tarefas/${id}`);
    } catch (err) {
      setErro(err.message);
      fetchTarefas();
    }
  };

  const getClassificacaoStyle = (tipo) => {
    switch (tipo) {
      case 'CRÍTICA/URGENTE': return 'bg-red-100 text-red-700 border-red-200';
      case 'REGULAR': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'LEMBRETE': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const pct = stats.percentuais || { atendidos: 0, tentativas: 0, naoAtendidos: 0 };
  const totalChart = stats.atendidos + stats.naoAtendidos + stats.tentativas;
  const stop1 = totalChart > 0 ? (stats.atendidos / totalChart) * 100 : 0;
  const stop2 = stop1 + (totalChart > 0 ? (stats.tentativas / totalChart) * 100 : 0);

  return (
    <div className="space-y-8 pb-12">
      {/* Tarja de Alertas Críticos (Eproc) — momento cross-produto */}
      {alertas > 0 && (
        <div className="bg-red-600/95 border-b-4 border-brand-gold text-white px-6 py-4 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-full animate-pulse">
              <BellRing className="w-6 h-6 text-brand-gold" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-brand-gold uppercase tracking-wider">Atenção Necessária!</h3>
              <p className="text-sm font-medium">
                O robô detectou <span className="font-bold underline">{alertas} alerta(s) crítico(s)</span> na sua carteira (busca e apreensão / mandados).
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/alertas-criticos')}
            className="bg-brand-gold text-brand-navy hover:bg-yellow-400 font-bold px-6 py-2.5 rounded-xl shadow-md transition-all whitespace-nowrap"
          >
            Verificar Agora
          </button>
        </div>
      )}

      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-brand-navy dark:text-white">Painel de Controle</h2>
          <p className="text-brand-bronze mt-1">Visão geral do comissionamento e saúde dos atendimentos.</p>
        </div>
        <button onClick={() => { fetchStats(); fetchTarefas(); fetchAlertas(); }} className="flex items-center gap-2 bg-white dark:bg-[#112240] border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-300 px-4 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-colors">
          <RefreshCw className="w-4 h-4" />
          Atualizar Dados
        </button>
      </header>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">
          {erro}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-[#112240] p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Não Atendidos</span>
            <AlertCircle className="w-5 h-5 text-red-400 bg-red-50 dark:bg-red-900/30 p-1 rounded-md" />
          </div>
          <div>
            <div className="text-4xl font-black text-red-500">{stats.naoAtendidos}</div>
            <div className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-2">{pct.naoAtendidos}% da base {isManager ? 'geral' : ''}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#112240] p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Tentativas sem Retorno</span>
            <PhoneForwarded className="w-5 h-5 text-orange-400 bg-orange-50 dark:bg-orange-900/30 p-1 rounded-md" />
          </div>
          <div>
            <div className="text-4xl font-black text-orange-500">{stats.tentativas}</div>
            <div className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-2">Esforço não comissionado</div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#112240] p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Clientes Atendidos</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 p-1 rounded-md" />
          </div>
          <div>
            <div className="text-4xl font-black text-emerald-500">{stats.atendidos}</div>
            <div className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-2">{pct.atendidos}% da base {isManager ? 'geral' : ''}</div>
          </div>
        </div>

        <div className="bg-brand-navy dark:bg-slate-900 p-6 rounded-2xl shadow-lg border border-brand-navy/10 dark:border-slate-800 flex flex-col justify-between transform hover:scale-[1.02] transition-transform text-white">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-sm font-bold text-blue-200">{isManager ? 'Ganhos da Equipe (mês)' : 'Ganhos Estimados (mês)'}</h3>
            <div className="p-2 rounded-lg bg-white/10 text-brand-gold"><DollarSign className="w-5 h-5" /></div>
          </div>
          <div>
            <p className="text-4xl font-black text-brand-gold">{formatCurrency(stats.ganhosTotais)}</p>
            <p className="text-xs text-blue-300 font-medium mt-1">Atendimentos + bônus do mês corrente</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Radar de Prioridades */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-brand-navy dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Radar de Prioridades
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Clientes que exigem retorno Semanal ou Quinzenal.</p>

          <div className="space-y-3">
            {(!stats.prioridades || stats.prioridades.length === 0) ? (
              <div className="bg-white/50 dark:bg-[#112240]/50 border border-slate-100 dark:border-slate-800 rounded-xl p-8 text-center text-slate-400 dark:text-slate-500 border-dashed">
                Nenhuma prioridade na sua base.
              </div>
            ) : (
              stats.prioridades.map((item) => {
                const atrasado = item.status === 'Atrasado' || item.horas_restantes === null;
                let statusText;
                if (atrasado) {
                  statusText = 'Atrasado';
                } else if (item.horas_restantes >= 24) {
                  const dias = Math.floor(item.horas_restantes / 24);
                  statusText = `${dias} dia${dias !== 1 ? 's' : ''}`;
                } else {
                  statusText = `${Math.max(0, Math.floor(item.horas_restantes))}h restantes`;
                }
                const borderColor = item.criticidade === 'Crítico' ? 'border-l-red-500' : 'border-l-amber-500';
                const statusColor = atrasado ? 'text-red-500 dark:text-red-400' : 'text-emerald-500 dark:text-emerald-400';

                return (
                  <div key={item.customer_id} className={`bg-white dark:bg-[#112240] p-4 rounded-xl shadow-sm border-l-4 ${borderColor} border-t border-r border-b border-slate-100 dark:border-slate-800 flex justify-between items-center`}>
                    <div>
                      <h4 className="font-bold text-brand-navy dark:text-white">{item.nome}</h4>
                      <span className={`text-xs font-bold uppercase ${item.criticidade === 'Crítico' ? 'text-red-500' : 'text-amber-500'}`}>
                        {item.criticidade} ({item.criticidade === 'Crítico' ? 'Semanal' : 'Quinzenal'})
                      </span>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-black ${statusColor}`}>{statusText}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold">{atrasado ? 'Prazo esgotado' : 'No prazo'}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Gráfico de Desempenho */}
        <div className="bg-white dark:bg-[#112240] rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 flex flex-col">
          <div>
            <h3 className="font-bold text-brand-navy dark:text-white flex items-center gap-2 mb-1">
              <PieChart className="w-5 h-5 text-brand-gold" />
              Visão Geral
            </h3>
            <p className="text-xs text-slate-500 mb-6">Comparativo do ciclo atual</p>
          </div>

          <div className="flex-1 flex justify-center items-center relative py-4">
            {totalChart === 0 ? (
              <div className="w-40 h-40 rounded-full bg-slate-100 dark:bg-slate-800 border-4 border-slate-200 dark:border-slate-700 flex items-center justify-center">
                <span className="text-xs font-bold text-slate-400">Sem dados</span>
              </div>
            ) : (
              <div
                className="w-48 h-48 rounded-full flex items-center justify-center shadow-inner relative transition-all duration-500 hover:scale-105"
                style={{ background: `conic-gradient(#10b981 0% ${stop1}%, #f97316 ${stop1}% ${stop2}%, #ef4444 ${stop2}% 100%)` }}
              >
                <div className="w-32 h-32 bg-white dark:bg-[#112240] rounded-full shadow-lg flex items-center justify-center flex-col z-10">
                  <span className="text-2xl font-black text-brand-navy dark:text-white">{totalChart}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {[
              ['Atendidos', 'bg-emerald-500', 'text-emerald-500', stats.atendidos, pct.atendidos],
              ['Tentativas', 'bg-orange-500', 'text-orange-500', stats.tentativas, pct.tentativas],
              ['Não Atendidos', 'bg-red-500', 'text-red-500', stats.naoAtendidos, pct.naoAtendidos],
            ].map(([label, dot, txt, val, p]) => (
              <div key={label} className="flex justify-between items-center text-sm p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${dot} shadow-sm`}></div>
                  <span className="font-bold text-slate-600 dark:text-slate-300">{label}</span>
                </div>
                <div className="text-right">
                  <span className={`font-black ${txt} mr-2`}>{val}</span>
                  <span className="text-xs font-bold text-slate-400">({p}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tarefas */}
        <div className="bg-white dark:bg-[#112240] rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-brand-cream/50 dark:bg-slate-900/50 flex justify-between items-center">
            <h3 className="font-bold text-brand-navy dark:text-white flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-brand-gold" />
              Agenda / Tarefas
            </h3>
          </div>

          <div className="p-6 grid grid-cols-1 gap-8">
            <form onSubmit={handleAddTarefa} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Setor</label>
                <select value={novaTarefa.setor} onChange={e => setNovaTarefa({ ...novaTarefa, setor: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-brand-navy dark:text-slate-200 focus:outline-none focus:border-brand-gold">
                  <option>Atendimento</option>
                  <option>Mediação/Negociação</option>
                  <option>Jurídico</option>
                  <option>Administrativo</option>
                  <option>Gestão</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Classificação</label>
                <select value={novaTarefa.classificacao} onChange={e => setNovaTarefa({ ...novaTarefa, classificacao: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-brand-navy dark:text-slate-200 focus:outline-none focus:border-brand-gold">
                  <option value="REGULAR">Regular</option>
                  <option value="CRÍTICA/URGENTE">Urgente</option>
                  <option value="LEMBRETE">Lembrete</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Prazo</label>
                <input type="date" value={novaTarefa.prazo} onChange={e => setNovaTarefa({ ...novaTarefa, prazo: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-brand-navy dark:text-slate-200 focus:outline-none focus:border-brand-gold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Detalhes</label>
                <textarea rows="3" value={novaTarefa.detalhes} onChange={e => setNovaTarefa({ ...novaTarefa, detalhes: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-brand-navy dark:text-slate-200 focus:outline-none focus:border-brand-gold" required></textarea>
              </div>
              <button type="submit" className="w-full bg-brand-navy dark:bg-brand-gold text-white dark:text-brand-navy font-bold py-3 rounded-xl hover:bg-[#002866] dark:hover:bg-yellow-500 transition-colors">
                Adicionar Tarefa
              </button>
            </form>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {tarefas.length === 0 ? (
                <div className="text-center text-slate-400 dark:text-slate-500 text-sm mt-8">Nenhuma tarefa em aberto.</div>
              ) : (
                tarefas.map((tarefa) => (
                  <div key={tarefa.id} className={`p-3 rounded-xl border flex items-start gap-3 ${tarefa.mes_anterior ? 'bg-red-50/60 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-700'} hover:shadow-md`}>
                    <button onClick={() => concluirTarefa(tarefa.id)} title="Concluir" className="mt-1 rounded-full w-5 h-5 border border-slate-300 dark:border-slate-600 hover:border-emerald-500 hover:bg-emerald-500 hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <div className="flex-1">
                      <div className="flex gap-2 mb-1 items-center flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getClassificacaoStyle(tarefa.classificacao)}`}>{tarefa.classificacao}</span>
                        {tarefa.origem === 'sistema' && <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-slate-100 text-slate-600 border-slate-200">AUTO</span>}
                        {tarefa.mes_anterior && <span className="text-[10px] font-bold text-red-600">⏳ mês anterior</span>}
                      </div>
                      <p className="text-sm text-brand-navy dark:text-slate-300 font-medium">{tarefa.detalhes}</p>
                      {tarefa.prazo && <p className="text-[10px] text-slate-400 mt-1">Prazo: {tarefa.prazo}</p>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => adiarTarefa(tarefa.id)} title="Adiar para hoje" className="text-slate-400 hover:text-amber-500 transition-colors"><Clock className="w-4 h-4" /></button>
                      <button onClick={() => excluirTarefa(tarefa.id)} title="Excluir" className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
