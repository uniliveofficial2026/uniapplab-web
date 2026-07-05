import * as THREE from 'three';
import type { FaceTrackingFrame } from './faceTracking';

function metal(color: number, metalness = 0.7, roughness = 0.25) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

function glass() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x223344,
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.55,
    thickness: 0.2,
    transparent: true,
    opacity: 0.85,
  });
}

function buildGlasses(style: 'wayfarer' | 'aviators') {
  const group = new THREE.Group();
  const lensW = style === 'aviators' ? 0.24 : 0.22;
  const lensH = style === 'aviators' ? 0.11 : 0.09;
  const gap = 0.06;

  const frameMat = metal(style === 'aviators' ? 0x2a2a2a : 0x111111, 0.85, 0.2);
  const lensMat = glass();

  for (const side of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.BoxGeometry(lensW, lensH, 0.02), lensMat);
    lens.position.x = side * (lensW / 2 + gap / 2);
    lens.position.y = 0.02;
    const rim = new THREE.Mesh(new THREE.BoxGeometry(lensW + 0.02, lensH + 0.02, 0.025), frameMat);
    rim.position.copy(lens.position);
    group.add(rim, lens);
  }

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(gap, 0.02, 0.02), frameMat);
  bridge.position.y = 0.02;
  group.add(bridge);

  const templeMat = metal(0x1a1a1a, 0.9, 0.15);
  for (const side of [-1, 1]) {
    const temple = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.015, 0.015), templeMat);
    temple.position.set(side * (lensW + gap / 2 + 0.09), 0.02, -0.04);
    temple.rotation.y = side * 0.35;
    group.add(temple);
  }

  group.position.set(0, 0.05, 0.08);
  return group;
}

function buildHelmet() {
  const group = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.52, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.55),
    metal(0x6b7280, 0.75, 0.35),
  );
  shell.position.y = 0.18;
  shell.rotation.x = -0.15;
  group.add(shell);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.48, 0.025, 12, 48, Math.PI),
    metal(0xc9a227, 0.9, 0.2),
  );
  rim.position.y = 0.02;
  rim.rotation.x = Math.PI;
  group.add(rim);
  group.position.set(0, 0.12, 0.02);
  return group;
}

function buildHorns() {
  const group = new THREE.Group();
  const hornMat = new THREE.MeshStandardMaterial({
    color: 0xff2d8a,
    emissive: 0x660033,
    emissiveIntensity: 0.35,
    metalness: 0.2,
    roughness: 0.4,
  });
  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 16), hornMat);
    horn.position.set(side * 0.2, 0.28, 0.04);
    horn.rotation.z = side * 0.35;
    group.add(horn);
  }
  group.position.set(0, 0.1, 0.05);
  return group;
}

function buildAnimal(kind: 'lion' | 'dalmatian' | 'koala' | 'snail') {
  const group = new THREE.Group();
  const earColors: Record<string, number> = {
    lion: 0xc6862b,
    dalmatian: 0xf0f0f0,
    koala: 0x8a8f98,
    snail: 0xd9a066,
  };
  const earMat = new THREE.MeshStandardMaterial({ color: earColors[kind], roughness: 0.7 });
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 16), earMat);
    ear.position.set(side * 0.24, 0.22, -0.02);
    ear.rotation.z = side * -0.5;
    group.add(ear);
  }
  if (kind === 'snail') {
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0xc6864a, roughness: 0.55, metalness: 0.15 }),
    );
    shell.position.set(0, 0.38, -0.08);
    shell.scale.set(1, 0.75, 0.65);
    group.add(shell);
  }
  group.position.set(0, 0.08, 0.03);
  return group;
}

function buildTrunk() {
  const group = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.05, 0.12),
    new THREE.Vector3(0.04, -0.18, 0.1),
    new THREE.Vector3(0.02, -0.38, 0.14),
    new THREE.Vector3(0, -0.52, 0.18),
  ]);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 24, 0.045, 12, false),
    new THREE.MeshStandardMaterial({ color: 0x9a7b5d, roughness: 0.8 }),
  );
  group.add(tube);
  group.position.set(0, -0.02, 0.1);
  return group;
}

function buildMakeupTint(color: number, opacity: number) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 32, 32),
    new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity,
      roughness: 0.9,
      metalness: 0,
      depthWrite: false,
    }),
  );
  mesh.scale.set(1, 1.15, 0.55);
  mesh.position.set(0, 0, 0.06);
  return mesh;
}

function buildParticleField(color: number) {
  const count = 40;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 0.5;
    positions[i * 3 + 1] = Math.random() * 0.5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size: 0.025,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.position.set(0, 0.1, 0.1);
  return points;
}

export function buildEffectObject(effectId: string, kind: string): THREE.Object3D {
  const root = new THREE.Group();
  root.name = `effect-${effectId}`;

  switch (kind) {
    case 'glasses':
      root.add(buildGlasses(effectId === 'aviators' ? 'aviators' : 'wayfarer'));
      break;
    case 'helmet':
      root.add(buildHelmet());
      break;
    case 'horns':
      root.add(buildHorns());
      break;
    case 'animal':
      root.add(buildAnimal(effectId as 'lion' | 'dalmatian' | 'koala' | 'snail'));
      root.add(buildMakeupTint(0xffffff, 0.08));
      break;
    case 'trunk':
      root.add(buildTrunk());
      break;
    case 'makeup':
      root.add(buildMakeupTint(0xffb4a8, 0.22));
      break;
    case 'makeup-split': {
      const tint = buildMakeupTint(0xffb4a8, 0.22);
      const clip = new THREE.Group();
      clip.add(tint);
      root.add(clip);
      break;
    }
    case 'face-tint':
      root.add(buildMakeupTint(0xc49a6c, 0.25));
      break;
    case 'particles':
      root.add(buildParticleField(effectId === 'fire' ? 0xff6600 : 0xff4d8d));
      break;
    case 'flowers': {
      for (let i = 0; i < 8; i++) {
        const petal = new THREE.Mesh(
          new THREE.SphereGeometry(0.04, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0xff66cc, emissive: 0x551133, emissiveIntensity: 0.2 }),
        );
        const a = (i / 8) * Math.PI * 2;
        petal.position.set(Math.cos(a) * 0.38, 0.08 + Math.sin(a) * 0.12, 0.04);
        root.add(petal);
      }
      break;
    }
    default:
      break;
  }

  return root;
}

export function animateEffectObject(object: THREE.Object3D, kind: string, timeMs: number) {
  const t = timeMs / 1000;
  if (kind === 'particles') {
    object.rotation.y = Math.sin(t * 2) * 0.15;
    object.position.y = 0.08 + Math.sin(t * 3) * 0.02;
  }
}
