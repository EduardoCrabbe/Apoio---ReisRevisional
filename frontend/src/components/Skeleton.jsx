import React from 'react';

/**
 * Skeleton com shimmer (classe .shimmer no index.css — respeita reduced-motion).
 * A cor de fundo vem de classes Tailwind do tema (slate-200 / dark slate-700),
 * então funciona nos dois temas sem cor hardcoded.
 */
export function Skeleton({ className = '' }) {
  return <div className={`shimmer rounded-md bg-slate-200 dark:bg-slate-700 ${className}`} />;
}

/** Cartão KPI em carregamento (mesma silhueta dos cards reais). */
export function SkeletonKpiCard() {
  return (
    <div className="bg-white dark:bg-[#112240] p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
      <div className="flex justify-between items-start mb-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-5 rounded-md" />
      </div>
      <Skeleton className="h-9 w-16 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

/** Linhas genéricas de tabela (largura/altura uniformes). */
export function SkeletonRows({ rows = 4, cols = 1, className = '' }) {
  return (
    <div className={`p-4 space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className={`h-6 ${j === 0 ? 'w-1/4' : 'flex-1'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
