import React, { useState, useEffect } from 'react';
import { PlusCircle, Star, MessageSquare, Image as ImageIcon, Video, History, CheckCircle, AlertOctagon } from 'lucide-react';
import { api } from '../services/api';

// Rótulos/ícones amigáveis para as ações da commission_table (a ação "Atendimento"
// não é um bônus manual — fica de fora). VALORES vêm da API, nunca hardcoded.
const META = {
  Quitacao: { label: 'Quitação', icon: MessageSquare },
  ComentarioGoogle: { label: 'Comentário Google (Positivo)', icon: Star },
  FotoBoleto: { label: 'Foto com Boleto (Quitação)', icon: ImageIcon },
  ReclameAqui: { label: 'Reclame Aqui (Positivo)', icon: Star },
  VideoDepoimento: { label: 'Depoimento por Vídeo', icon: Video },
};

export default function Bonus({ role, user }) {
  const isManager = role === 'Gerente' || role === 'Supervisor';
  const nivel = user?.level_cs || 1;
  const usaNivelAlto = nivel >= 3; // 1-2 vs 3-5 (brackets da tabela)

  const [tabela, setTabela] = useState([]);
  const [extrato, setExtrato] = useState([]);
  const [form, setForm] = useState({ customer_id: '', tipo: 'Quitacao' });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

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

  useEffect(() => { fetchTabela(); fetchExtrato(); }, []);

  const valorDe = (acao) => {
    const regra = tabela.find((t) => t.acao === acao);
    if (!regra) return null;
    return usaNivelAlto ? regra.valor_nivel_3_5 : regra.valor_nivel_1_2;
  };

  // Tipos de bônus = ações da tabela que têm rótulo definido (exclui Atendimento).
  const tiposBonus = tabela.filter((t) => META[t.acao]).map((t) => ({ id: t.acao, ...META[t.acao] }));

  const handleLancamento = async (e) => {
    e.preventDefault();
    if (!form.customer_id) { showToast('Informe o ID do cliente.', 'error'); return; }
    try {
      await api.post('/api/bonus', { customer_id: form.customer_id, tipo: form.tipo });
      setForm({ ...form, customer_id: '' });
      await fetchExtrato();
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
      <header>
        <h2 className="text-3xl font-bold text-brand-navy dark:text-white">Bônus & Comissões</h2>
        <p className="text-brand-bronze mt-1">Lançamento de comissões por metas. Valores vêm da tabela oficial (Nível {nivel}).</p>
      </header>

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
                          {valor != null && <span className="text-xs font-bold text-brand-gold">+ R$ {valor.toFixed(2)}</span>}
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
                      <td className="px-6 py-4 text-sm font-bold text-emerald-600 text-right">+ R$ {(item.valor || 0).toFixed(2)}</td>
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
        <div className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border z-50 ${toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          {toast.type === 'error' ? <AlertOctagon className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
