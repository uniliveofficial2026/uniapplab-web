import { createEmptyProjectGraph, createProjectGraphEditor, generateAppSource } from '@unilives/project-graph';
const g = createEmptyProjectGraph({ projectId: 'example_generated' });
const ed = createProjectGraphEditor(g);
const page = ed.addPage({ path: '/', title: 'Home' });
const btn = ed.addComponent({ componentType: 'Button', props: { label: 'Go' } });
ed.placeComponent({ pageId: page.pageId, componentId: btn.componentId });
const src = generateAppSource(ed.toJSON());
if (!src.includes('@unilives/sdk') || src.includes('livekit-client')) throw new Error('bad_codegen');
console.log(JSON.stringify({ ok: true, bytes: src.length }));
