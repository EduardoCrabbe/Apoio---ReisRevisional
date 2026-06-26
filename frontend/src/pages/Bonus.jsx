import React, { useState, useEffect, useMemo } from 'react';
import { PlusCircle, Star, MessageSquare, Image as ImageIcon, Video, History, CheckCircle, AlertOctagon, UserPlus, X, Trophy, PhoneCall } from 'lucide-react';
import { api } from '../services/api';
import { Money } from '../contexts/PrivacidadeContext';

const fmtBonus = (v) => `R$ ${(Number(v) || 0).toFixed(2)}`;

// Rótulo + ícone dos cards "Meu Mês". Inclui "Atendimento" (não é bônus manual,
// vem do residual de ganhosTotais) além dos tipos de bônus do extrato.
const CARD_META = {
  Atendimento: { label: 'Atendimento', icon: PhoneCall },
  Quitacao: { label: 'Quitação', icon: MessageSquare },
  ComentarioGoogle: { label: 'Comentário Google', icon: Star },
  FotoBoleto: { label: 'Foto com Boleto', icon: ImageIcon },
  ReclameAqui: { label: 'Reclame Aqui', icon: Star },
  VideoDepoimento: { label: 'Depoimento por Vídeo', icon: Video },
};

// Rótulos/ícones amigáveis para as ações da commission_table (a ação "Atendimento"
// não é um bônus manual — fica de fora). VALORES vêm da API, nunca hardcoded.
// "Quitacao" continua aqui só para EXIBIÇÃO no extrato (a quitação cria seu bônus
// automaticamente), mas é EXCLUÍDA dos formulários de lançamento manual — ver
// `tiposBonus`. O backend também rejeita POST /api/bonus tipo="Quitacao" (422).
const META = {
  Quitacao: { label: 'Quitação', icon: MessageSquare },
  ComentarioGoogle: { label: 'Comentário Google (Positivo)', icon: Star },
  FotoBoleto: { label: 'Foto com Boleto (Quitação)', icon: ImageIcon },
  ReclameAqui: { label: 'Reclame Aqui (Positivo)', icon: Star },
  VideoDepoimento: { label: 'Depoimento por Vídeo', icon: Video },
};

// Tipo padrão dos formulários de lançamento manual (Quitação não é lançável aqui).
const TIPO_PADRAO = 'ComentarioGoogle';

