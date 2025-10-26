'use client';

// Não precisamos mais de tipos ou props, pois só há uma aba.

export default function DashboardTabs() {
  // A aba "Portfólio" estará sempre ativa visualmente.
  const activeClass = "text-sky-500 border-sky-500";

  return (
    <div className="border-b border-slate-800 mb-8">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {/* Apenas o botão Portfólio */}
        <button
          // Não precisa mais de onClick para mudar de aba
          className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg ${activeClass}`}
        >
          Portfólio
        </button>
        {/* Botão Sentinelas Removido */}
      </nav>
    </div>
  );
}