import React, { useState, useEffect } from 'react';
import { UploadCloud, PlusCircle, Search, AlertCircle, CheckCircle, FileText, Trash2 } from 'lucide-react';

const API_URL = 'http://127.0.0.1:8000/api';

export default function EprocTracker({ user }) {
  const username = user?.email || 'Gerente';

  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanStatus, setScanStatus] = useState('Parado');
  const [newCpf, setNewCpf] = useState('');
  const [newProcess, setNewProcess] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    fetchClientes();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const showNotification = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const fetchClientes = async () => {
    try {
      const res = await fetch(`${API_URL}/clientes?user=${username}`);
      const data = await res.json();
      setClientes(data.clientes || []);
    } catch (e) {
      console.error(e);
    }
  };

  const checkStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/status?user=${username}`);
      const data = await res.json();
      setScanStatus(data.message);
      setLoading(data.is_running);
      if (!data.is_running && data.message.includes('sucesso')) {
        fetchClientes();
      }
    } catch {
      // Backend pode estar iniciando
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/upload-planilha?user=${username}`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        showNotification('Planilha carregada com sucesso!');
        fetchClientes();
      } else {
        showNotification('Erro ao carregar planilha.', 'error');
      }
    } catch {
      showNotification('Erro de conexão.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/clientes?user=${username}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: newCpf, processo: newProcess }),
      });
      if (res.ok) {
        showNotification('Cliente adicionado!');
        setNewCpf('');
        setNewProcess('');
        fetchClientes();
      }
    } catch {
      showNotification('Erro ao adicionar cliente.', 'error');
    }
  };

  const handleDeleteClient = async (id) => {
    if (!window.confirm('Excluir este registro da base de monitoramento?')) return;
    setClientes(prev => prev.filter(c => c.id !== id));
    try {
      const res = await fetch(`${API_URL}/clientes/${id}?user=${username}`, { method: 'DELETE' });
      if (res.ok) {
        showNotification('Registro excluído.');
      } else {
        fetchClientes();
        showNotification('Erro ao excluir.', 'error');
      }
    } catch {
      fetchClientes();
      showNotification('Erro de conexão.', 'error');
    }
  };

  const startScan = async () => {
    try {
      setLoading(true);
      await fetch(`${API_URL}/scan?user=${username}`, { method: 'POST' });
      showNotification('Robô iniciado com sucesso!');
    } catch {
      showNotification('Erro ao ligar o robô.', 'error');
      setLoading(false);
    }
  };

  const getBadgeClass = (triagem) => {
    if (!triagem) return 'bg-slate-700 text-slate-300';
    if (triagem.includes('VERMELHO') || triagem.includes('REQUER'))
      return 'bg-red-900/50 text-red-400 border border-red-800';
    if (triagem.includes('NORMAL') || triagem.includes('LIMPO') || triagem.includes('Consultado'))
      return 'bg-emerald-900/50 text-emerald-400 border border-emerald-800';
    return 'bg-yellow-900/50 text-yellow-400 border border-yellow-800';
  };

  return (
    <div className="min-h-screen bg-[#0B192C] text-slate-200 p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Monitoramento Eproc</h1>
          <p className="text-slate-400 mt-1">Gerencie a varredura automática dos processos da sua carteira.</p>
        </div>
        <button
          onClick={startScan}
          disabled={loading}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
            loading
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-yellow-500 hover:bg-yellow-400 text-slate-900 shadow-[0_0_15px_rgba(234,179,8,0.3)]'
          }`}
        >
          {loading ? (
            <><div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> Varrendo...</>
          ) : (
            <><Search className="w-5 h-5" /> Iniciar Varredura</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#112240] p-6 rounded-xl border border-slate-700/50 flex flex-col items-center justify-center text-center border-dashed hover:border-yellow-500/50 transition-colors">
          <UploadCloud className="w-12 h-12 text-yellow-500 mb-3" />
          <h3 className="font-semibold text-lg text-white mb-2">Importar Planilha</h3>
          <p className="text-sm text-slate-400 mb-4">Suba sua base de clientes (.xlsx)</p>
          <label className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors text-sm">
            Escolher Arquivo
            <input type="file" accept=".xlsx" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>

        <div className="bg-[#112240] p-6 rounded-xl border border-slate-700/50 lg:col-span-2">
          <h3 className="font-semibold text-lg text-white mb-4 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-yellow-500" /> Adicionar Cliente Manual
          </h3>
          <form onSubmit={handleAddClient} className="flex gap-4">
            <input
              type="text"
              placeholder="CPF (obrigatório)"
              required
              value={newCpf}
              onChange={e => setNewCpf(e.target.value)}
              className="bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 w-full focus:outline-none focus:border-yellow-500 text-white"
            />
            <input
              type="text"
              placeholder="Nº Processo (vazio = Descoberta)"
              value={newProcess}
              onChange={e => setNewProcess(e.target.value)}
              className="bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 w-full focus:outline-none focus:border-yellow-500 text-white"
            />
            <button type="submit" className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded-lg font-medium transition-colors whitespace-nowrap">
              Inserir
            </button>
          </form>
        </div>
      </div>

      <div className="bg-[#112240] rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/20">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-400" /> Base de Clientes ({clientes.length})
          </h3>
          <span className={`text-sm font-medium ${loading ? 'text-yellow-500 animate-pulse' : 'text-slate-400'}`}>
            Status do Robô: {scanStatus}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-400 uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-medium">CPF</th>
                <th className="px-6 py-4 font-medium">Processo</th>
                <th className="px-6 py-4 font-medium">Classe</th>
                <th className="px-6 py-4 font-medium">Última Movimentação</th>
                <th className="px-6 py-4 font-medium">Triagem / Alerta</th>
                <th className="px-4 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {clientes.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                    Nenhum cliente cadastrado. Faça o upload ou insira manualmente acima.
                  </td>
                </tr>
              ) : (
                clientes.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{c.cpf}</td>
                    <td className="px-6 py-4 text-slate-300">
                      {c.processo ? c.processo : <span className="text-slate-500 italic">Descoberta (Busca por CPF)</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-300">{c.classe || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="text-slate-300">{c.data || '-'}</div>
                      <div className="text-xs text-slate-500 line-clamp-1">{c.desc || ''}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getBadgeClass(c.triagem)}`}>
                        {c.triagem || 'Aguardando Varredura'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => handleDeleteClient(c.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Excluir registro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast.show && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border ${
          toast.type === 'error' ? 'bg-red-900 border-red-700 text-white' : 'bg-emerald-900 border-emerald-700 text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
