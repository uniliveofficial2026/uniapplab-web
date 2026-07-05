import {
  FaceLandmarker,
  FilesetResolver,
  ImageSegmenter,
  PoseLandmarker,
  type FaceLandmarkerResult,
  type ImageSegmenterResult,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const POSE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const SEGMENTER_MODELS = [
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite',
];

async function createImageSegmenter(vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>) {
  let lastError: unknown;
  for (const modelAssetPath of SEGMENTER_MODELS) {
    try {
      return await ImageSegmenter.createFromOptions(vision, {
        baseOptions: { modelAssetPath, delegate: 'GPU' },
        runningMode: 'VIDEO',
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      });
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to load selfie segmenter model');
}

export type MediaPipeVisionBundle = {
  faceLandmarker: FaceLandmarker;
  imageSegmenter: ImageSegmenter;
  poseLandmarker: PoseLandmarker;
};

let bundlePromise: Promise<MediaPipeVisionBundle> | null = null;

export async function loadMediaPipeVision(
  onProgress?: (progress: number) => void,
): Promise<MediaPipeVisionBundle> {
  if (!bundlePromise) {
    bundlePromise = (async () => {
      onProgress?.(8);
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
      onProgress?.(25);
      const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
      onProgress?.(55);
      const imageSegmenter = await createImageSegmenter(vision);
      onProgress?.(80);
      const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
      onProgress?.(100);
      return { faceLandmarker, imageSegmenter, poseLandmarker };
    })().catch((err) => {
      bundlePromise = null;
      throw err;
    });
  }

  return bundlePromise;
}

export function detectFaceLandmarks(
  faceLandmarker: FaceLandmarker,
  video: HTMLVideoElement,
  timestampMs: number,
): FaceLandmarkerResult {
  return faceLandmarker.detectForVideo(video, timestampMs);
}

export function detectSelfieMask(
  imageSegmenter: ImageSegmenter,
  video: HTMLVideoElement,
  timestampMs: number,
): ImageSegmenterResult {
  return imageSegmenter.segmentForVideo(video, timestampMs);
}

export function detectPose(
  poseLandmarker: PoseLandmarker,
  video: HTMLVideoElement,
  timestampMs: number,
): PoseLandmarkerResult {
  return poseLandmarker.detectForVideo(video, timestampMs);
}

export function getSmileScore(result: FaceLandmarkerResult): number {
  const categories = result.faceBlendshapes?.[0]?.categories;
  if (!categories?.length) return 0.35;
  const smile = categories.find((c) => c.categoryName === 'mouthSmileLeft' || c.categoryName === 'mouthSmileRight');
  const jaw = categories.find((c) => c.categoryName === 'jawOpen');
  const smileScore = smile?.score ?? 0;
  const jawScore = jaw?.score ?? 0;
  return Math.min(1, Math.max(0, smileScore * 0.75 + jawScore * 0.15 + 0.1));
}