export default function Bonus({ role, user }) {
  const isManager = role === 'Gerente' || role === 'Supervisor';
  const nivel = user?.level_cs || 1;
  const usaNivelAlto = nivel >= 3; // 1-2 vs 3-5 (brackets da tabela)

  const [tabela, setTabela] = useState([]);
  const [extrato, setExtrato] = useState([]);
  const [stats, setStats] = useState(null); // só CS: ganhosTotais do mês (p/ "Meu Mês")
  const [form, setForm] = useState({ customer_id: '', tipo: TIPO_PADRAO });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Estado do lançamento pela GESTÃO (modal): cliente de toda a base + CS que recebe.
  const [modalGestao, setModalGestao] = useState(false);
  const [clientesBase, setClientesBase] = useState([]);
  const [csAtivos, setCsAtivos] = useState([]);
  const [formGestao, setFormGestao] = useState({ customer_id: '', cs_id: '', tipo: TIPO_PADRAO });
  const [salvando, setSalvando] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const fetchTabela = async () => {
    try { setTabela(await api.get('/api/comissoes/tabela')); } catch (e) { showToast(e.message, 'error'); }
  };
  const fetchExtrato = async () => {
    try { setExtrato(await api.get('/api/bonus/extrato')); } catch (e) { showToast(e.message, 'error'); }
  };
  // ganhosTotais (atendimentos + bônus do mês) — mesma fonte do Dashboard.
  const fetchStats = async () => {
    if (isManager) return;
    try { setStats(await api.get('/api/dashboard/stats')); } catch { /* silencioso */ }
  };

  useEffect(() => { fetchTabela(); fetchExtrato(); }, []);
  useEffect(() => { fetchStats(); }, [isManager]);

  // A gestão precisa da base inteira de clientes e da lista de CS para o override.
  useEffect(() => {
    if (!isManager) return;
    api.get('/api/clientes').then((d) => setClientesBase(Array.isArray(d) ? d : [])).catch(() => {});
    api.get('/api/equipe').then((d) => setCsAtivos(Array.isArray(d) ? d : [])).catch(() => {});
  }, [isManager]);

  const handleLancarGestao = async () => {
    if (!formGestao.customer_id || !formGestao.cs_id) {
      showToast('Selecione o cliente e o CS que recebe o crédito.', 'error');
      return;
    }
    setSalvando(true);
    try {
      await api.post('/api/bonus', {
        customer_id: formGestao.customer_id,
        cs_id: Number(formGestao.cs_id),
        tipo: formGestao.tipo,
      });
      setModalGestao(false);
      setFormGestao({ customer_id: '', cs_id: '', tipo: TIPO_PADRAO });
      await fetchExtrato();
      showToast('Bônus creditado ao CS escolhido!');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSalvando(false);
    }
  };

  const valorDe = (acao) => {
    const regra = tabela.find((t) => t.acao === acao);
    if (!regra) return null;
    return usaNivelAlto ? regra.valor_nivel_3_5 : regra.valor_nivel_1_2;
  };

  // "Meu Mês" (só CS): resumo da produção do mês corrente (mês calendário UTC,
  // mesmo critério do Dashboard). Bônus vêm do extrato (agrupados por tipo);
  // Atendimento não está no extrato — derivamos pelo residual de ganhosTotais
  // (atendimentos + bônus) menos a soma dos bônus do mês, e estimamos a quantidade
  // pelo valor unitário da tabela. Total dos cards == ganhosTotais (consistência).
  const resumoMes = useMemo(() => {
    if (isManager) return null;
    const agora = new Date();
    const ano = agora.getUTCFullYear();
    const mes = agora.getUTCMonth();
    const noMes = extrato.filter((it) => {
      const d = new Date(it.data);
      return !Number.isNaN(d.getTime()) && d.getUTCFullYear() === ano && d.getUTCMonth() === mes;
    });

    const grupos = {};
    let totalBonus = 0;
    for (const it of noMes) {
      const g = grupos[it.tipo] || { tipo: it.tipo, qtd: 0, total: 0 };
      g.qtd += 1;
      g.total += Number(it.valor) || 0;
      grupos[it.tipo] = g;
      totalBonus += Number(it.valor) || 0;
    }
    const cards = Object.values(grupos);

    const ganhos = Number(stats?.ganhosTotais) || 0;
    const totalAtend = Math.max(0, ganhos - totalBonus);
    if (totalAtend > 0.005) {
      const unit = valorDe('Atendimento');
      const qtd = unit ? Math.round(totalAtend / unit) : null;
      cards.unshift({ tipo: 'Atendimento', qtd, total: totalAtend });
    }
    return { cards, total: ganhos };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager, extrato, stats, tabela]);

  // Tipos de bônus LANÇÁVEIS manualmente = ações da tabela com rótulo definido,
  // exceto "Atendimento" (não é bônus) e "Quitacao" (nasce só do fluxo de quitar()).
  const tiposBonus = tabela
    .filter((t) => META[t.acao] && t.acao !== 'Quitacao')
    .map((t) => ({ id: t.acao, ...META[t.acao] }));

  const handleLancamento = async (e) => {
    e.preventDefault();
    if (!form.customer_id) { showToast('Informe o ID do cliente.', 'error'); return; }
    try {
      await api.post('/api/bonus', { customer_id: form.customer_id, tipo: form.tipo });
      setForm({ ...form, customer_id: '' });
      await fetchExtrato();
      fetchStats(); // mantém o residual de Atendimento ("Meu Mês") consistente
      showToast('Bônus registrado!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const fmtData = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-3xl font-bold text-brand-navy dark:text-white">Bônus & Comissões</h2>
          <p className="text-brand-bronze mt-1">
            {isManager
              ? 'Lançamento de comissões por metas. Valores sempre da tabela oficial.'
              : `Lançamento de comissões por metas. Valores vêm da tabela oficial (Nível ${nivel}).`}
          </p>
        </div>
        {isManager && (
          <button onClick={() => setModalGestao(true)} className="bg-brand-navy text-white px-4 py-2 rounded-xl font-medium shadow-sm hover:bg-blue-900 flex items-center gap-2 transition-colors whitespace-nowrap">
            <UserPlus className="w-5 h-5 text-brand-gold" /> Adicionar Bônus
          </button>
        )}
      </header>

      {/* "Meu Mês" — produção do CS no mês corrente (gestão não vê: usa Equipe). */}
      {!isManager && resumoMes && resumoMes.cards.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-bold text-brand-navy dark:text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-brand-gold" /> Meu Mês
            </h3>
            <div className="text-sm font-bold text-brand-bronze flex items-center gap-1">
              Total: <Money value={resumoMes.total} format={fmtBonus} className="text-brand-gold" />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            {resumoMes.cards.map((c) => {
              const meta = CARD_META[c.tipo] || { label: c.tipo, icon: Trophy };
              const Icon = meta.icon;
              return (
                <div key={c.tipo} className="flex-1 min-w-[180px] bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-sm font-bold text-brand-navy dark:text-white">
                    <Icon className="w-4 h-4 text-brand-bronze" />
                    {meta.label}
                  </div>
                  <div className="text-xs font-medium text-slate-400 dark:text-slate-500">
                    {c.qtd != null ? `${c.qtd} ${c.qtd === 1 ? 'realizado' : 'realizados'}` : 'no mês'}
                  </div>
                  <div className="text-xl font-black text-brand-gold mt-1">
                    <Money value={c.total} prefix="+ " format={fmtBonus} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {!isManager && (
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-brand-navy dark:bg-slate-900 p-6 rounded-2xl shadow-xl text-white border border-brand-navy/10 dark:border-slate-800">
              <h3 className="text-lg font-bold border-b border-white/10 pb-4 mb-4 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-brand-gold" /> Novo Lançamento
              </h3>
              <form onSubmit={handleLancamento} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">ID do Cliente (DataJuri)</label>
                  <input type="text" value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })} className="w-full bg-white/5 border border-white/20 rounded-lg p-2.5 text-white placeholder-white/30 focus:outline-none focus:border-brand-gold transition-colors" placeholder="Ex: 100201" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Tipo de Bônus</label>
                  <div className="space-y-2">
                    {tiposBonus.map((tipo) => {
                      const valor = valorDe(tipo.id);
                      return (
                        <label key={tipo.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${form.tipo === tipo.id ? 'bg-brand-gold/20 border-brand-gold text-white' : 'border-white/10 text-white/60 hover:bg-white/5'}`}>
                          <input type="radio" name="tipoBonus" value={tipo.id} checked={form.tipo === tipo.id} onChange={() => setForm({ ...form, tipo: tipo.id })} className="hidden" />
                          <tipo.icon className={`w-4 h-4 flex-shrink-0 ${form.tipo === tipo.id ? 'text-brand-gold' : ''}`} />
                          <span className="text-sm font-medium flex-1">{tipo.label}</span>
                          {valor != null && <span className="text-xs font-bold text-brand-gold"><Money value={valor} prefix="+ " format={fmtBonus} /></span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <button type="submit" className="w-full bg-brand-gold hover:bg-[#b8952b] text-brand-navy font-bold py-3 rounded-xl transition-colors shadow-lg mt-4">Registrar Bônus</button>
              </form>
            </div>
          </div>
        )}

        <div className={isManager ? 'lg:col-span-3' : 'lg:col-span-2'}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden h-full flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center gap-2">
              <History className="w-5 h-5 text-brand-bronze" />
              <h3 className="text-xl font-bold text-brand-navy">Extrato de Ganhos Extras</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-cream dark:bg-slate-900/50 border-y border-slate-100 dark:border-slate-800 text-brand-bronze text-xs uppercase tracking-wider">
                    <th className="px-6 py-3 font-bold">Data</th>
                    {isManager && <th className="px-6 py-3 font-bold">CS</th>}
                    <th className="px-6 py-3 font-bold">Cliente</th>
                    <th className="px-6 py-3 font-bold">Ação Realizada</th>
                    <th className="px-6 py-3 font-bold text-right">Valor (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {extrato.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{fmtData(item.data)}</td>
                      {isManager && <td className="px-6 py-4 text-sm text-brand-navy dark:text-slate-300">{item.cs}</td>}
                      <td className="px-6 py-4 text-sm font-bold text-brand-navy dark:text-white">{item.cliente || '—'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{META[item.tipo]?.label || item.tipo}</td>
                      <td className="px-6 py-4 text-sm font-bold text-emerald-600 text-right"><Money value={item.valor} prefix="+ " format={fmtBonus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {extrato.length === 0 && (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500">Nenhum ganho extra registrado ainda.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {toast.show && (
        <div className={`toast-in fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border z-50 ${toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          {toast.type === 'error' ? <AlertOctagon className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}

      {/* Modal da GESTÃO: lança bônus escolhendo o cliente (base toda) e o CS que recebe. */}
      {isManager && modalGestao && (
        <div className="fixed inset-0 bg-brand-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-brand-cream dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 p-4 flex justify-between items-center">
              <h3 className="font-bold text-brand-navy dark:text-white text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand-gold" /> Adicionar Bônus (gestão)
              </h3>
              <button onClick={() => setModalGestao(false)} className="text-slate-400 hover:text-slate-600 dark:text-slate-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Cliente (toda a base)</label>
                <select value={formGestao.customer_id} onChange={(e) => setFormGestao({ ...formGestao, customer_id: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#112240] dark:text-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-brand-navy cursor-pointer">
                  <option value="">Selecione o cliente...</option>
                  {clientesBase.map((c) => (
                    <option key={c.id_datajuri} value={c.id_datajuri}>{c.first_name} — {c.id_datajuri}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">CS que recebe o crédito</label>
                <select value={formGestao.cs_id} onChange={(e) => setFormGestao({ ...formGestao, cs_id: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#112240] dark:text-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-brand-navy cursor-pointer">
                  <option value="">Selecione o CS...</option>
                  {csAtivos.map((cs) => (
                    <option key={cs.cs_id} value={cs.cs_id}>{cs.nome} (Nível {cs.nivel})</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">Independe do dono do cliente — o valor usa o nível deste CS.</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Ação</label>
                <select value={formGestao.tipo} onChange={(e) => setFormGestao({ ...formGestao, tipo: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#112240] dark:text-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-brand-navy cursor-pointer">
                  {tiposBonus.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setModalGestao(false)} className="flex-1 bg-slate-100 text-slate-600 dark:text-slate-300 dark:bg-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Cancelar</button>
                <button type="button" disabled={salvando} onClick={handleLancarGestao} className="flex-1 bg-brand-navy text-white font-bold py-3 rounded-xl hover:bg-blue-900 shadow-md transition-colors disabled:opacity-60">{salvando ? 'Lançando...' : 'Confirmar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
