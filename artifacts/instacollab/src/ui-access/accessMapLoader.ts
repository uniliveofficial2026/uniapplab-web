import { ACCESS_MAP } from './generated/accessMap.generated';
import { EXPERIENCE_RECORDS } from './generated/experiences.generated';
import { COMPONENT_RECORDS, ELEMENT_RECORDS, LAYOUT_RECORDS, MOCKUP_IDS, DESIGN_IDS } from './generated/components.generated';
import { ASSET_ACCESS_IDS } from './generated/assets.generated';
import { ACTION_ACCESS_IDS, BINDING_ACCESS_IDS, CONTRACT_ACCESS_IDS, CONTENT_ACCESS_IDS } from './generated/ids.generated';
import { NODE_RECORDS } from './generated/nodes.generated';
import { CONTRACT_RECORDS } from './generated/contracts.generated';
import { CONTENT_RECORDS } from './generated/content.generated';
import { resolvePresentationAsset } from '../presentation/assets/assetRegistry';
import { DEFAULT_THEME_TOKENS } from '../presentation/design-system/tokens/themeTokens';
import { getActiveSession, getActiveSnapshot } from './activeSnapshot';
import type {
  UiAccess,
  ResolvedExperience,
  ResolvedUiNode,
  RegisteredComponent,
  ResolvedElement,
  ResolvedLayout,
  ResolvedMockup,
  ResolvedDesign,
  ResolvedAsset,
  ResolvedTheme,
  ResolvedTokens,
  ResolvedMotion,
  RegisteredAction,
  RegisteredBinding,
  ResolvedContract,
  ResolvedContent,
} from './types';

type ExperienceRec = (typeof EXPERIENCE_RECORDS)[number];
type ComponentRec = (typeof COMPONENT_RECORDS)[number];
type ElementRec = (typeof ELEMENT_RECORDS)[number];
type LayoutRec = (typeof LAYOUT_RECORDS)[number];
type NodeRec = {
  id: string;
  name: string;
  contractId?: string | null;
  componentId: string;
  elementId?: string | null;
  contentId?: string | null;
  iconAssetId?: string | null;
  variant: string;
  dataBindingId?: string | null;
  actionIds: readonly string[];
  translationKeys: Record<string, string>;
  assetIds: Record<string, string>;
  motionId?: string;
  tokenSetId?: string;
  layoutSlotId?: string | null;
  fallbackId?: string;
  fallbackNodeId?: string;
  editScope?: 'INSTANCE' | 'SHARED_PRESET';
};

const experienceByKey = new Map<string, ExperienceRec>(EXPERIENCE_RECORDS.map((e) => [e.key, e]));
const experienceById = new Map<string, ExperienceRec>(EXPERIENCE_RECORDS.map((e) => [e.id, e]));
const componentById = new Map<string, ComponentRec>(COMPONENT_RECORDS.map((c) => [c.id, c]));
const componentByRuntime = new Map<string, ComponentRec>(COMPONENT_RECORDS.map((c) => [c.runtimeId, c]));
const elementById = new Map<string, ElementRec>(ELEMENT_RECORDS.map((e) => [e.id, e]));
const layoutById = new Map<string, LayoutRec>(LAYOUT_RECORDS.map((l) => [l.id, l]));
const nodeById = new Map<string, NodeRec>((NODE_RECORDS as unknown as NodeRec[]).map((n) => [n.id, n]));
const contractById = new Map<string, (typeof CONTRACT_RECORDS)[number]>(CONTRACT_RECORDS.map((c) => [c.id, c]));
const contentById = new Map<string, (typeof CONTENT_RECORDS)[number]>(CONTENT_RECORDS.map((c) => [c.id, c]));

function missing(kind: string, id: string): never {
  throw new Error(`[ui-access] ${kind} not found: ${id}`);
}

export function findComponent(id: string): RegisteredComponent | null {
  return (componentById.get(id) || componentByRuntime.get(id) || componentById.get(`component.${id}`) || null) as RegisteredComponent | null;
}

