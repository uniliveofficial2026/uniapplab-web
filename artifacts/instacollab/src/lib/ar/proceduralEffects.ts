import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { FaceFrame } from './faceGeometry';
import { clipFaceOval, getFaceFrame, LM, toPoint, withFaceTransform } from './faceGeometry';

function drawGlasses(
  ctx: CanvasRenderingContext2D,
  frame: FaceFrame,
  style: 'wayfarer' | 'aviators',
) {
  const lensW = frame.eyeDistance * 0.52;
  const lensH = frame.eyeDistance * (style === 'aviators' ? 0.42 : 0.38);
  const bridge = frame.eyeDistance * 0.12;
  const y = -lensH * 0.15;

  withFaceTransform(ctx, frame, () => {
    ctx.lineWidth = Math.max(2, frame.eyeDistance * 0.05);
    ctx.strokeStyle = style === 'aviators' ? 'rgba(30,30,30,0.92)' : 'rgba(15,15,15,0.95)';
    ctx.fillStyle = style === 'aviators' ? 'rgba(40,50,70,0.35)' : 'rgba(20,20,20,0.2)';

    const leftX = -frame.eyeDistance / 2 - lensW / 2;
    const rightX = frame.eyeDistance / 2 - lensW / 2;

    for (const x of [leftX, rightX]) {
      ctx.beginPath();
      if (style === 'aviators') {
        ctx.ellipse(x + lensW / 2, y, lensW / 2, lensH / 2, 0, 0, Math.PI * 2);
      } else {
        ctx.roundRect(x, y - lensH / 2, lensW, lensH, lensW * 0.15);
      }
      ctx.fill();
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(-bridge / 2, y);
    ctx.lineTo(bridge / 2, y);
    ctx.stroke();
  });
}

function drawHorns(ctx: CanvasRenderingContext2D, frame: FaceFrame) {
  const hornH = frame.faceHeight * 0.55;
  const hornW = frame.eyeDistance * 0.18;
  const offsetX = frame.eyeDistance * 0.42;
  const baseY = frame.forehead.y - frame.eyeCenter.y - frame.faceHeight * 0.05;

  withFaceTransform(ctx, frame, () => {
    for (const side of [-1, 1]) {
      const x = side * offsetX;
      const gradient = ctx.createLinearGradient(x, baseY, x, baseY - hornH);
      gradient.addColorStop(0, '#ff2d8a');
      gradient.addColorStop(0.5, '#ff6ac2');
      gradient.addColorStop(1, '#ffd1ef');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(x - hornW / 2, baseY);
      ctx.quadraticCurveTo(x + side * hornW, baseY - hornH * 0.55, x, baseY - hornH);
      ctx.quadraticCurveTo(x - side * hornW * 0.4, baseY - hornH * 0.55, x + hornW / 2, baseY);
      ctx.closePath();
      ctx.fill();
    }
  });
}

function drawHelmet(ctx: CanvasRenderingContext2D, frame: FaceFrame) {
  withFaceTransform(ctx, frame, () => {
    const w = frame.faceWidth * 1.05;
    const h = frame.faceHeight * 0.75;
    const y = -frame.faceHeight * 0.72;

    const gradient = ctx.createLinearGradient(0, y, 0, y + h);
    gradient.addColorStop(0, '#8b8f98');
    gradient.addColorStop(0.5, '#5f6670');
    gradient.addColorStop(1, '#3a4048');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, y + h * 0.45, w / 2, h / 2, 0, Math.PI, 0);
    ctx.lineTo(w / 2, y + h * 0.2);
    ctx.quadraticCurveTo(0, y - h * 0.15, -w / 2, y + h * 0.2);
    ctx.closePath();
    ctx.fill();
  });
}

