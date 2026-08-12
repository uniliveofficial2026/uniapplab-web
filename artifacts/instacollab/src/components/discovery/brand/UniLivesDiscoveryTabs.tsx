import React from 'react';

export type DiscoveryTabItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
};

type Props = {
  tabs: DiscoveryTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
};

/** Segmented tabs chrome — parent owns tab IDs and content switching. */
export function UniLivesDiscoveryTabs({
  tabs,
  activeId,
  onChange,
  className = 'flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar shrink-0 pb-1',
}: Props) {
  return (
    <div className={className} role="tablist" data-unilives-discovery-tabs="">
      {tabs.map((tab) => {
        const selected = activeId === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold text-sm whitespace-nowrap transition-colors motion-reduce:transition-none ${
              selected
                ? 'bg-[color:var(--color-unilives-discovery-text)] text-[color:var(--color-unilives-discovery-background)]'
                : 'bg-[color:var(--color-unilives-discovery-surface)] text-[color:var(--color-unilives-discovery-text)] hover:opacity-90'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        );
      })}
    </div>
  );
}
