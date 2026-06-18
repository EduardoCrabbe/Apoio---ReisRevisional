import React, { useState, useEffect } from 'react';
import { UserPlus, X, Save } from 'lucide-react';

export default function Configuracoes() {
  const [equipe, setEquipe] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [novoCS, setNovoCS] = useState({ nome: '', email: '', nivel: 1 });

  useEffect(() => {
    const saved = localStorage.getItem('equipeCS');
    if (saved) {
      setEquipe(JSON.parse(saved));
    } else {
      const defaultEquipe = [
        { id: 1, nome: 'Edu crabbe', email: 'eduardo@reisrevisional.com.br', nivel: 1, totalClientes: 100, atendidos: 60, quitacoes: 4, comentarios: 12, ganhos: 345.50 },
        { id: 2, nome: 'Ana Souza', email: 'ana@reisrevisional.com.br', nivel: 3, totalClientes: 120, atendidos: 100, quitacoes: 8, comentarios: 20, ganhos: 850.00 }
      ];
      setEquipe(defaultEquipe);
      localStorage.setItem('equipeCS', JSON.stringify(defaultEquipe));
    }
  }, []);

  const handleLevelChange = (id, newNivel) => {
    const updated = equipe.map(cs => cs.id === id ? { ...cs, nivel: Number(newNivel) } : cs);
    setEquipe(updated);
    localStorage.setItem('equipeCS', JSON.stringify(updated));
  };

  const handleAddCS = (e) => {
    if (e) e.preventDefault();
    if (!novoCS.nome || !novoCS.email) {
      alert('Por favor, preencha o Nome e o E-mail do CS!');
      return;
    }

    const newCsEntry = {
      id: Date.now(),
      nome: novoCS.nome,
      email: novoCS.email,
      nivel: Number(novoCS.nivel),
      totalClientes: 0,
      atendidos: 0,
      quitacoes: 0,
      comentarios: 0,
      ganhos: 0.0
    };

    const updatedEquipe = [...equipe, newCsEntry];
    setEquipe(updatedEquipe);
    localStorage.setItem('equipeCS', JSON.stringify(updatedEquipe));
    setIsModalOpen(false);
    setNovoCS({ nome: '', email: '', nivel: 1 });
  };

  return (
    <div className="space-y-8 max-w-4xl pb-12 relative">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-brand-navy dark:text-white">Configurações do Sistema</h2>
          <p className="text-slate-500 mt-1">Acesso restrito para Supervisor e Gerente.</p>
        </div>
        <div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-brand-navy text-white px-4 py-2 rounded-xl font-medium shadow-sm hover:bg-blue-900 flex items-center gap-2 transition-colors"
          >
            <UserPlus className="w-5 h-5 text-brand-gold" />
            Adicionar CS
          </button>
        </div>
      </header>
      
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">Gerenciamento de Equipe</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Atribua o nível de bônus para cada Customer Success. O nível afeta diretamente o cálculo de comissionamento de cada um.
        </p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse mb-4">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 font-bold">Nome do CS</th>
                <th className="px-4 py-3 font-bold">Email</th>
                <th className="px-4 py-3 font-bold text-center">Nível Atual</th>
                <th className="px-4 py-3 font-bold text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
              {equipe.map((cs) => (
                <tr key={cs.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-4 text-brand-navy dark:text-slate-200 font-bold">{cs.nome}</td>
                  <td className="px-4 py-4 text-slate-500 dark:text-slate-400">{cs.email}</td>
                  <td className="px-4 py-4 text-center">
                    <select 
                      value={cs.nivel}
                      onChange={(e) => handleLevelChange(cs.id, e.target.value)}
                      className="border border-slate-200 dark:border-slate-600 rounded p-1.5 font-bold text-brand-navy dark:text-slate-200 bg-white dark:bg-[#112240] cursor-pointer shadow-sm focus:outline-none focus:border-brand-gold"
                    >
                      <option value={1}>Nível 1</option>
                      <option value={2}>Nível 2</option>
                      <option value={3}>Nível 3</option>
                      <option value={4}>Nível 4</option>
                      <option value={5}>Nível 5</option>
                    </select>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button className="text-emerald-600 hover:text-emerald-500 font-bold flex items-center gap-1 justify-end w-full">
                      <Save className="w-4 h-4" /> Salvo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Prompt da Inteligência Artificial</h3>
        <p className="text-sm text-slate-500 mb-4">
          Este é o prompt base que a IA usará para transcrever áudios e sumarizar os atendimentos do CS. Lembre-se de instruir a IA a falar em primeira pessoa.
        </p>
        
        <textarea 
          className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
          defaultValue="Aja como se fosse eu (um CS da Reis Revisional). Crie um resumo amigável do atendimento transcrito..."
        ></textarea>

        <div className="flex justify-end mt-4">
          <button onClick={() => alert('Prompt salvo com sucesso!')} className="bg-brand-navy text-white px-6 py-2 rounded-xl font-bold shadow-sm hover:bg-blue-900 transition-colors">
            Salvar Prompt
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-brand-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-brand-cream dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 p-4 flex justify-between items-center">
              <h3 className="font-bold text-brand-navy dark:text-white text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand-gold" />
                Cadastrar Novo CS
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Nome Completo</label>
                <input 
                  type="text"
                  required
                  value={novoCS.nome}
                  onChange={e => setNovoCS({...novoCS, nome: e.target.value})}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#112240] dark:text-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-brand-navy transition-colors"
                  placeholder="Ex: Carlos Oliveira"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">E-mail</label>
                <input 
                  type="email"
                  required
                  value={novoCS.email}
                  onChange={e => setNovoCS({...novoCS, email: e.target.value})}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#112240] dark:text-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-brand-navy transition-colors"
                  placeholder="Ex: carlos@reisrevisional.com.br"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Nível Inicial</label>
                <select
                  value={novoCS.nivel}
                  onChange={e => setNovoCS({...novoCS, nivel: e.target.value})}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#112240] dark:text-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-brand-navy transition-colors cursor-pointer"
                >
                  <option value={1}>Nível 1 (Iniciante)</option>
                  <option value={2}>Nível 2 (Intermediário)</option>
                  <option value={3}>Nível 3 (Avançado)</option>
                  <option value={4}>Nível 4 (Sênior)</option>
                  <option value={5}>Nível 5 (Especialista)</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-100 text-slate-600 dark:text-slate-300 dark:bg-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  onClick={handleAddCS}
                  className="flex-1 bg-brand-navy text-white font-bold py-3 rounded-xl hover:bg-blue-900 shadow-md transition-colors"
                >
                  Confirmar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
