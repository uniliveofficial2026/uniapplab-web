import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import * as THREE from 'three';
import { drawSegmentationComposite, drawVideoFrame } from '../composite';
import { getEffectProfile } from '../effectProfiles';
import { animateEffectObject, buildEffectObject } from './effectObjects';
import { applyMatrixToRig, applyTrackingFrameToRig, landmarksToTrackingFrame } from './faceTracking';

export type FaceARRendererOptions = {
  mirror?: boolean;
};

export class FaceARRenderer {
  readonly domElement: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private readonly videoTexture: THREE.VideoTexture;
  private readonly videoPlane: THREE.Mesh;
  private readonly faceRig: THREE.Group;
  private readonly ambient: THREE.AmbientLight;
  private readonly keyLight: THREE.DirectionalLight;
  private readonly rimLight: THREE.PointLight;
  private effectObject: THREE.Object3D | null = null;
  private activeEffectId = 'none';
  private activeKind = '';
  private mirror: boolean;
  private compositeCanvas: HTMLCanvasElement;
  private compositeCtx: CanvasRenderingContext2D;
  private compositeTexture: THREE.CanvasTexture;
  private useCompositeTexture = false;
  private width = 1;
  private height = 1;

  constructor(video: HTMLVideoElement, options: FaceARRendererOptions = {}) {
    this.mirror = options.mirror ?? true;

    this.domElement = document.createElement('canvas');
    this.domElement.className = 'absolute inset-0 h-full w-full object-cover';

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.domElement,
      alpha: false,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
    this.camera.position.z = 2;

    this.videoTexture = new THREE.VideoTexture(video);
    this.videoTexture.colorSpace = THREE.SRGBColorSpace;
    this.videoPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: this.videoTexture }),
    );
    this.scene.add(this.videoPlane);

    this.compositeCanvas = document.createElement('canvas');
    const ctx = this.compositeCanvas.getContext('2d');
    if (!ctx) throw new Error('Composite canvas unavailable');
    this.compositeCtx = ctx;
    this.compositeTexture = new THREE.CanvasTexture(this.compositeCanvas);
    this.compositeTexture.colorSpace = THREE.SRGBColorSpace;

    this.faceRig = new THREE.Group();
    this.scene.add(this.faceRig);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.65);
    this.keyLight = new THREE.DirectionalLight(0xfff2e0, 1.1);
    this.keyLight.position.set(0.4, 1.2, 1.5);
    this.rimLight = new THREE.PointLight(0x88bbff, 0.45, 8);
    this.rimLight.position.set(-0.6, 0.4, 1.2);
    this.scene.add(this.ambient, this.keyLight, this.rimLight);
  }

  setMirror(mirror: boolean) {
    this.mirror = mirror;
  }

  resize(width: number, height: number) {
    if (!width || !height) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);

    const aspect = width / height;
    this.camera.left = -aspect;
    this.camera.right = aspect;
    this.camera.top = 1;
    this.camera.bottom = -1;
    this.camera.updateProjectionMatrix();

    this.videoPlane.scale.set(aspect, 1, 1);
    if (this.mirror) {
      this.videoPlane.scale.x *= -1;
    }
  }

  private setEffect(effectId: string) {
    if (effectId === this.activeEffectId) return;
    this.activeEffectId = effectId;
    if (this.effectObject) {
      this.faceRig.remove(this.effectObject);
      this.effectObject.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      });
      this.effectObject = null;
    }

    if (effectId === 'none') {
      this.activeKind = '';
      return;
    }

    const profile = getEffectProfile(effectId);
    this.activeKind = profile.kind;
    if (profile.kind === 'segment-bg') return;

    this.effectObject = buildEffectObject(effectId, profile.kind);
    this.faceRig.add(this.effectObject);
  }

  renderFrame(input: {
    video: HTMLVideoElement;
    effectId: string;
    landmarks: NormalizedLandmark[] | null;
    matrix: number[] | Float32Array | null;
    mask: Float32Array | null;
    maskWidth: number;
    maskHeight: number;
    timeMs: number;
  }) {
    const { video, effectId, landmarks, matrix, mask, maskWidth, maskHeight, timeMs } = input;
    this.setEffect(effectId);
    this.resize(video.videoWidth, video.videoHeight);

    const profile = getEffectProfile(effectId);
    const material = this.videoPlane.material as THREE.MeshBasicMaterial;

    if (profile.kind === 'segment-bg' && mask) {
      this.compositeCanvas.width = this.width;
      this.compositeCanvas.height = this.height;
      drawSegmentationComposite(
        this.compositeCtx,
        video,
        this.mirror,
        this.width,
        this.height,
        mask,
        maskWidth,
        maskHeight,
        (bgCtx, w, h) => {
          if (effectId === 'background_blur') {
            bgCtx.filter = 'blur(16px) saturate(1.08)';
            drawVideoFrame(bgCtx, video, this.mirror, w, h);
            bgCtx.filter = 'none';
            return;
          }
          if (effectId === 'background_replacement') {
            bgCtx.fillStyle = '#ffffff';
            bgCtx.fillRect(0, 0, w, h);
            return;
          }
          if (effectId === 'burning') {
            const g = bgCtx.createLinearGradient(0, 0, w, h);
            g.addColorStop(0, '#2b0000');
            g.addColorStop(0.5, '#ff4500');
            g.addColorStop(1, '#ffd27a');
            bgCtx.fillStyle = g;
            bgCtx.fillRect(0, 0, w, h);
            return;
          }
          const g = bgCtx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w);
          g.addColorStop(0, '#4c1d95');
          g.addColorStop(1, '#020617');
          bgCtx.fillStyle = g;
          bgCtx.fillRect(0, 0, w, h);
        },
      );
      this.compositeTexture.needsUpdate = true;
      material.map = this.compositeTexture;
      this.useCompositeTexture = true;
      this.faceRig.visible = false;
    } else {
      material.map = this.videoTexture;
      this.useCompositeTexture = false;
      this.faceRig.visible = effectId !== 'none';

      if (landmarks?.length) {
        if (matrix && matrix.length >= 16) {
          applyMatrixToRig(this.faceRig, matrix);
        } else {
          applyTrackingFrameToRig(this.faceRig, landmarksToTrackingFrame(landmarks, this.mirror));
        }
        if (this.effectObject) {
          animateEffectObject(this.effectObject, this.activeKind, timeMs);
        }
      }
    }

    this.videoTexture.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

  takeScreenshot(): string {
    return this.domElement.toDataURL('image/png');
  }

  dispose() {
    this.videoTexture.dispose();
    this.compositeTexture.dispose();
    this.renderer.dispose();
  }
}
