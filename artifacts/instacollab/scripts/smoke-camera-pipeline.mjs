#!/usr/bin/env node
/**
 * Smoke tests for camera / TRTC background pipeline (no browser required).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;

function assert(name, condition, detail = '') {
  if (!condition) {
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ''}`);
    failed += 1;
  } else {
    console.log(`ok ${name}`);
  }
}

const video1 = path.join(root, 'public/trtc-webar/backgrounds/video-bg-1.mp4');
const video2 = path.join(root, 'public/trtc-webar/backgrounds/video-bg-2.mp4');

assert('video-bg-1 exists', fs.existsSync(video1));
assert('video-bg-2 exists', fs.existsSync(video2));
if (fs.existsSync(video1)) {
  const size = fs.statSync(video1).size;
  assert('video-bg-1 non-empty', size > 10_000, `size=${size}`);
}

const webarTypes = fs.readFileSync(path.join(root, 'src/lib/webar/webarTypes.ts'), 'utf8');
assert(
  'preset video paths are same-origin',
  webarTypes.includes("'/trtc-webar/backgrounds/video-bg-1.mp4'"),
);

const bgUtil = fs.readFileSync(path.join(root, 'src/lib/webar/webarBackgroundImage.ts'), 'utf8');
assert('resolveTencentBackgroundSrc exists', bgUtil.includes('resolveTencentBackgroundSrc'));

const hook = fs.readFileSync(path.join(root, 'src/lib/webar/useTencentWebAR.ts'), 'utf8');
const stableApply = fs.readFileSync(path.join(root, 'src/lib/webar/tencentWebARStableApply.ts'), 'utf8');
assert('effect queue wired', stableApply.includes('enqueueTencentWebAREffect'));
assert('stable apply pipeline wired', hook.includes('applyTencentWebARState'));
assert('effect preload before apply', stableApply.includes('preloadEffectIds'));
assert('segmentation state tracked', hook.includes('segmentationOnRef'));
assert('mirror updates without sdk reinit', !hook.match(/\[keepWarm, useBuiltinCamera, mirror\]/));
assert('init does not reset on track id', !hook.match(/\[keepWarm, useBuiltinCamera, inputVideoTrackId\]/));
assert('ready effect ids tracked', hook.includes('readyEffectIds'));
assert('body shape catalog loaded', hook.includes('buildShapeEffectMap'));
assert('stream swap re-applies effects', hook.includes('pushApplyState(instance, true)'));

const streamBeauty = fs.readFileSync(path.join(root, 'src/lib/ar/useStreamBeauty.ts'), 'utf8');
assert(
  'useStreamBeauty imports body shape gate',
  streamBeauty.includes('BODY_SHAPE_COMING_SOON') && streamBeauty.includes('isBodyShapeActive'),
);

const catalog = fs.readFileSync(path.join(root, 'src/lib/webar/trtcBeautyCatalog.ts'), 'utf8');
assert('shape effect map exported', catalog.includes('export function buildShapeEffectMap'));

const beautyFilters = fs.readFileSync(path.join(root, 'src/lib/ar/beautyFilters.ts'), 'utf8');
assert('normalizeTencentBeautify exported', beautyFilters.includes('export function normalizeTencentBeautify'));
assert('isTencentBeautifyActive exported', beautyFilters.includes('export function isTencentBeautifyActive'));
assert(
  'preset-only beautify path is direct',
  beautyFilters.includes('export function getTencentBeautifyParams(effectId: string)') &&
    beautyFilters.includes('return BEAUTY_TENCENT_PARAMS[effectId]'),
);

const bodyTray = fs.readFileSync(path.join(root, 'src/components/camera/BodyShapeTray.tsx'), 'utf8');
assert('shape effect preset wiring', bodyTray.includes('onShapeEffectChange'));

const sheet = fs.readFileSync(path.join(root, 'src/smule-rooms/components/LiveBeautySheet.tsx'), 'utf8');
assert('shape tab in beauty sheet', sheet.includes("'shape'") && sheet.includes('BodyShapeTray'));
assert('beauty preset icon thumbs', sheet.includes('BeautyPresetThumb'));
assert('background upload wired', sheet.includes('prepareTencentWebARBackgroundMedia'));
assert('video thumbs not all autoplaying', sheet.includes('autoPlay') && sheet.includes('selected'));
assert('effect buttons show loading', sheet.includes('animate-spin') && sheet.includes('isReady'));

const shell = fs.readFileSync(path.join(root, 'src/components/camera/CameraBeautyBottomShell.tsx'), 'utf8');
assert('panel anchorMode supported', shell.includes('anchorMode'));

const chatCallCtx = fs.readFileSync(path.join(root, 'src/contexts/ChatCallContext.tsx'), 'utf8');
assert(
  'video effects host wraps fullscreen and pip',
  chatCallCtx.includes('function ChatCallPresentation') &&
    chatCallCtx.includes('<ChatCallVideoEffectsHost') &&
    chatCallCtx.includes('<ChatCallPipWindow') &&
    chatCallCtx.includes('<MessagesActiveCallOverlay'),
);
assert(
  'effects host not gated on fullscreen only',
  !chatCallCtx.includes("presentation === 'fullscreen' && chatCall.callKind === 'video'"),
);

const pip = fs.readFileSync(path.join(root, 'src/components/messages/ChatCallPipWindow.tsx'), 'utf8');
assert('pip uses effects display stream', pip.includes('resolveLocalDisplayStream'));

const useChatCall = fs.readFileSync(path.join(root, 'src/lib/chat/useChatCall.ts'), 'utf8');
const flipCameraBlock =
  useChatCall.match(/const flipCamera = useCallback\([\s\S]*?\}, \[bindLocalVideoStream[^\]]*\]\);/)?.[0] ?? '';
assert(
  'flipCamera tracks facing mode explicitly',
  flipCameraBlock.length > 0 &&
    flipCameraBlock.includes('nextCameraFacingMode') &&
    !flipCameraBlock.includes('updateLiveKitLocalVideoTrack'),
);
const replaceTrackBlock =
  useChatCall.match(/const replacePublishedVideoTrack = useCallback\([\s\S]*?\}, \[\]\);/)?.[0] ?? '';
assert(
  'replacePublishedVideoTrack does not overwrite raw local stream',
  replaceTrackBlock.length > 0 && !replaceTrackBlock.includes('bindLocalVideoStream'),
);

const overlay = fs.readFileSync(path.join(root, 'src/components/messages/MessagesActiveCallOverlay.tsx'), 'utf8');
assert('call overlay full-bleed stage', overlay.includes('absolute inset-0 overflow-hidden'));
assert('call overlay transparent for local camera', overlay.includes('bg-transparent'));
assert('call controls auto-hide chrome', overlay.includes('useCameraEffectsPanelChrome'));

const localStage = fs.readFileSync(path.join(root, 'src/components/messages/ChatCallLocalCameraStage.tsx'), 'utf8');
assert('local stage uses beauty display stream', localStage.includes('beautyDisplayStream'));
assert('local stage keeps persistent SDK sink', localStage.includes('beautySinkVideoRef'));

const callFxHost = fs.readFileSync(path.join(root, 'src/contexts/ChatCallVideoEffectsHost.tsx'), 'utf8');
assert('host owns fullscreen camera layer', callFxHost.includes('showFullscreenCamera'));
assert('beauty output stream exposed', callFxHost.includes('beautyOutputStream'));
assert('call TRTC persistent during session', callFxHost.includes('persistent: active && beautyConfigured'));
assert('call catalogs preload on session', callFxHost.includes('loadCatalogs: active && beautyConfigured'));

const camera = fs.readFileSync(path.join(root, 'src/lib/camera/useCameraStream.ts'), 'utf8');
assert('camera ready on metadata', camera.includes('loadedmetadata') && camera.includes('setReady(true)'));

const capture = fs.readFileSync(path.join(root, 'src/components/ar/ARCameraCapture.tsx'), 'utf8');
assert('capture not blocked on webar loading', capture.includes('const previewLoading = !camera.ready'));

if (failed > 0) {
  console.error(`\n${failed} smoke check(s) failed`);
  process.exit(1);
}
console.log('\nAll camera pipeline smoke checks passed');
