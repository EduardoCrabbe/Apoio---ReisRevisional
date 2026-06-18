import React, { useState } from 'react';
import { CheckCircle2, FileText, Download, Calculator, Filter, CalendarOff } from 'lucide-react';

export default function Quitacoes({ role }) {
  const isManager = role === 'Gerente' || role === 'Supervisor';
  const [filtroCS, setFiltroCS] = useState('Todos');

  const [quitados, setQuitados] = useState([
    { 
      id: '1002934-23', 
      cs: 'Edu crabbe',
      cliente: 'João da Silva Santos',
      valorOriginal: 45000.00,
      valorPago: 15000.00,
      consultaProcesso: 'Ativa',
      dataBoleto: '25/05/2026',
      dataPagamento: '27/05/2026',
      protesto: 'Não possui',
      tarifasRestituiveis: 'Sim'
    },
    { 
      id: '1003451-88', 
      cs: 'Ana Souza',
      cliente: 'Maria Oliveira Pinto',
      valorOriginal: 12000.00,
      valorPago: 8000.00,
      consultaProcesso: 'Excluída',
      dataBoleto: '22/05/2026',
      dataPagamento: '26/05/2026',
      protesto: 'Cliente ciente',
      tarifasRestituiveis: 'Não'
    }
  ]);

  const username = "Edu crabbe"; // Usuário logado
  
  let quitadosVisiveis = quitados;
  if (isManager) {
    if (filtroCS !== 'Todos') {
      quitadosVisiveis = quitados.filter(q => q.cs === filtroCS);
    }
  } else {
    quitadosVisiveis = quitados.filter(q => q.cs === username);
  }

  // Calculando totais
  const totalOriginal = quitadosVisiveis.reduce((acc, curr) => acc + curr.valorOriginal, 0);
  const totalPago = quitadosVisiveis.reduce((acc, curr) => acc + curr.valorPago, 0);
  const totalEconomia = totalOriginal - totalPago;
  const totalEconomiaPct = totalOriginal > 0 ? ((totalEconomia / totalOriginal) * 100).toFixed(1) : 0;

  const handleFinalizarMes = () => {
    if (window.confirm('Tem certeza que deseja finalizar o mês? Isso irá compilar os dados atuais e zerar a visualização para o próximo mês.')) {
      setQuitados([]); // Simulando o zeramento para início de um novo mês
      alert('Mês finalizado com sucesso! Relatórios arquivados.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-brand-navy dark:text-white">Quitações</h2>
          <p className="text-brand-bronze mt-1">Relatório detalhado e acompanhamento de clientes liquidados.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          
          {isManager && (
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 shadow-sm">
              <Filter className="w-4 h-4 text-brand-bronze" />
              <select 
                value={filtroCS}
                onChange={(e) => setFiltroCS(e.target.value)}
                className="text-sm text-brand-navy dark:text-slate-200 font-bold focus:outline-none bg-transparent dark:bg-slate-800 cursor-pointer"
              >
                <option value="Todos">Todos os CSs</option>
                <option value="Edu crabbe">Edu crabbe</option>
                <option value="Ana Souza">Ana Souza</option>
              </select>
            </div>
          )}

          <button onClick={() => alert('Exportando relatório para PDF/Excel...')} className="bg-brand-gold text-brand-navy dark:text-white px-4 py-2 rounded-xl font-bold shadow-md hover:bg-[#b8952b] flex items-center gap-2 transition-all">
            <Download className="w-5 h-5" />
            Exportar
          </button>

          {isManager && (
            <button 
              onClick={handleFinalizarMes}
              className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold shadow-md hover:bg-red-600 flex items-center gap-2 transition-all ml-2"
              title="Encerrar o período atual e iniciar o próximo mês"
            >
              <CalendarOff className="w-5 h-5" />
              Finalizar Mês
            </button>
          )}

        </div>
      </header>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1200px]">
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
            {quitadosVisiveis.map((item, index) => {
              const economiaReal = item.valorOriginal - item.valorPago;
              const economiaPct = item.valorOriginal > 0 ? ((economiaReal / item.valorOriginal) * 100).toFixed(1) : 0;

              return (
                <tr key={index} className="hover:bg-slate-50 dark:bg-transparent dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-bold text-brand-navy dark:text-white">{item.cliente}</div>
                    <div className="text-xs text-brand-bronze font-medium">Resp: {item.cs}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400 line-through">R$ {item.valorOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div className="text-sm font-bold text-brand-navy dark:text-white">R$ {item.valorPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-bold text-emerald-600">R$ {economiaReal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div className="text-xs font-medium text-emerald-500/80 bg-emerald-50 inline-block px-2 rounded-full">{economiaPct}%</div>
                  </td>
                  <td className="px-4 py-3">
                    <select 
                      defaultValue={item.consultaProcesso}
                      className="text-xs border border-slate-200 dark:border-slate-700 rounded p-1 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none"
                    >
                      <option value="Ativa">Ativa</option>
                      <option value="Excluída">Excluída</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                    <div><span className="font-medium text-slate-400">Envio:</span> {item.dataBoleto}</div>
                    <div><span className="font-medium text-slate-400">Pgto:</span> {item.dataPagamento}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select 
                      defaultValue={item.protesto}
                      className="text-xs border border-slate-200 dark:border-slate-700 rounded p-1 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none"
                    >
                      <option value="Não possui">Não possui</option>
                      <option value="Cliente ciente">Cliente ciente</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select 
                      defaultValue={item.tarifasRestituiveis}
                      className="text-xs border border-slate-200 dark:border-slate-700 rounded p-1 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none"
                    >
                      <option value="Sim">Sim</option>
                      <option value="Não">Não</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Quitado
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Rodapé com Totais */}
          {quitadosVisiveis.length > 0 && (
            <tfoot className="bg-slate-50 dark:bg-slate-900/50 border-t-2 border-slate-200 dark:border-slate-700">
              <tr>
                <td className="px-4 py-4 text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <Calculator className="w-4 h-4" /> TOTAL CONSOLIDADO
                </td>
                <td className="px-4 py-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400 line-through">R$ {totalOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <div className="text-sm font-bold text-brand-navy dark:text-white">R$ {totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </td>
                <td className="px-4 py-4">
                  <div className="text-sm font-bold text-emerald-600">R$ {totalEconomia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <div className="text-xs font-bold text-white bg-emerald-500 inline-block px-2 py-0.5 rounded-full">{totalEconomiaPct}% Global</div>
                </td>
                <td colSpan={5} className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400 text-right">
                  Mostrando {quitadosVisiveis.length} quitações no período.
                </td>
              </tr>
            </tfoot>
          )}
        </table>
        
        {quitadosVisiveis.length === 0 && (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center">
            <FileText className="w-12 h-12 text-slate-300 mb-4" />
            <p>Nenhum cliente quitado no momento.</p>
          </div>
        )}
      </div>
    </div>
  );
}
