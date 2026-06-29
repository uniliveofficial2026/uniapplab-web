import React from 'react';
import {
  Type,
  Image,
  LayoutDashboard,
  Wand2,
  SlidersHorizontal,
  Crop,
  RotateCw,
  Sticker,
  Music,
  Scissors,
  Gauge,
  Volume2,
  Sparkles,
  AlignVerticalSpaceAround,
  LayoutTemplate,
} from 'lucide-react';
import type { EditorToolDef, EditorToolIcon, EditorToolTabId } from '../../lib/editorTools';

const ICONS: Record<EditorToolIcon, React.ComponentType<{ className?: string }>> = {
  type: Type,
  image: Image,
  layout: LayoutDashboard,
  wand: Wand2,
  sliders: SlidersHorizontal,
  crop: Crop,
  rotate: RotateCw,
  sticker: Sticker,
  music: Music,
  scissors: Scissors,
  gauge: Gauge,
  volume: Volume2,
  sparkles: Sparkles,
  spacing: AlignVerticalSpaceAround,
  template: LayoutTemplate,
};

export type EditorToolTabsProps = {
  tools: EditorToolDef[];
  activeTab: EditorToolTabId;
  onToggle: (tab: EditorToolTabId) => void;
  soundtrackSelected?: boolean;
  tabButtonClass?: (active: boolean, tab: EditorToolTabId) => string;
};

export function EditorToolTabs({
  tools,
  activeTab,
  onToggle,
  soundtrackSelected = false,
  tabButtonClass,
}: EditorToolTabsProps) {
  const defaultClass = (active: boolean, tab: EditorToolTabId) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 snap-start text-xs font-bold ${
      active
        ? 'bg-primary/10 text-primary'
        : soundtrackSelected && tab === 'audio'
          ? 'bg-primary/5 text-primary ring-1 ring-primary/25'
          : 'hover:bg-secondary/50 text-muted-foreground'
    }`;

  const classFor = tabButtonClass ?? defaultClass;

  return (
    <>
      {tools.map((tool) => {
        const Icon = ICONS[tool.icon];
        const active = activeTab === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => onToggle(tool.id)}
            className={classFor(active, tool.id)}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span>{tool.label}</span>
            {soundtrackSelected && tool.id === 'audio' && !active && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />
            )}
          </button>
        );
      })}
    </>
  );
}
