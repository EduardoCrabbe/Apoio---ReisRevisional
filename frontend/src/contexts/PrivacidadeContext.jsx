import React, { createContext, useContext, useState, useCallback } from 'react';
import { getUser } from '../services/api';

/**
 * Modo privacidade: mascara qualquer valor monetário ("R$ ••••") em todas as
 * telas. A preferência persiste por usuário em localStorage
 * ("privacidade_[user_id]"). Disponível via Context para não passar prop em
 * cascata pela árvore.
 */
const PrivacidadeContext = createContext(null);

function chaveStorage() {
  const u = getUser();
  return `privacidade_${u?.id ?? 'anon'}`;
}

export function PrivacidadeProvider({ children }) {
  const [masked, setMasked] = useState(() => {
    try { return localStorage.getItem(chaveStorage()) === '1'; } catch { return false; }
  });

  const toggle = useCallback(() => {
    setMasked((m) => {
      const next = !m;
      try { localStorage.setItem(chaveStorage(), next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return (
    <PrivacidadeContext.Provider value={{ masked, toggle }}>
      {children}
    </PrivacidadeContext.Provider>
  );
}

export function usePrivacidade() {
  // Fallback seguro caso algum componente use fora do provider (ex.: testes).
  return useContext(PrivacidadeContext) ?? { masked: false, toggle: () => {} };
}

const fmtBRLPadrao = (v) =>
  `R$ ${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Valor monetário com mascaramento + fade rápido (.money-fade, 0.15s via CSS).
 * `format` permite manter a formatação específica de cada tela; `prefix`/`suffix`
 * (ex.: "+ ") ficam FORA do mascaramento. A `key` força o replay do fade ao trocar.
 */
export function Money({ value, format, prefix = '', suffix = '', className = '' }) {
  const { masked } = usePrivacidade();
  const fmt = format ?? fmtBRLPadrao;
  const texto = masked ? 'R$ ••••' : fmt(value);
  return (
    <span key={texto} className={`money-fade ${className}`}>{prefix}{texto}{suffix}</span>
  );
}
