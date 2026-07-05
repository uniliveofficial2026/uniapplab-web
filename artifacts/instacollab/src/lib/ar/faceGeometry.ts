import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

export type Point2D = { x: number; y: number };

/** MediaPipe face oval contour (clockwise). */
export const FACE_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152,
  148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
] as const;

export const LM = {
  forehead: 10,
  chin: 152,
  noseTip: 1,
  leftEyeOuter: 33,
  rightEyeOuter: 263,
  leftEyeInner: 133,
  rightEyeInner: 362,
  leftTemple: 234,
  rightTemple: 454,
  leftMouth: 61,
  rightMouth: 291,
  upperLip: 13,
  lowerLip: 14,
  leftBrow: 70,
  rightBrow: 300,
} as const;

export function toPoint(
  landmarks: NormalizedLandmark[],
  index: number,
  width: number,
  height: number,
  mirror: boolean,
): Point2D {
  const lm = landmarks[index];
  const x = lm.x * width;
  return { x: mirror ? width - x : x, y: lm.y * height };
}

export function faceBounds(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  mirror: boolean,
) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const index of FACE_OVAL_INDICES) {
    const p = toPoint(landmarks, index, width, height, mirror);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function clipFaceOval(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  mirror: boolean,
) {
  ctx.beginPath();
  FACE_OVAL_INDICES.forEach((index, i) => {
    const p = toPoint(landmarks, index, width, height, mirror);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.clip();
}

export type FaceFrame = {
  center: Point2D;
  eyeCenter: Point2D;
  eyeDistance: number;
  angle: number;
  faceWidth: number;
  faceHeight: number;
  forehead: Point2D;
  chin: Point2D;
  nose: Point2D;
  leftEye: Point2D;
  rightEye: Point2D;
};

export function getFaceFrame(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  mirror: boolean,
): FaceFrame {
  const leftEye = toPoint(landmarks, LM.leftEyeOuter, width, height, mirror);
  const rightEye = toPoint(landmarks, LM.rightEyeOuter, width, height, mirror);
  const forehead = toPoint(landmarks, LM.forehead, width, height, mirror);
  const chin = toPoint(landmarks, LM.chin, width, height, mirror);
  const nose = toPoint(landmarks, LM.noseTip, width, height, mirror);
  const bounds = faceBounds(landmarks, width, height, mirror);

  const eyeCenter = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2,
  };

  return {
    center: { x: bounds.minX + bounds.width / 2, y: bounds.minY + bounds.height / 2 },
    eyeCenter,
    eyeDistance: Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y),
    angle: Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x),
    faceWidth: bounds.width,
    faceHeight: bounds.height,
    forehead,
    chin,
    nose,
    leftEye,
    rightEye,
  };
}

/** Place a rectangle image/text aligned to the face using eye line + scale. */
export function withFaceTransform(
  ctx: CanvasRenderingContext2D,
  frame: FaceFrame,
  draw: () => void,
) {
  ctx.save();
  ctx.translate(frame.eyeCenter.x, frame.eyeCenter.y);
  ctx.rotate(frame.angle);
  draw();
  ctx.restore();
}

export function smoothPoint(
  previous: Point2D | null,
  next: Point2D,
  alpha = 0.35,
): Point2D {
  if (!previous) return next;
  return {
    x: previous.x + (next.x - previous.x) * alpha,
    y: previous.y + (next.y - previous.y) * alpha,
  };
}

export function smoothLandmarks(
  previous: NormalizedLandmark[] | null,
  next: NormalizedLandmark[],
  alpha = 0.4,
): NormalizedLandmark[] {
  if (!previous || previous.length !== next.length) return next;
  return next.map((lm, i) => ({
    x: previous[i].x + (lm.x - previous[i].x) * alpha,
    y: previous[i].y + (lm.y - previous[i].y) * alpha,
    z: (previous[i].z ?? 0) + ((lm.z ?? 0) - (previous[i].z ?? 0)) * alpha,
    visibility: lm.visibility ?? previous[i].visibility,
  }));
}
