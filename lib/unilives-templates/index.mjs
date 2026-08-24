import { createEmptyProjectGraph, createProjectGraphEditor, validateProjectGraph } from '@unilives/project-graph';
import { atomicWriteJson } from '@unilives/builder';
import { ValidationError } from '@unilives/errors';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** @typedef {{ id: string, name: string, description: string, status: 'released'|'future', packages: string[], env: string[], readme: string, build: (input: { projectId: string }) => any }} TemplateDef */

/** @type {Record<string, TemplateDef>} */
const TEMPLATES = {
  basic: {
    id: 'basic',
    name: 'Basic App',
    description: 'Single home page with heading and primary button',
    status: 'released',
    packages: ['@unilives/sdk', '@unilives/ui'],
    env: ['UNILIVE_PROJECT_ID'],
    readme: '# Basic UniLive App\n\nMinimal scaffold with home page.\n',
    build({ projectId }) {
      const graph = createEmptyProjectGraph({ projectId, name: 'Basic App' });
      const ed = createProjectGraphEditor(graph);
      const page = ed.addPage({ path: '/', title: 'Home' });
      const heading = ed.addComponent({ componentType: 'Heading', props: { text: 'Welcome' } });
      const btn = ed.addComponent({ componentType: 'Button', props: { label: 'Get Started' } });
      const hNode = ed.placeComponent({ pageId: page.pageId, componentId: heading.componentId });
      const bNode = ed.placeComponent({ pageId: page.pageId, componentId: btn.componentId });
      ed.bindAction({ pageId: page.pageId, nodeId: bNode.nodeId, action: { type: 'navigate', to: '/explore' } });
      ed.updateNodeProps({ pageId: page.pageId, nodeId: hNode.nodeId, props: { text: 'Welcome to UniLive' } });
      return ed.toJSON();
    },
  },
  social: {
    id: 'social',
    name: 'Social Feed',
    description: 'Feed + profile surfaces',
    status: 'released',
    packages: ['@unilives/sdk', '@unilives/ui', '@unilives/realtime'],
    env: ['UNILIVE_PROJECT_ID', 'DATABASE_URL'],
    readme: '# Social Feed\n\nHome feed with profile page.\n',
    build({ projectId }) {
      const graph = createEmptyProjectGraph({ projectId, name: 'Social Feed' });
      const ed = createProjectGraphEditor(graph);
      const feed = ed.addPage({ path: '/feed', title: 'Feed' });
      const profile = ed.addPage({ path: '/profile', title: 'Profile' });
      const posts = ed.addComponent({ componentType: 'ScrollView', props: {} });
      const avatar = ed.addComponent({ componentType: 'ProfileHeader', props: {} });
      ed.placeComponent({ pageId: feed.pageId, componentId: posts.componentId });
      ed.placeComponent({ pageId: profile.pageId, componentId: avatar.componentId });
      ed.addComponent({ componentType: 'ChatList', props: {} });
      return ed.toJSON();
    },
  },
  reels: {
    id: 'reels',
    name: 'Reels',
    description: 'Vertical reels viewer',
    status: 'released',
    packages: ['@unilives/sdk', '@unilives/ui', '@unilives/storage'],
    env: ['UNILIVE_PROJECT_ID', 'STORAGE_BUCKET'],
    readme: '# Reels\n\nShort-form vertical video feed.\n',
    build({ projectId }) {
      const graph = createEmptyProjectGraph({ projectId, name: 'Reels' });
      const ed = createProjectGraphEditor(graph);
      const page = ed.addPage({ path: '/reels', title: 'Reels' });
      const stage = ed.addComponent({ componentType: 'ScrollView', props: { vertical: true } });
      ed.placeComponent({ pageId: page.pageId, componentId: stage.componentId });
      return ed.toJSON();
    },
  },
  livestream: {
    id: 'livestream',
    name: 'Live Stream',
    description: 'Live stage with chat and gifts',
    status: 'released',
    packages: ['@unilives/sdk', '@unilives/ui', '@unilives/rtc-client'],
    env: ['UNILIVE_PROJECT_ID', 'RTC_URL', 'RTC_API_KEY'],
    readme: '# Live Stream\n\nBroadcast with LiveStage, chat, and gifts.\n',
    build({ projectId }) {
      const graph = createEmptyProjectGraph({ projectId, name: 'Live Stream' });
      const ed = createProjectGraphEditor(graph);
      const page = ed.addPage({ path: '/live', title: 'Live' });
      const stage = ed.addComponent({ componentType: 'LiveStage', props: {} });
      const chat = ed.addComponent({ componentType: 'LiveChat', props: {} });
      const gifts = ed.addComponent({ componentType: 'GiftPanel', props: {} });
      const sNode = ed.placeComponent({ pageId: page.pageId, componentId: stage.componentId });
      ed.placeComponent({ pageId: page.pageId, componentId: chat.componentId });
      ed.placeComponent({ pageId: page.pageId, componentId: gifts.componentId });
      ed.bindAction({
        pageId: page.pageId,
        nodeId: sNode.nodeId,
        action: { type: 'rtc.join', roomId: 'live-main', roomType: 'LIVE' },
      });
      graph.bindings.rtc.push({ roomId: 'live-main', roomType: 'LIVE', role: 'host' });
      return ed.toJSON();
    },
  },
  call: {
    id: 'call',
    name: '1:1 Call',
    description: 'Voice/video call surface',
    status: 'released',
    packages: ['@unilives/sdk', '@unilives/ui', '@unilives/rtc-client'],
    env: ['UNILIVE_PROJECT_ID', 'RTC_URL'],
    readme: '# 1:1 Call\n\nCall view with controls.\n',
    build({ projectId }) {
      const graph = createEmptyProjectGraph({ projectId, name: '1:1 Call' });
      const ed = createProjectGraphEditor(graph);
      const page = ed.addPage({ path: '/call', title: 'Call' });
      const view = ed.addComponent({ componentType: 'CallView', props: {} });
      const controls = ed.addComponent({ componentType: 'CallControls', props: {} });
      const vNode = ed.placeComponent({ pageId: page.pageId, componentId: view.componentId });
      ed.placeComponent({ pageId: page.pageId, componentId: controls.componentId });
      ed.bindAction({
        pageId: page.pageId,
        nodeId: vNode.nodeId,
        action: { type: 'rtc.join', roomId: 'call-room', roomType: 'CALL_1_TO_1' },
      });
      return ed.toJSON();
    },
  },
  marketplace: {
    id: 'marketplace',
    name: 'Marketplace',
    description: 'Product grid and checkout',
    status: 'released',
    packages: ['@unilives/sdk', '@unilives/ui', '@unilives/database'],
    env: ['UNILIVE_PROJECT_ID', 'DATABASE_URL'],
    readme: '# Marketplace\n\nBrowse products and checkout.\n',
    build({ projectId }) {
      const graph = createEmptyProjectGraph({ projectId, name: 'Marketplace' });
      const ed = createProjectGraphEditor(graph);
      const shop = ed.addPage({ path: '/shop', title: 'Shop' });
      const checkout = ed.addPage({ path: '/checkout', title: 'Checkout' });
      const grid = ed.addComponent({ componentType: 'ProductGrid', props: {} });
      const form = ed.addComponent({ componentType: 'CheckoutForm', props: {} });
      ed.placeComponent({ pageId: shop.pageId, componentId: grid.componentId });
      const fNode = ed.placeComponent({ pageId: checkout.pageId, componentId: form.componentId });
      ed.bindAction({
        pageId: checkout.pageId,
        nodeId: fNode.nodeId,
        action: { type: 'database.mutate', table: 'orders', op: 'insert' },
      });
      return ed.toJSON();
    },
  },
  'complete-social': {
    id: 'complete-social',
    name: 'Complete Social (Future)',
    description: 'Full social suite — stub for future release',
    status: 'future',
    packages: ['@unilives/sdk'],
    env: ['UNILIVE_PROJECT_ID'],
    readme: '# Complete Social (Future)\n\nNot yet released.\n',
    build({ projectId }) {
      return createEmptyProjectGraph({ projectId, name: 'Complete Social' });
    },
  },
};