export const uiAccess: UiAccess = {
  session: () => getActiveSession(),
  snapshot: () => getActiveSnapshot(),
  experience(id) {
    const rec = experienceById.get(id) || experienceByKey.get(id.replace(/^experience\./, ''));
    if (!rec) missing('experience', id);
    return {
      id: rec.id,
      key: rec.key,
      name: rec.name,
      layoutId: `layout.${rec.key}.default`,
      rootNodeId: `node.${rec.key}.root`,
      sourcePath: rec.source,
      fallbackExperienceId:
        rec.key === 'global.loading'
          ? 'experience.global.error'
          : rec.key === 'global.error'
            ? 'experience.startup.splash'
            : rec.key === 'live.solo-video'
              ? 'experience.global.loading'
              : rec.key.startsWith('live.')
                ? 'experience.live.solo-video'
                : 'experience.global.loading',
    } satisfies ResolvedExperience;
  },
  node(id) {
    const rec = nodeById.get(id) || nodeById.get(id.startsWith('node.') ? id : `node.${id}`);
    if (!rec) missing('node', id);
    const snapshot = getActiveSnapshot();
    const overrides = (snapshot.lockfile.nodeOverrides || {}) as Record<string, Partial<ResolvedUiNode>>;
    const patch = overrides[rec.id] || {};
    return {
      id: rec.id,
      name: rec.name,
      contractId: rec.contractId || undefined,
      componentId: patch.componentId || rec.componentId,
      elementId: patch.elementId || rec.elementId || undefined,
      contentId: rec.contentId || undefined,
      iconAssetId: patch.iconAssetId !== undefined ? patch.iconAssetId : rec.iconAssetId,
      variant: rec.variant,
      actionIds: rec.actionIds.slice(),
      translationKeys: { ...rec.translationKeys },
      assetIds: { ...rec.assetIds },
      motionId: patch.motionId || rec.motionId,
      tokenSetId: rec.tokenSetId,
      layoutSlotId: rec.layoutSlotId,
      fallbackId: rec.fallbackId,
      fallbackNodeId: rec.fallbackNodeId,
      dataBindingId: rec.dataBindingId,
      editScope: rec.editScope,
    } satisfies ResolvedUiNode;
  },
  component(id) {
    const rec = findComponent(id);
    if (!rec) missing('component', id);
    return rec;
  },
  element(id) {
    const rec = elementById.get(id) || elementById.get(id.startsWith('element.') ? id : `element.${id}`);
    if (!rec) missing('element', id);
    return rec as ResolvedElement;
  },
  layout(id) {
    const rec = layoutById.get(id) || layoutById.get(id.startsWith('layout.') ? id : `layout.${id}.default`);
    if (!rec) missing('layout', id);
    return rec as ResolvedLayout;
  },
  mockup(id) {
    if (!(MOCKUP_IDS as readonly string[]).includes(id)) missing('mockup', id);
    return { id, approvalStatus: 'approved' } satisfies ResolvedMockup;
  },
  design(id) {
    if (!(DESIGN_IDS as readonly string[]).includes(id)) missing('design', id);
    return { id, themeId: 'theme.unilives.default', status: 'approved' } satisfies ResolvedDesign;
  },
  asset(id) {
    if (!(ASSET_ACCESS_IDS as readonly string[]).includes(id) && !/^[a-z0-9]+(\.[a-z0-9_-]+)+$/i.test(id)) missing('asset', id);
    const resolved = resolvePresentationAsset({ assetId: id });
    return { id, url: resolved.url, fallbackUrl: resolved.fallbackUrl } satisfies ResolvedAsset;
  },
  theme(id = 'theme.unilives.default') {
    return { id, version: DEFAULT_THEME_TOKENS.version } satisfies ResolvedTheme;
  },
  tokens(id = 'tokens.unilives.v4') {
    return { id, version: DEFAULT_THEME_TOKENS.version } satisfies ResolvedTokens;
  },
  motion(id) {
    return { id, name: id } satisfies ResolvedMotion;
  },
  action(id) {
    const full = id.startsWith('action.') ? id : `action.${id}`;
    if (!(ACTION_ACCESS_IDS as readonly string[]).includes(full)) missing('action', id);
    return { id: full, runtimeId: full.replace(/^action\./, ''), name: full } satisfies RegisteredAction;
  },
  binding(id) {
    const full = id.startsWith('binding.') ? id : `binding.${id}`;
    if (!(BINDING_ACCESS_IDS as readonly string[]).includes(full)) missing('binding', id);
    return { id: full, runtimeId: full.replace(/^binding\./, ''), name: full } satisfies RegisteredBinding;
  },
  contract(id) {
    const rec = contractById.get(id);
    if (!rec && !(CONTRACT_ACCESS_IDS as readonly string[]).includes(id)) missing('contract', id);
    return { id, name: rec?.name, kind: rec?.kind } satisfies ResolvedContract;
  },
  content(id) {
    const rec = contentById.get(id) || contentById.get(id.startsWith('content.') ? id : `content.${id}`);
    if (!rec && !(CONTENT_ACCESS_IDS as readonly string[]).includes(id.startsWith('content.') ? id : `content.${id}`)) missing('content', id);
    return {
      id: rec?.id || id,
      translationKey: rec?.translationKey || 'common.ok',
      fallbackKey: rec?.fallbackKey,
      nodeId: rec?.nodeId,
    } satisfies ResolvedContent;
  },
};

export function listAccessExperiences(): string[] {
  return Object.keys(ACCESS_MAP.experiences);
}

void ACCESS_MAP;