function drawFlowers(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  mirror: boolean,
) {
  const frame = getFaceFrame(landmarks, width, height, mirror);
  const petals = 10;
  for (let i = 0; i < petals; i++) {
    const t = (i / petals) * Math.PI * 2;
    const radius = frame.faceWidth * 0.58;
    const x = frame.center.x + Math.cos(t) * radius;
    const y = frame.center.y + Math.sin(t) * radius * 0.9 - frame.faceHeight * 0.08;
    const hue = 300 + (i % 4) * 18;
    const gradient = ctx.createRadialGradient(x, y, 2, x, y, frame.eyeDistance * 0.18);
    gradient.addColorStop(0, `hsla(${hue}, 85%, 70%, 0.95)`);
    gradient.addColorStop(1, `hsla(${hue}, 85%, 55%, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, frame.eyeDistance * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFaceTint(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  mirror: boolean,
  color: string,
  alpha: number,
) {
  ctx.save();
  clipFaceOval(ctx, landmarks, width, height, mirror);
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawAnimalEars(
  ctx: CanvasRenderingContext2D,
  frame: FaceFrame,
  animal: 'lion' | 'dalmatian' | 'koala' | 'snail',
) {
  const earColors: Record<string, string> = {
    lion: '#c6862b',
    dalmatian: '#f2f2f2',
    koala: '#8a8f98',
    snail: '#d9a066',
  };
  const earColor = earColors[animal];
  const earW = frame.eyeDistance * 0.35;
  const earH = frame.eyeDistance * (animal === 'koala' ? 0.55 : 0.45);
  const y = frame.forehead.y - frame.eyeCenter.y - frame.faceHeight * 0.35;

  withFaceTransform(ctx, frame, () => {
    for (const side of [-1, 1]) {
      const x = side * frame.eyeDistance * 0.55;
      ctx.fillStyle = earColor;
      ctx.beginPath();
      ctx.ellipse(x, y, earW / 2, earH / 2, side * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (animal === 'snail') {
      const shellR = frame.faceWidth * 0.42;
      const shellY = -frame.faceHeight * 0.95;
      const shellGrad = ctx.createRadialGradient(0, shellY, shellR * 0.1, 0, shellY, shellR);
      shellGrad.addColorStop(0, '#f2c48b');
      shellGrad.addColorStop(1, '#9a6535');
      ctx.fillStyle = shellGrad;
      ctx.beginPath();
      ctx.arc(0, shellY, shellR, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawTrunk(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  mirror: boolean,
) {
  const frame = getFaceFrame(landmarks, width, height, mirror);
  const nose = frame.nose;
  const end = {
    x: nose.x + Math.sin(frame.angle) * frame.faceHeight * 0.15,
    y: nose.y + frame.faceHeight * 0.75,
  };
  const ctrl = {
    x: nose.x + frame.faceWidth * 0.15,
    y: nose.y + frame.faceHeight * 0.35,
  };

  ctx.strokeStyle = '#9a7b5d';
  ctx.lineWidth = frame.eyeDistance * 0.28;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(nose.x, nose.y);
  ctx.quadraticCurveTo(ctrl.x, ctrl.y, end.x, end.y);
  ctx.stroke();
}

function drawVendettaMask(ctx: CanvasRenderingContext2D, frame: FaceFrame) {
  withFaceTransform(ctx, frame, () => {
    const w = frame.faceWidth * 0.95;
    const h = frame.faceHeight * 0.55;
    const x = -w / 2;
    const y = -h * 0.05;
    ctx.fillStyle = 'rgba(15,15,18,0.88)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h * 0.12);
    ctx.fill();

    const eyeW = frame.eyeDistance * 0.34;
    const eyeH = frame.eyeDistance * 0.22;
    ctx.globalCompositeOperation = 'destination-out';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * frame.eyeDistance * 0.5, y + h * 0.35, eyeW / 2, eyeH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  });
}

function drawHumanoidVisor(ctx: CanvasRenderingContext2D, frame: FaceFrame) {
  withFaceTransform(ctx, frame, () => {
    const w = frame.faceWidth;
    const h = frame.eyeDistance * 0.42;
    const y = -h * 0.2;
    const grad = ctx.createLinearGradient(-w / 2, y, w / 2, y + h);
    grad.addColorStop(0, 'rgba(120,220,255,0.75)');
    grad.addColorStop(1, 'rgba(20,80,180,0.55)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-w / 2, y, w, h, h * 0.35);
    ctx.fill();
  });
}

function drawMakeup(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  mirror: boolean,
  split = false,
) {
  const frame = getFaceFrame(landmarks, width, height, mirror);
  const leftCheek = toPoint(landmarks, 234, width, height, mirror);
  const rightCheek = toPoint(landmarks, 454, width, height, mirror);
  const upperLip = toPoint(landmarks, LM.upperLip, width, height, mirror);
  const lowerLip = toPoint(landmarks, LM.lowerLip, width, height, mirror);

  ctx.save();
  if (split) {
    ctx.beginPath();
    ctx.rect(width / 2, 0, width / 2, height);
    ctx.clip();
  }

  const blush = (x: number, y: number) => {
    const r = frame.eyeDistance * 0.38;
    const g = ctx.createRadialGradient(x, y, r * 0.05, x, y, r);
    g.addColorStop(0, 'rgba(255, 140, 120, 0.55)');
    g.addColorStop(1, 'rgba(255, 140, 120, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  ctx.globalCompositeOperation = 'soft-light';
  blush(leftCheek.x, leftCheek.y);
  blush(rightCheek.x, rightCheek.y);

  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(210, 55, 90, 0.45)';
  ctx.beginPath();
  ctx.ellipse(
    (upperLip.x + lowerLip.x) / 2,
    (upperLip.y + lowerLip.y) / 2,
    frame.eyeDistance * 0.2,
    frame.eyeDistance * 0.09,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  effectId: string,
  frame: FaceFrame,
  timeMs: number,
) {
  const t = timeMs / 1000;
  if (effectId === 'pixel-hearts') {
    for (let i = 0; i < 8; i++) {
      const phase = t * 1.6 + i;
      const x = frame.center.x + Math.sin(phase) * frame.faceWidth * 0.45;
      const y = frame.forehead.y - ((phase * 45) % (frame.faceHeight * 1.2));
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = i % 2 === 0 ? '#ff4d8d' : '#ff8ab8';
      ctx.font = `${Math.round(frame.eyeDistance * 0.32)}px sans-serif`;
      ctx.fillText('♥', x, y);
    }
    ctx.globalAlpha = 1;
    return;
  }

  if (effectId === 'fire') {
    const baseX = frame.nose.x;
    const baseY = frame.chin.y;
    for (let i = 0; i < 5; i++) {
      const flicker = Math.sin(t * 10 + i) * frame.eyeDistance * 0.08;
      const x = baseX + flicker + (i - 2) * frame.eyeDistance * 0.12;
      const y = baseY + frame.faceHeight * 0.05 - ((t * 60 + i * 20) % (frame.faceHeight * 0.5));
      const r = frame.eyeDistance * (0.12 + (i % 3) * 0.04);
      const g = ctx.createRadialGradient(x, y, 1, x, y, r);
      g.addColorStop(0, 'rgba(255,240,120,0.9)');
      g.addColorStop(0.5, 'rgba(255,120,20,0.55)');
      g.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  if (effectId === 'ping-pong') {
    const x = frame.center.x + Math.sin(t * 3) * frame.faceWidth * 0.35;
    const y = frame.eyeCenter.y + Math.cos(t * 4) * frame.faceHeight * 0.15;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, frame.eyeDistance * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEmotion(
  ctx: CanvasRenderingContext2D,
  effectId: string,
  frame: FaceFrame,
  smileScore: number,
) {
  if (effectId === 'hope') {
    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = '#7dd3fc';
    ctx.font = `bold ${Math.round(frame.eyeDistance * 0.42)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('HOPE', frame.center.x, frame.forehead.y - frame.faceHeight * 0.15);
    ctx.restore();
    return;
  }

  const smileLift = smileScore * frame.eyeDistance * 0.12;
  withFaceTransform(ctx, frame, () => {
    ctx.strokeStyle = effectId === 'emotion-meter' ? '#34d399' : '#f9a8d4';
    ctx.lineWidth = Math.max(2, frame.eyeDistance * 0.06);
    ctx.beginPath();
    ctx.arc(0, frame.eyeDistance * 0.15 - smileLift, frame.eyeDistance * 0.35, 0.15, Math.PI - 0.15);
    ctx.stroke();
  });
}

export type ProceduralInput = {
  ctx: CanvasRenderingContext2D;
  landmarks: NormalizedLandmark[];
  width: number;
  height: number;
  mirror: boolean;
  effectId: string;
  kind: string;
  timeMs: number;
  smileScore: number;
};

export function drawProceduralEffect(input: ProceduralInput): void {
  const { ctx, landmarks, width, height, mirror, effectId, kind, timeMs, smileScore } = input;

  switch (kind) {
    case 'makeup':
      drawMakeup(ctx, landmarks, width, height, mirror, false);
      return;
    case 'makeup-split':
      drawMakeup(ctx, landmarks, width, height, mirror, true);
      return;
    case 'glasses':
      drawGlasses(ctx, getFaceFrame(landmarks, width, height, mirror), effectId === 'aviators' ? 'aviators' : 'wayfarer');
      return;
    case 'helmet':
      drawHelmet(ctx, getFaceFrame(landmarks, width, height, mirror));
      return;
    case 'horns':
      drawHorns(ctx, getFaceFrame(landmarks, width, height, mirror));
      return;
    case 'flowers':
      drawFlowers(ctx, landmarks, width, height, mirror);
      return;
    case 'face-tint':
      drawFaceTint(ctx, landmarks, width, height, mirror, '#c49a6c', 0.35);
      return;
    case 'face-mask':
      if (effectId === 'vendetta') {
        drawVendettaMask(ctx, getFaceFrame(landmarks, width, height, mirror));
      } else {
        drawHumanoidVisor(ctx, getFaceFrame(landmarks, width, height, mirror));
      }
      return;
    case 'animal': {
      const animal = effectId as 'lion' | 'dalmatian' | 'koala' | 'snail';
      const tints: Record<string, [string, number]> = {
        lion: ['#d4a24a', 0.28],
        dalmatian: ['#f5f5f5', 0.18],
        koala: ['#9aa0a8', 0.32],
        snail: ['#f0c9a0', 0.22],
      };
      const [color, alpha] = tints[animal] ?? ['#ccc', 0.2];
      drawFaceTint(ctx, landmarks, width, height, mirror, color, alpha);
      drawAnimalEars(ctx, getFaceFrame(landmarks, width, height, mirror), animal);
      return;
    }
    case 'trunk':
      drawTrunk(ctx, landmarks, width, height, mirror);
      return;
    case 'particles':
      drawParticles(ctx, effectId, getFaceFrame(landmarks, width, height, mirror), timeMs);
      return;
    case 'emotion':
      drawEmotion(ctx, effectId, getFaceFrame(landmarks, width, height, mirror), smileScore);
      return;
    default:
      return;
  }
}
