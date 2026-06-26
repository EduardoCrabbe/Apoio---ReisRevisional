import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft, UploadCloud, Search, Filter, X, AlertOctagon, Users, UserPlus,
  PhoneForwarded, PieChart, Trash2, CheckCircle, Loader2,
} from 'lucide-react';
import { api } from '../services/api';
import { notifyDataChanged } from '../services/refresh';
import { SkeletonRows } from '../components/Skeleton';

/**
 * Drill-down da gestão: carteira de UM CS específico (Gerente/Supervisor).
 * Mesma estrutura visual da AreaCS, mas SEM Atender/Tentativa/Quitar — a gestão
 * observa e gerencia: só importar planilha, adicionar e excluir cliente.
 */
export default function GestaoClientes() {
  const { cs_id } = useParams();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const tap = reduce ? undefined : { scale: 0.97 };

  const [clientes, setClientes] = useState([]);
  const [nomeCS, setNomeCS] = useState('');
  const [loading, setLoading] = useState(true); // skeleton só na primeira carga
  const [busy, setBusy] = useState(() => new Set());
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('Todos');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const [modalNovoCliente, setModalNovoCliente] = useState(false);
  const [novoCliente, setNovoCliente] = useState({ id: '', nome: '', uf: 'SP', contrato: 'Veículo', tem_processo: 'Não', criticidade: 'Regular' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const fetchClientes = async () => {
    try {
      const data = await api.get(`/api/clientes?cs_id=${cs_id}`);
      setClientes(Array.isArray(data) ? data : []);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Nome do CS para o título — vem da lista de equipe.
  const fetchNomeCS = async () => {
    try {
      const equipe = await api.get('/api/equipe');
      const cs = (Array.isArray(equipe) ? equipe : []).find((c) => String(c.cs_id) === String(cs_id));
      setNomeCS(cs?.nome || `CS #${cs_id}`);
    } catch {
      setNomeCS(`CS #${cs_id}`);
    }
  };

  useEffect(() => {
    fetchClientes();
    fetchNomeCS();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cs_id]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('cs_id', cs_id); // importa para a carteira DESTE CS
    setUploadLoading(true);
    try {
      const data = await api.post('/api/clientes/importar', formData);
      await fetchClientes();
      showToast(data.message || 'Planilha importada com sucesso!');
      notifyDataChanged();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploadLoading(false);
      e.target.value = '';
    }
  };

  const handleExcluir = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este cliente?')) return;
    if (busy.has(`del-${id}`)) return; // previne duplo clique
    setBusy((p) => new Set(p).add(`del-${id}`));
    const anterior = clientes;
    setClientes((prev) => prev.filter((c) => c.id_datajuri !== id)); // otimista
    try {
      await api.del(`/api/clientes/${id}`);
      showToast('Cliente removido.');
      notifyDataChanged();
    } catch (err) {
      setClientes(anterior); // reverte
      showToast(err.message, 'error');
    } finally {
      setBusy((p) => { const n = new Set(p); n.delete(`del-${id}`); return n; });
    }
  };

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
        cs_id: Number(cs_id), // já atribui ao CS visualizado
      });
      setModalNovoCliente(false);
      setNovoCliente({ id: '', nome: '', uf: 'SP', contrato: 'Veículo', tem_processo: 'Não', criticidade: 'Regular' });
      await fetchClientes();
      showToast('Cliente cadastrado.');
      notifyDataChanged();
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
      <header className="flex justify-between items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/equipe-cs')} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-brand-navy dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" title="Voltar para Equipe CS">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-3xl font-bold text-brand-navy dark:text-white">Clientes de {nomeCS}</h2>
            <p className="text-brand-bronze mt-1">Carteira do CS — a gestão importa, adiciona e exclui (não atende).</p>
          </div>
        </div>
        <div className="flex gap-3">
          <motion.button whileTap={tap} onClick={() => setModalNovoCliente(true)} className="bg-brand-navy text-white px-4 py-2 rounded-xl font-medium shadow-sm hover:bg-blue-900 flex items-center gap-2 transition-colors">
            <UserPlus className="w-5 h-5 text-brand-gold" /> Novo Cliente
          </motion.button>
          <label className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-brand-navy dark:text-white px-4 py-2 rounded-xl font-medium shadow-sm hover:bg-slate-50 flex items-center gap-2 transition-colors ${uploadLoading ? 'cursor-wait opacity-70' : 'cursor-pointer'}`}>
            {uploadLoading
              ? <><Loader2 className="w-5 h-5 text-brand-bronze animate-spin" />Importando...</>
              : <><UploadCloud className="w-5 h-5 text-brand-bronze" />Importar Planilha</>}
            <input type="file" accept=".xlsx" className="hidden" onChange={handleFileUpload} disabled={uploadLoading} />
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
          {loading ? <SkeletonRows rows={4} cols={5} /> : (<>
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-brand-cream dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-brand-bronze text-xs uppercase tracking-wider">
                <th className="px-4 py-4 font-bold">ID DataJuri</th>
                <th className="px-4 py-4 font-bold">Nome do Cliente</th>
                <th className="px-4 py-4 font-bold">Criticidade</th>
                <th className="px-4 py-4 font-bold">Contrato / Proc.</th>
                <th className="px-4 py-4 font-bold text-center">Atend.</th>
                <th className="px-4 py-4 font-bold text-center">Tent.</th>
                <th className="px-4 py-4 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clientesVisiveis.map((cliente) => {
                const delBusy = busy.has(`del-${cliente.id_datajuri}`);
                return (
                  <tr key={cliente.id_datajuri} className="transition-colors hover:bg-slate-50 dark:bg-[#0B192C]">
                    <td className="px-4 py-4 text-sm font-medium text-slate-500 dark:text-slate-400">{cliente.id_datajuri}</td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-bold flex items-center gap-2 text-brand-navy dark:text-white">
                        {cliente.first_name}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{cliente.uf}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs border rounded-lg px-2 py-1 font-bold ${getCriticidadeStyle(cliente.criticidade)}`}>{cliente.criticidade}</span>
                    </td>
                    <td className="px-4 py-4 space-y-1">
                      <div className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${cliente.contrato === 'Veículo' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}>
                        {cliente.contrato || '—'}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">Processo:</span>
                        <span className={`text-[10px] font-bold ${cliente.tem_processo === 'Sim' ? 'text-amber-600' : 'text-emerald-600'}`}>{cliente.tem_processo}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-bold text-emerald-600">{cliente.contatos || 0}</td>
                    <td className="px-4 py-4 text-center text-sm font-bold text-orange-600">{cliente.tentativas || 0}</td>
                    <td className="px-4 py-4 text-right">
                      <motion.button whileTap={tap} onClick={() => handleExcluir(cliente.id_datajuri)} disabled={delBusy} className="p-1.5 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white border border-red-200 rounded-lg shadow-sm transition-all disabled:opacity-60" title="Excluir Cliente">
                        {delBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </motion.button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {clientesVisiveis.length === 0 && (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              <p>Nenhum cliente nesta carteira. Importe a planilha do DataJuri ou adicione manualmente.</p>
            </div>
          )}
          </>)}
        </div>
      </div>

      {toast.show && (
        <div className={`toast-in fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border z-50 ${toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/80 dark:border-red-700 dark:text-red-200' : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/80 dark:border-emerald-700 dark:text-emerald-200'}`}>
          {toast.type === 'error' ? <AlertOctagon className="w-5 h-5 flex-shrink-0" /> : <CheckCircle className="w-5 h-5 flex-shrink-0" />}
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}

      {/* Modal Novo Cliente (já atribuído a este CS) */}
      {modalNovoCliente && (
        <div className="fixed inset-0 bg-brand-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-brand-cream dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 p-4 flex justify-between items-center">
              <h3 className="font-bold text-brand-navy dark:text-white text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand-gold" /> Novo Cliente para {nomeCS}
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
