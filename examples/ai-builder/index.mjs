import { createPlanner } from '@unilives/ai-builder';

const planner = createPlanner();
const result = await planner.buildFromRequirement({
  projectId: 'example_ai',
  requirement: 'basic home page starter',
});
console.log('PASS', JSON.stringify({ ok: result.ok, pages: result.graph?.pages?.length ?? 0 }));
