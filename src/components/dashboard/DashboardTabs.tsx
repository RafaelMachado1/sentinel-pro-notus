'use client';

type Tab = 'portfolio' | 'sentinels';

interface Props {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export default function DashboardTabs({ activeTab, setActiveTab }: Props) {
  const activeClass = "text-sky-500 border-sky-500";
  const inactiveClass = "text-slate-400 border-transparent hover:text-slate-200";

  return (
    <div className="border-b border-slate-800 mb-8">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        <button
          onClick={() => setActiveTab('portfolio')}
          className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg ${activeTab === 'portfolio' ? activeClass : inactiveClass}`}
        >
          Portfólio
        </button>
        <button
          onClick={() => setActiveTab('sentinels')}
          className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg ${activeTab === 'sentinels' ? activeClass : inactiveClass}`}
        >
          Sentinelas
        </button>
      </nav>
    </div>
  );
}