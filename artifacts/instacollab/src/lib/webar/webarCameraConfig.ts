/**
 * Tencent Beauty AR Web — official camera parameters.
 * @see https://www.tencentcloud.com/document/product/1143/50102 (Custom Stream)
 * @see https://www.tencentcloud.com/document/product/1143/50101 (Built-in Camera)
 *
 * Custom stream: getUserMedia({ video: { width: 1280, height: 720 } }) → ArSdk input.
 * Built-in camera: ArSdk({ camera: { width: 1280, height: 720, mirror, frameRate: 30 } }).
 */
export const WEBAR_CAMERA_WIDTH = 1280;
export const WEBAR_CAMERA_HEIGHT = 720;
export const WEBAR_CAMERA_FPS = 30;

export const WEBAR_CAMERA_IDEAL = {
  width: WEBAR_CAMERA_WIDTH,
  height: WEBAR_CAMERA_HEIGHT,
} as const;

export const WEBAR_CAMERA_FRAME_RATE = {
  ideal: WEBAR_CAMERA_FPS,
  max: WEBAR_CAMERA_FPS,
} as const;

/** Built-in camera config passed to ArSdk when SDK owns the device camera. */
export const WEBAR_BUILTIN_CAMERA = {
  width: WEBAR_CAMERA_WIDTH,
  height: WEBAR_CAMERA_HEIGHT,
  mirror: true,
  frameRate: WEBAR_CAMERA_FPS,
} as const;

/** Live publish output FPS — matches getOutput(fps) in Tencent docs. */
export const WEBAR_OUTPUT_FPS = 30;
