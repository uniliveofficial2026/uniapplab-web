export type ExperienceId = string;
export type NodeId = string;
export type ComponentId = string;
export type ElementId = string;
export type LayoutId = string;
export type AssetId = string;
export type ThemeId = string;
export type TokenSetId = string;
export type MotionId = string;
export type ActionId = string;
export type BindingId = string;
export type MockupId = string;
export type DesignId = string;

export type UiSessionType = 'anonymous-app' | 'authenticated-app' | 'live-room' | 'pk' | 'admin-preview';

export type ActiveUiSession = {
  sessionId: string;
  sessionType: UiSessionType;
  snapshotId: string;
  checksum: string;
  assignmentSource: string;
  platform: string;
  appVersion: string;
  capabilityHash: string;
  assignedAt: string;
  expiresAt: string;
  publicConfigVersion?: number;
};

export type ActiveUiSnapshot = {
  snapshotId: string;
  checksum: string;
  lockfile: Record<string, unknown>;
};

export type ResolvedExperience = {
  id: ExperienceId;
  key: string;
  name: string;
  layoutId: LayoutId;
  rootNodeId: NodeId;
  sourcePath: string;
  fallbackExperienceId: string;
};

export type ResolvedUiNode = {
  id: NodeId;
  name: string;
  contractId?: string;
  componentId: string;
  elementId?: string;
  contentId?: string;
  iconAssetId?: string | null;
  variant: string;
  dataBindingId?: string | null;
  actionIds: string[];
  translationKeys: Record<string, string>;
  assetIds: Record<string, string>;
  motionId?: string;
  tokenSetId?: string;
  layoutSlotId?: string | null;
  fallbackId?: string;
  fallbackNodeId?: string;
  editScope?: 'INSTANCE' | 'SHARED_PRESET';
};

export type RegisteredComponent = { id: string; runtimeId: string; name: string; version: number };
export type ResolvedElement = { id: string; name: string; componentId: string; version: number };
export type ResolvedLayout = { id: string; name: string; primitive?: string; version: number };
export type ResolvedMockup = { id: string; name?: string; approvalStatus?: string };
export type ResolvedDesign = { id: string; themeId?: string; status?: string };
export type ResolvedAsset = { id: string; url: string; fallbackUrl: string };
export type ResolvedTheme = { id: string; version: number };
export type ResolvedTokens = { id: string; version: number };
export type ResolvedMotion = { id: string; name: string };
export type RegisteredAction = { id: string; runtimeId: string; name: string };
export type RegisteredBinding = { id: string; runtimeId: string; name: string };
export type ResolvedContract = { id: string; name?: string; kind?: string };
export type ResolvedContent = { id: string; translationKey: string; fallbackKey?: string; nodeId?: string };

export interface UiAccess {
  session(): ActiveUiSession | null;
  snapshot(): ActiveUiSnapshot;
  experience(id: ExperienceId): ResolvedExperience;
  node(id: NodeId): ResolvedUiNode;
  component(id: ComponentId): RegisteredComponent;
  element(id: ElementId): ResolvedElement;
  layout(id: LayoutId): ResolvedLayout;
  mockup(id: MockupId): ResolvedMockup;
  design(id: DesignId): ResolvedDesign;
  asset(id: AssetId): ResolvedAsset;
  theme(id?: ThemeId): ResolvedTheme;
  tokens(id?: TokenSetId): ResolvedTokens;
  motion(id: MotionId): ResolvedMotion;
  action(id: ActionId): RegisteredAction;
  binding(id: BindingId): RegisteredBinding;
  contract(id: string): ResolvedContract;
  content(id: string): ResolvedContent;
}
