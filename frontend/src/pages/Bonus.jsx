import React, { useState } from 'react';
import { PlusCircle, Star, MessageSquare, Image as ImageIcon, Video, History } from 'lucide-react';

export default function Bonus({ role }) {
  const isManager = role === 'Gerente' || role === 'Supervisor';

  const [extrato, setExtrato] = useState([
    { data: '27/05/2026', cs: 'Edu crabbe', cliente: 'João da Silva Santos', tipo: 'Comentário/Quitação', valor: 5.00 },
    { data: '26/05/2026', cs: 'Ana Souza', cliente: 'Maria Oliveira', tipo: 'Vídeo Depoimento', valor: 15.00 }
  ]);

  const [form, setForm] = useState({ cliente: '', tipo: 'Quitacao' });

  const tiposBonus = [
    { id: 'Quitacao', label: 'Quitação', icon: MessageSquare, valor12: 5.00, valor35: 10.00 },
    { id: 'ComentarioGoogle', label: 'Comentário Google (Positivo)', icon: Star, valor12: 5.00, valor35: 10.00 },
    { id: 'FotoBoleto', label: 'Foto com Boleto (Quitação)', icon: ImageIcon, valor12: 5.00, valor35: 10.00 },
    { id: 'ReclameAqui', label: 'Reclame Aqui (Positivo)', icon: Star, valor12: 10.00, valor35: 15.00 },
    { id: 'VideoDepoimento', label: 'Depoimento por Vídeo', icon: Video, valor12: 15.00, valor35: 20.00 }
  ];

  const handleLancamento = (e) => {
    e.preventDefault();
    if (!form.cliente) return;
    
    // Na fase de testes, o usuário logado é o Edu crabbe
    const loggedInUser = 'Edu crabbe';
    
    // Buscar o nível do CS no "banco de dados" (localStorage configurado pelo gerente)
    const equipe = JSON.parse(localStorage.getItem('equipeCS') || '[]');
    const csData = equipe.find(cs => cs.nome === loggedInUser);
    const nivelCS = csData ? csData.nivel : 1; // Default para nível 1 se não achar
    
    const isHighLevel = nivelCS >= 3;
    const tipoSelecionado = tiposBonus.find(t => t.id === form.tipo);
    const valorCalculado = isHighLevel ? tipoSelecionado.valor35 : tipoSelecionado.valor12;

    // Simulating frontend adding to extrato (Mocking API call)
    setExtrato([
      { data: new Date().toLocaleDateString('pt-BR'), cs: 'Edu crabbe', cliente: form.cliente, tipo: tipoSelecionado.label, valor: valorCalculado },
      ...extrato
    ]);
    setForm({ ...form, cliente: '' });
  };

  // Pegar nível do CS atual para mostrar apenas o valor real que ele tem direito
  const loggedInUser = 'Edu crabbe';
  const equipe = JSON.parse(localStorage.getItem('equipeCS') || '[]');
  const csData = equipe.find(cs => cs.nome === loggedInUser);
  const nivelCS = csData ? csData.nivel : 1;
  const isHighLevel = nivelCS >= 3;

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-brand-navy dark:text-white">Bônus & Comissões</h2>
        <p className="text-brand-bronze mt-1">Lançamento manual de comissões por metas alcançadas (Níveis 1 a 5).</p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {!isManager && (
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-brand-navy dark:bg-slate-900 p-6 rounded-2xl shadow-xl text-white border border-brand-navy/10 dark:border-slate-800">
              <h3 className="text-lg font-bold border-b border-white/10 pb-4 mb-4 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-brand-gold" />
                Novo Lançamento
              </h3>
              <form onSubmit={handleLancamento} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">ID ou Nome do Cliente</label>
                  <input 
                    type="text" 
                    value={form.cliente}
                    onChange={e => setForm({...form, cliente: e.target.value})}
                    className="w-full bg-white/5 border border-white/20 rounded-lg p-2.5 text-white placeholder-white/30 focus:outline-none focus:border-brand-gold transition-colors"
                    placeholder="Ex: 1002345..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Tipo de Bônus</label>
                  <div className="space-y-2">
                    {tiposBonus.map((tipo) => (
                      <label key={tipo.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${form.tipo === tipo.id ? 'bg-brand-gold/20 border-brand-gold text-white' : 'border-white/10 text-white/60 hover:bg-white/5'}`}>
                        <input 
                          type="radio" 
                          name="tipoBonus" 
                          value={tipo.id} 
                          checked={form.tipo === tipo.id}
                          onChange={() => setForm({...form, tipo: tipo.id})}
                          className="hidden"
                        />
                        <tipo.icon className={`w-4 h-4 flex-shrink-0 ${form.tipo === tipo.id ? 'text-brand-gold' : ''}`} />
                        <span className="text-sm font-medium flex-1">{tipo.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button type="submit" className="w-full bg-brand-gold hover:bg-[#b8952b] text-brand-navy font-bold py-3 rounded-xl transition-colors shadow-lg mt-4">
                  Registrar Bônus
                </button>
              </form>
            </div>
          </div>
        )}

        <div className={isManager ? "lg:col-span-3" : "lg:col-span-2"}>
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
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{item.data}</td>
                      {isManager && <td className="px-6 py-4 text-sm text-brand-navy dark:text-slate-300">{item.cs}</td>}
                      <td className="px-6 py-4 text-sm font-bold text-brand-navy dark:text-white">{item.cliente}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{item.tipo}</td>
                      <td className="px-6 py-4 text-sm font-bold text-emerald-600 text-right">
                        {item.valor > 0 ? `+ R$ ${item.valor.toFixed(2)}` : 'Em proc.'}
                      </td>
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
    </div>
  );
}
