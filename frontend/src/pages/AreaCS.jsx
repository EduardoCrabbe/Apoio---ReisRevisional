import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud, Search, CheckCircle, MessageCircle, Filter, X, Clock, AlertOctagon,
  Users, UserPlus, PhoneForwarded, PieChart, Trash2, RotateCcw, Loader2,
} from 'lucide-react';
import { api } from '../services/api';

// Backend grava datetime UTC naive (sem 'Z'); o JS interpretaria como local.
// Forçamos UTC para o timer de 72h ficar correto.
function parseUTC(iso) {
  if (!iso) return null;
  const s = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

export default function AreaCS({ role }) {
  const isManager = role === 'Gerente' || role === 'Supervisor';

  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('Todos');
  const [now, setNow] = useState(Date.now());

  const [modalQuitar, setModalQuitar] = useState(null);
  const [dadosQuitar, setDadosQuitar] = useState({ valorOriginal: '', valorPago: '', dataBoleto: '', dataPagamento: '' });

  const [modalNovoCliente, setModalNovoCliente] = useState(false);
  const [novoCliente, setNovoCliente] = useState({ id: '', nome: '', uf: 'SP', contrato: 'Veículo', tem_processo: 'Não', criticidade: 'Regular' });
  const [uploadLoading, setUploadLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const fileInputRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  useEffect(() => {
    fetchClientes();
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchClientes = async () => {
    try {
      const data = await api.get('/api/clientes');
      setClientes(Array.isArray(data) ? data : []);
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploadLoading(true);
    try {
      const data = await api.post('/api/clientes/importar', formData);
      await fetchClientes();
      showToast(data.message || 'Planilha importada com sucesso!');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploadLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Atualização otimista com REVERT: aplica local, chama API; se falhar, reverte
  // ao snapshot anterior e mostra a mensagem do backend.
  const acaoOtimista = async (snapshotUpdater, apiCall, okMsg) => {
    const anterior = clientes;
    setClientes(snapshotUpdater(anterior));
    try {
      await apiCall();
      await fetchClientes();
      if (okMsg) showToast(okMsg);
    } catch (err) {
      setClientes(anterior); // reverte
      showToast(err.message, 'error');
    }
  };

  const handleAtendimento = (id) =>
    acaoOtimista(
      (prev) => prev.map((c) => c.id_datajuri === id ? { ...c, contatos: (c.contatos || 0) + 1, ultimo_contato: new Date().toISOString() } : c),
      () => api.post(`/api/clientes/${id}/atendimento`),
    );

  const handleDesfazer = (id) =>
    acaoOtimista(
      (prev) => prev.map((c) => c.id_datajuri === id ? { ...c, contatos: Math.max(0, (c.contatos || 0) - 1) } : c),
      () => api.del(`/api/clientes/${id}/atendimento`),
    );

  const handleTentativa = (id) =>
    acaoOtimista(
      (prev) => prev.map((c) => c.id_datajuri === id ? { ...c, tentativas: (c.tentativas || 0) + 1 } : c),
      () => api.post(`/api/clientes/${id}/tentativa`),
    );

  const handleExcluir = (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este cliente?')) return;
    acaoOtimista(
      (prev) => prev.filter((c) => c.id_datajuri !== id),
      () => api.del(`/api/clientes/${id}`),
      'Cliente removido.',
    );
  };

  const handleChangeField = (id, campo, valor) =>
    acaoOtimista(
      (prev) => prev.map((c) => c.id_datajuri === id ? { ...c, [campo]: valor } : c),
      () => api.put(`/api/clientes/${id}`, { [campo]: valor }),
    );

  const handleAddCliente = async () => {
    if (!novoCliente.id || !novoCliente.nome) {
      showToast('Preencha o ID e o Nome do cliente.', 'error');
      return;
    }
    try {
      await api.post('/api/clientes', {
        id_datajuri: novoCliente.id,
        first_name: novoCliente.nome,
        uf: novoCliente.uf,
        contrato: novoCliente.contrato,
        tem_processo: novoCliente.tem_processo,
        criticidade: novoCliente.criticidade,
      });
      setModalNovoCliente(false);
      setNovoCliente({ id: '', nome: '', uf: 'SP', contrato: 'Veículo', tem_processo: 'Não', criticidade: 'Regular' });
      await fetchClientes();
      showToast('Cliente cadastrado.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleResetMensal = async () => {
    if (!window.confirm('Zerar atendimentos e tentativas de TODOS os clientes ativos? Não pode ser desfeito.')) return;
    try {
      const data = await api.post('/api/clientes/reset-mensal');
      await fetchClientes();
      showToast(data.message || 'Reset mensal concluído.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const confirmarQuitar = async (e) => {
    e.preventDefault();
    const valorOriginal = parseFloat(dadosQuitar.valorOriginal);
    const valorPago = parseFloat(dadosQuitar.valorPago);
    if (Number.isNaN(valorOriginal) || Number.isNaN(valorPago)) {
      showToast('Informe os valores original e pago.', 'error');
      return;
    }
    try {
      await api.post(`/api/clientes/${modalQuitar.id_datajuri}/quitar`, {
        valor_original: valorOriginal,
        valor_pago: valorPago,
        data_boleto: dadosQuitar.dataBoleto || null,
        data_pagamento: dadosQuitar.dataPagamento || null,
      });
      setModalQuitar(null);
      setDadosQuitar({ valorOriginal: '', valorPago: '', dataBoleto: '', dataPagamento: '' });
      await fetchClientes();
      showToast('Contrato quitado com sucesso!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const clientesVisiveis = clientes.filter((c) => {
    if (c.status !== 'Ativo') return false;
    if (filtroTipo !== 'Todos' && c.contrato !== filtroTipo) return false;
    if (busca) {
      const termo = busca.toLowerCase();
      if (!(c.first_name || '').toLowerCase().includes(termo) && !(c.id_datajuri || '').toLowerCase().includes(termo)) return false;
    }
    return true;
  });

  const totalAtivos = clientes.filter((c) => c.status === 'Ativo').length;
  const atendidos = clientes.filter((c) => c.status === 'Ativo' && c.contatos > 0).length;
  const emTentativa = clientes.filter((c) => c.status === 'Ativo' && c.contatos === 0 && c.tentativas > 0).length;
  const naoAtendidos = totalAtivos - atendidos - emTentativa;
  const pctAtendidos = totalAtivos > 0 ? Math.round((atendidos / totalAtivos) * 100) : 0;
  const pctNaoAtendidos = totalAtivos > 0 ? Math.round((naoAtendidos / totalAtivos) * 100) : 0;

  const getCriticidadeStyle = (nivel) => {
    if (nivel === 'Crítico') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
    if (nivel === 'Atenção') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
    return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
  };

  return (
    <div className="space-y-6 pb-12 relative">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-brand-navy dark:text-white">Meus Clientes</h2>
          <p className="text-brand-bronze mt-1">Gerencie sua lista, filtre contratos e registre atendimentos e tentativas.</p>
        </div>
        <div className="flex gap-3">
          {isManager && (
            <button onClick={handleResetMensal} className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-xl font-bold shadow-sm hover:bg-red-500 hover:text-white flex items-center gap-2 transition-all" title="Zerar atendimentos e tentativas do mês">
              <RotateCcw className="w-5 h-5" /> Reset Mensal
            </button>
          )}
          <button onClick={() => setModalNovoCliente(true)} className="bg-brand-navy text-white px-4 py-2 rounded-xl font-medium shadow-sm hover:bg-blue-900 flex items-center gap-2 transition-colors">
            <UserPlus className="w-5 h-5 text-brand-gold" /> Novo Cliente
          </button>
          <label className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-brand-navy dark:text-white px-4 py-2 rounded-xl font-medium shadow-sm hover:bg-slate-50 flex items-center gap-2 transition-colors ${uploadLoading ? 'cursor-wait opacity-70' : 'cursor-pointer'}`}>
            {uploadLoading
              ? <><Loader2 className="w-5 h-5 text-brand-bronze animate-spin" />Importando...</>
              : <><UploadCloud className="w-5 h-5 text-brand-bronze" />Importar Planilha</>}
            <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileUpload} disabled={uploadLoading} />
          </label>
        </div>
      </header>

      {/* Mini-Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-500 rounded-lg"><Users className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Total de Clientes</p><p className="text-2xl font-black text-brand-navy dark:text-white">{totalAtivos}</p></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-500 rounded-lg"><PieChart className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Atendidos</p><p className="text-2xl font-black text-emerald-600">{atendidos} <span className="text-sm font-medium text-slate-400">({pctAtendidos}%)</span></p></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-orange-50 text-orange-500 rounded-lg"><PhoneForwarded className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Tentativas</p><p className="text-2xl font-black text-orange-600">{emTentativa}</p></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-500 rounded-lg"><AlertOctagon className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Não Atendidos</p><p className="text-2xl font-black text-rose-600">{naoAtendidos} <span className="text-sm font-medium text-slate-400">({pctNaoAtendidos}%)</span></p></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-center col-span-2 md:col-span-1">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-2">Progresso da Base</p>
          <div className="w-full bg-slate-100 rounded-full h-2.5"><div className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${pctAtendidos}%` }}></div></div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 w-full relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Localização Rápida (Nome ou ID)..." value={busca} onChange={e => setBusca(e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-brand-navy shadow-sm transition-colors" />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-brand-bronze" />
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="w-full md:w-auto text-sm border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-brand-navy shadow-sm cursor-pointer">
              <option value="Todos">Filtrar por: Todos os Tipos</option>
              <option value="Veículo">Apenas Veículo</option>
              <option value="Empréstimo">Apenas Empréstimo</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-brand-cream dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-brand-bronze text-xs uppercase tracking-wider">
                <th className="px-4 py-4 font-bold">ID DataJuri</th>
                <th className="px-4 py-4 font-bold">Nome do Cliente</th>
                <th className="px-4 py-4 font-bold">Criticidade</th>
                <th className="px-4 py-4 font-bold">Contrato / Proc.</th>
                <th className="px-4 py-4 font-bold text-center">Atendimento</th>
                <th className="px-4 py-4 font-bold text-center">Tentativas</th>
                <th className="px-4 py-4 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clientesVisiveis.map((cliente) => {
                let isBlocked = false;
                let timerDisplay = null;
                const ultimoMs = parseUTC(cliente.ultimo_contato);

                if (cliente.contatos >= 6) {
                  isBlocked = true;
                  timerDisplay = 'Limite atingido';
                } else if (ultimoMs) {
                  const diffHoras = (now - ultimoMs) / (1000 * 60 * 60);
                  if (diffHoras < 72) {
                    isBlocked = true;
                    const horasRestantes = Math.floor(72 - diffHoras);
                    const minRestantes = Math.floor(((72 - diffHoras) * 60) % 60);
                    timerDisplay = `${horasRestantes}h ${minRestantes}m`;
                  }
                }

                const isCritical = cliente.criticidade === 'Crítico';

                return (
                  <tr key={cliente.id_datajuri} className={`transition-colors ${isCritical ? 'bg-red-50/30 hover:bg-red-50/60' : 'hover:bg-slate-50 dark:bg-[#0B192C]'}`}>
                    <td className="px-4 py-4 text-sm font-medium text-slate-500 dark:text-slate-400">{cliente.id_datajuri}</td>
                    <td className="px-4 py-4">
                      <div className={`text-sm font-bold flex items-center gap-2 ${isCritical ? 'text-red-700' : 'text-brand-navy dark:text-white'}`}>
                        {cliente.first_name}
                        {isCritical && <AlertOctagon className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{cliente.uf}</div>
                    </td>
                    <td className="px-4 py-4">
                      <select value={cliente.criticidade} onChange={(e) => handleChangeField(cliente.id_datajuri, 'criticidade', e.target.value)} className={`text-xs border rounded-lg p-1.5 focus:outline-none cursor-pointer font-bold transition-colors shadow-sm ${getCriticidadeStyle(cliente.criticidade)}`}>
                        <option value="Crítico">Crítico (Semanal)</option>
                        <option value="Atenção">Atenção (Quinzenal)</option>
                        <option value="Regular">Regular (Mensal)</option>
                      </select>
                    </td>
                    <td className="px-4 py-4 space-y-1">
                      <div className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${cliente.contrato === 'Veículo' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}>
                        {cliente.contrato || '—'}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">Processo:</span>
                        <select value={cliente.tem_processo} onChange={(e) => handleChangeField(cliente.id_datajuri, 'tem_processo', e.target.value)} className={`text-[10px] border rounded p-0.5 focus:outline-none cursor-pointer font-bold ${cliente.tem_processo === 'Sim' ? 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' : 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'}`}>
                          <option value="Sim">Sim</option>
                          <option value="Não">Não</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleDesfazer(cliente.id_datajuri)} disabled={cliente.contatos === 0} className={`p-1.5 rounded-lg border transition-colors ${cliente.contatos > 0 ? 'border-red-200 text-red-500 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30' : 'border-slate-100 text-slate-300 dark:border-slate-700 dark:text-slate-600 cursor-not-allowed'}`} title="Desfazer atendimento">
                          <X className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleAtendimento(cliente.id_datajuri)} disabled={isBlocked} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${isBlocked ? 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700 cursor-not-allowed' : 'bg-brand-cream dark:bg-slate-900/50 text-brand-navy dark:text-white border-brand-gold hover:bg-brand-gold hover:text-white shadow-sm hover:shadow'}`}>
                          <MessageCircle className="w-4 h-4" />
                          {cliente.contatos > 0 ? `Atendido (${cliente.contatos})` : 'Atender'}
                        </button>
                      </div>
                      {isBlocked && (
                        <p className={`text-[10px] font-bold mt-1 flex items-center justify-center gap-1 ${cliente.contatos >= 6 ? 'text-slate-400' : 'text-amber-600'}`}>
                          {cliente.contatos < 6 && <Clock className="w-3 h-3" />}
                          {timerDisplay}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button onClick={() => handleTentativa(cliente.id_datajuri)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 hover:text-slate-800 transition-all shadow-sm" title="Marcar tentativa sem retorno">
                        <PhoneForwarded className="w-4 h-4 text-orange-500" />
                        {cliente.tentativas > 0 ? `+${cliente.tentativas}` : 'Tentativa'}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setModalQuitar(cliente)} className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-500 hover:text-white border border-emerald-200 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-all">
                          <CheckCircle className="w-4 h-4" /> Quitar
                        </button>
                        <button onClick={() => handleExcluir(cliente.id_datajuri)} className="p-1.5 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white border border-red-200 rounded-lg shadow-sm transition-all" title="Excluir Cliente">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {clientesVisiveis.length === 0 && (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              <p>Nenhum cliente na sua base. Importe sua planilha do DataJuri.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Quitação */}
      {modalQuitar && (
        <div className="fixed inset-0 bg-brand-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-brand-cream dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 p-4 flex justify-between items-center">
              <h3 className="font-bold text-brand-navy dark:text-white text-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" /> Quitar Contrato
              </h3>
              <button onClick={() => setModalQuitar(null)} className="text-slate-400 hover:text-slate-600 dark:text-slate-300"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={confirmarQuitar} className="p-6 space-y-4">
              <div className="mb-2">
                <p className="text-sm text-slate-500 dark:text-slate-400">Registrando liquidação de:</p>
                <p className="text-lg font-bold text-brand-navy dark:text-white">{modalQuitar.first_name}</p>
                <p className="text-xs text-brand-bronze uppercase font-bold">{modalQuitar.id_datajuri}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Valor Original (R$)</label>
                  <input type="number" step="0.01" min="0" required value={dadosQuitar.valorOriginal} onChange={e => setDadosQuitar({ ...dadosQuitar, valorOriginal: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Valor Pago (R$)</label>
                  <input type="number" step="0.01" min="0" required value={dadosQuitar.valorPago} onChange={e => setDadosQuitar({ ...dadosQuitar, valorPago: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Data do Envio do Boleto</label>
                <input type="date" value={dadosQuitar.dataBoleto} onChange={e => setDadosQuitar({ ...dadosQuitar, dataBoleto: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Data do Pagamento Efetuado</label>
                <input type="date" value={dadosQuitar.dataPagamento} onChange={e => setDadosQuitar({ ...dadosQuitar, dataPagamento: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setModalQuitar(null)} className="flex-1 bg-slate-100 text-slate-600 dark:text-slate-300 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 bg-emerald-500 text-white font-bold py-3 rounded-xl hover:bg-emerald-600 shadow-md transition-colors">Confirmar Quitação</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast.show && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border z-50 ${toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/80 dark:border-red-700 dark:text-red-200' : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/80 dark:border-emerald-700 dark:text-emerald-200'}`}>
          {toast.type === 'error' ? <AlertOctagon className="w-5 h-5 flex-shrink-0" /> : <CheckCircle className="w-5 h-5 flex-shrink-0" />}
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}

      {/* Modal Novo Cliente */}
      {modalNovoCliente && (
        <div className="fixed inset-0 bg-brand-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-brand-cream dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 p-4 flex justify-between items-center">
              <h3 className="font-bold text-brand-navy dark:text-white text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand-gold" /> Cadastrar Novo Cliente
              </h3>
              <button onClick={() => setModalNovoCliente(false)} className="text-slate-400 hover:text-slate-600 dark:text-slate-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">ID DataJuri</label>
                <input type="text" placeholder="Ex: 100210" value={novoCliente.id} onChange={e => setNovoCliente({ ...novoCliente, id: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-brand-navy" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Primeiro Nome <span className="text-xs font-normal text-slate-400">(LGPD: só o primeiro)</span></label>
                <input type="text" placeholder="Ex: João" value={novoCliente.nome} onChange={e => setNovoCliente({ ...novoCliente, nome: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-brand-navy" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">UF</label>
                  <input type="text" maxLength={2} value={novoCliente.uf} onChange={e => setNovoCliente({ ...novoCliente, uf: e.target.value.toUpperCase() })} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-brand-navy" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Contrato</label>
                  <select value={novoCliente.contrato} onChange={e => setNovoCliente({ ...novoCliente, contrato: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-brand-navy">
                    <option value="Veículo">Veículo</option>
                    <option value="Empréstimo">Empréstimo</option>
                  </select>
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setModalNovoCliente(false)} className="flex-1 bg-slate-100 text-slate-600 dark:text-slate-300 dark:bg-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Cancelar</button>
                <button type="button" onClick={handleAddCliente} className="flex-1 bg-brand-navy text-white font-bold py-3 rounded-xl hover:bg-blue-900 shadow-md transition-colors">Confirmar Cadastro</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
