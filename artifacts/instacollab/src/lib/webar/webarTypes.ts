/** Typings for tencentcloud-webar (package ships limited types). */

export type TencentBeautifyParams = {
  whiten?: number;
  dermabrasion?: number;
  lift?: number;
  shave?: number;
  eye?: number;
  chin?: number;
  cheekbone?: number;
  head?: number;
  forehead?: number;
  nose?: number;
  lip?: number;
  eyeBrightness?: number;
  usm?: number;
  distort1?: number;
  distort2?: number;
  distortCenter1?: string;
  distortCenter2?: string;
  distortMajorRadius1?: number;
  distortMinorRadius1?: number;
  distortMajorRadius2?: number;
  distortMinorRadius2?: number;
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
    segmentationLevel?: string;
  };
  auth: {
    authFunc: () => TencentWebARAuthResult | Promise<TencentWebARAuthResult>;
    appId: string;
    licenseKey: string;
  };
  input?: MediaStream | HTMLVideoElement | HTMLCanvasElement;
  camera?: {
    width?: number;
    height?: number;
    mirror?: boolean;
  };
  beautify?: TencentBeautifyParams;
  language?: string;
  loading?: {
    enable?: boolean;
    lineWidth?: number;
  };
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

export type TencentBackgroundMediaType = 'image' | 'video';

export type TencentEffectSelection = {
  makeupId: string | null;
  /** 0–1 strength for the active makeup look. */
  makeupIntensity?: number | null;
  stickerId: string | null;
  filterId: string | null;
  /** Background image/video URL or null. */
  backgroundUrl: string | null;
  /** TRTC setBackground media type — defaults to image when null. */
  backgroundType?: TencentBackgroundMediaType | null;
  /** TRTC BeautyKit body-shape preset EffectId. */
  shapeEffectId?: string | null;
};

export type TencentWebARInstance = {
  on: (event: string, handler: (payload?: unknown) => void) => void;
  off?: (event: string, handler?: (payload?: unknown) => void) => void;
  setBeautify: (params: TencentBeautifyParams) => void;
  getOutput: () => Promise<MediaStream>;
  getEffectList?: (opts: {
    Type: string;
    Label?: string | string[];
    PageSize?: number;
    PageNumber?: number;
    Name?: string;
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
  ) => void;
  setFilter?: (id: string | null, intensity?: number) => void;
  setBackground?: (opts: { type: string; src: string } | null) => void;
  preloadEffectByIds?: (
    ids: string[],
    onSuccess?: () => void,
    onError?: () => void,
  ) => void;
  setDetectModuleConfig?: (config: {
    beautify?: boolean;
    segmentation?: boolean;
    segmentationLevel?: number | 'auto';
  }) => void;
  setCommonConfig?: (config: { mirror?: boolean }) => void;
  setSegmentationLevel?: (level: number | 'auto') => void | Promise<void>;
  updateInputStream?: (
    stream: MediaStream,
    stopOld?: boolean,
    resetEffects?: boolean,
  ) => Promise<void>;
  enable?: () => void;
  disable?: () => void;
  destroy?: (opts?: { stopInputStream?: boolean }) => void;
  stop?: () => void;
};

export const TRTC_DEFAULT_BACKGROUNDS = [
  'https://webar-static.tencent-cloud.com/assets/background/1.jpg',
  'https://webar-static.tencent-cloud.com/assets/background/2.jpg',
  'https://webar-static.tencent-cloud.com/assets/background/3.jpg',
  'https://webar-static.tencent-cloud.com/assets/background/4.jpg',
  '/trtc-webar/backgrounds/video-bg-1.mp4',
  '/trtc-webar/backgrounds/video-bg-2.mp4',
] as const;

export const EMPTY_TENCENT_EFFECT_SELECTION: TencentEffectSelection = {
  makeupId: null,
  makeupIntensity: null,
  stickerId: null,
  filterId: null,
  backgroundUrl: null,
  backgroundType: null,
  shapeEffectId: null,
};
