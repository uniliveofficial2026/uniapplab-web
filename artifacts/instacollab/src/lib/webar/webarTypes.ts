/** Typings for tencentcloud-webar (package ships limited types). */

export type TencentBeautifyParams = {
  whiten?: number;
  dermabrasion?: number;
  lift?: number;
  shave?: number;
  eye?: number;
  chin?: number;
};

/** Unified body / face sculpt sliders (50 = neutral). */
export type { BodyShapeParams as TencentBodyShapeParams } from '../ar/bodyShape';
export { EMPTY_BODY_SHAPE } from '../ar/bodyShape';

export type TencentWebARAuthResult = {
  signature: string;
  timestamp: number;
};

export type TencentWebARInitOptions = {
  module?: {
    beautify?: boolean;
    segmentation?: boolean;
    segmentationLevel?: 0 | 1 | 2 | 'auto';
  };
  auth: {
    authFunc: () => TencentWebARAuthResult | Promise<TencentWebARAuthResult>;
    appId: string;
    licenseKey: string;
  };
  input?: MediaStream | HTMLVideoElement | HTMLCanvasElement;
  camera?: {
    width: number;
    height: number;
    mirror: boolean;
    frameRate: number;
  };
  beautify?: TencentBeautifyParams;
  language?: string;
  loading?: {
    enable?: boolean;
    lineWidth?: number;
  };
  mirror?: boolean;
  fps?: number;
};

/** Built-in preset from getEffectList / getCommonFilter (quick-start shape). */
export type TencentEffectItem = {
  id: string;
  name: string;
  cover: string;
  url?: string;
  label?: string;
  type?: string;
};

export type TencentEffectSelection = {
  makeupId: string | null;
  stickerId: string | null;
  filterId: string | null;
  /** Background image URL or null. */
  backgroundUrl: string | null;
};

export type TencentWebARInstance = {
  on: (event: string, handler: (payload?: unknown) => void) => void;
  off?: (event: string, handler?: (payload?: unknown) => void) => void;
  setBeautify: (params: TencentBeautifyParams) => void;
  getOutput: (fps?: number) => Promise<MediaStream>;
  updateInputStream?: (
    src: MediaStream,
    stopOldTracks?: boolean,
    updateOutputDestination?: boolean,
  ) => Promise<void>;
  setDetectModuleConfig?: (data: {
    beautify?: boolean;
    segmentation?: boolean;
    segmentationLevel?: 0 | 1 | 2 | 'auto';
  }) => void;
  setSegmentationLevel?: (level: 0 | 1 | 2 | 'auto') => Promise<void>;
  disable?: () => void;
  enable?: () => void;
  camera?: unknown;
  getEffectList?: (opts: {
    Type?: string;
    Label?: string | string[];
    PageNumber?: number;
    PageSize?: number;
  }) => Promise<
    Array<{
      Name?: string;
      EffectId?: string;
      CoverUrl?: string;
      Url?: string;
      Label?: string;
      PresetType?: string;
    }>
  >;
  getCommonFilter?: () => Promise<
    Array<{
      Name?: string;
      EffectId?: string;
      CoverUrl?: string;
      Url?: string;
      Label?: string;
      PresetType?: string;
    }>
  >;
  setEffect?: (
    effects:
      | Array<string | { id: string; intensity?: number; filterIntensity?: number }>
      | null,
    callback?: (...args: unknown[]) => void,
    errCallback?: (...args: unknown[]) => void,
  ) => void;
  preloadEffectByIds?: (
    ids: string | string[],
    callback?: (...args: unknown[]) => void,
    errCallback?: (...args: unknown[]) => void,
  ) => void;
  setFilter?: (id: string | null, intensity?: number) => void;
  setBackground?: (opts: { type: string; src: string } | null) => void;
  destroy?: (opts?: { stopInputStream?: boolean }) => void;
  stop?: () => void;
};

export const TRTC_DEFAULT_BACKGROUNDS = [
  'https://webar-static.tencent-cloud.com/assets/background/1.jpg',
  'https://webar-static.tencent-cloud.com/assets/background/2.jpg',
  'https://webar-static.tencent-cloud.com/assets/background/3.jpg',
  'https://webar-static.tencent-cloud.com/assets/background/4.jpg',
] as const;

export const EMPTY_TENCENT_EFFECT_SELECTION: TencentEffectSelection = {
  makeupId: null,
  stickerId: null,
  filterId: null,
  backgroundUrl: null,
};