export function listTemplates({ includeFuture = false } = {}) {
  return Object.values(TEMPLATES)
    .filter((t) => includeFuture || t.status === 'released')
    .map(({ build, ...meta }) => meta);
}

export function getTemplate(name) {
  const tpl = TEMPLATES[name];
  if (!tpl) throw new ValidationError('template_not_found', { details: { name } });
  return tpl;
}

/**
 * @param {string} name
 * @param {{ projectId: string, outDir: string }} options
 */
export async function createFromTemplate(name, { projectId, outDir }) {
  const tpl = getTemplate(name);
  if (tpl.status === 'future') {
    throw new ValidationError('template_not_released', { details: { name } });
  }
  const graph = tpl.build({ projectId });
  validateProjectGraph(graph);
  await mkdir(outDir, { recursive: true });
  const graphPath = join(outDir, 'project-graph.json');
  await atomicWriteJson(graphPath, graph);
  await writeFile(join(outDir, 'README.md'), tpl.readme, 'utf8');
  await writeFile(
    join(outDir, 'template.json'),
    JSON.stringify(
      {
        template: tpl.id,
        projectId,
        packages: tpl.packages,
        env: tpl.env,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  return { ok: true, template: tpl.id, projectId, outDir, graphPath, graph };
}

export { TEMPLATES };
