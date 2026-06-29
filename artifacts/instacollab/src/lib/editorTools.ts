/** Editor tool tabs — aligned with common social / mobile editor suites (IG, TikTok, CapCut, etc.) */

export type EditorToolTabId =
  | 'none'
  | 'font'
  | 'bg'
  | 'color'
  | 'align'
  | 'size'
  | 'animation'
  | 'spacing'
  | 'templates'
  | 'filters'
  | 'adjust'
  | 'crop'
  | 'rotate'
  | 'stickers'
  | 'text'
  | 'audio'
  | 'trim'
  | 'speed'
  | 'volume'
  | 'cover';

export type EditorToolIcon =
  | 'type'
  | 'image'
  | 'layout'
  | 'wand'
  | 'sliders'
  | 'crop'
  | 'rotate'
  | 'sticker'
  | 'music'
  | 'scissors'
  | 'gauge'
  | 'volume'
  | 'sparkles'
  | 'spacing'
  | 'template';

export type EditorToolDef = {
  id: EditorToolTabId;
  label: string;
  icon: EditorToolIcon;
  /** Video-only tools appended when editing video */
  videoOnly?: boolean;
};

export const TEXT_EDITOR_TOOLS: EditorToolDef[] = [
  { id: 'font', label: 'Font', icon: 'type' },
  { id: 'templates', label: 'Templates', icon: 'template' },
  { id: 'bg', label: 'Background', icon: 'image' },
  { id: 'color', label: 'Color', icon: 'type' },
  { id: 'align', label: 'Align', icon: 'layout' },
  { id: 'size', label: 'Size', icon: 'type' },
  { id: 'spacing', label: 'Spacing', icon: 'spacing' },
  { id: 'animation', label: 'Animation', icon: 'sparkles' },
  { id: 'audio', label: 'Soundtrack', icon: 'music' },
];

export const MEDIA_EDITOR_TOOLS: EditorToolDef[] = [
  { id: 'filters', label: 'Filters', icon: 'wand' },
  { id: 'adjust', label: 'Adjust', icon: 'sliders' },
  { id: 'crop', label: 'Crop', icon: 'crop' },
  { id: 'rotate', label: 'Rotate', icon: 'rotate' },
  { id: 'stickers', label: 'Stickers', icon: 'sticker' },
  { id: 'text', label: 'Text', icon: 'type' },
  { id: 'audio', label: 'Soundtrack', icon: 'music' },
  { id: 'trim', label: 'Trim', icon: 'scissors', videoOnly: true },
  { id: 'speed', label: 'Speed', icon: 'gauge', videoOnly: true },
  { id: 'volume', label: 'Volume', icon: 'volume', videoOnly: true },
  { id: 'cover', label: 'Cover', icon: 'image', videoOnly: true },
];

export function editorToolsForMode(
  mode: 'text' | 'photo' | 'video'
): EditorToolDef[] {
  if (mode === 'text') return TEXT_EDITOR_TOOLS;
  return MEDIA_EDITOR_TOOLS.filter((t) => !t.videoOnly || mode === 'video');
}
