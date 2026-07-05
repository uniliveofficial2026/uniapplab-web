import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import * as THREE from 'three';
import { getFaceFrame, LM } from '../faceGeometry';
import { getEffectProfile } from '../effectProfiles';

export type FaceTrackingFrame = {
  center: THREE.Vector3;
  scale: number;
  rotationZ: number;
  eyeDistance: number;
  faceWidth: number;
  faceHeight: number;
};

export function landmarksToTrackingFrame(
  landmarks: NormalizedLandmark[],
  mirror: boolean,
): FaceTrackingFrame {
  const width = 1;
  const height = 1;
  const frame = getFaceFrame(landmarks, width, height, mirror);
  const noseLm = landmarks[LM.noseTip];

  return {
    center: new THREE.Vector3(
      frame.eyeCenter.x - 0.5,
      0.5 - frame.eyeCenter.y,
      -(noseLm.z ?? 0) * 0.35,
    ),
    scale: frame.eyeDistance * 3.8,
    rotationZ: frame.angle,
    eyeDistance: frame.eyeDistance,
    faceWidth: frame.faceWidth,
    faceHeight: frame.faceHeight,
  };
}

export function applyMatrixToRig(rig: THREE.Group, matrixData: number[] | Float32Array) {
  const m = new THREE.Matrix4().fromArray(matrixData);
  const flip = new THREE.Matrix4().makeScale(-1, 1, 1);
  m.premultiply(flip);
  rig.matrix.copy(m);
  rig.matrixAutoUpdate = false;
}

export function applyTrackingFrameToRig(rig: THREE.Group, frame: FaceTrackingFrame) {
  rig.matrixAutoUpdate = true;
  rig.position.copy(frame.center);
  rig.rotation.set(0, 0, frame.rotationZ);
  rig.scale.setScalar(frame.scale);
}

export function getEffectProfileKind(effectId: string) {
  return getEffectProfile(effectId).kind;
}
