/**
 * Sinal de "os dados mudaram" — Etapa 9 (itens 1 e 2).
 *
 * Pub/sub minimalista para que a Sidebar e o Dashboard reajam imediatamente a
 * qualquer ação que altere os totais (atendimento, quitação, exclusão, etc.),
 * em vez de cada um manter uma busca isolada que envelhece. Qualquer tela chama
 * notifyDataChanged() após uma mutação; quem se importa com totais (Sidebar,
 * Dashboard) escuta e refaz o fetch.
 */

import { clearApiCache } from './api';

const listeners = new Set();

export function onDataChanged(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notifyDataChanged() {
  clearApiCache(); // os dados mudaram: invalida o cache ANTES de avisar os ouvintes
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* um listener com erro não pode derrubar os outros */
    }
  });
}
