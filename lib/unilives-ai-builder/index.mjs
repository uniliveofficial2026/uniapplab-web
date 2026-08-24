import {
  createEmptyProjectGraph,
  createProjectGraphEditor,
  validateProjectGraph,
  generateAppSource,
} from '@unilives/project-graph';
import { ValidationError, PermissionError } from '@unilives/errors';

export const MAX_REPAIR_ATTEMPTS = 3;

const ALLOWED_PATCH_OPS = new Set([
  'addPage',
  'addComponent',
  'placeComponent',
  'updateNodeProps',
  'bindAction',
  'setProjectName',
]);

const ALLOWED_ACTION_TYPES = new Set([
  'navigate',
  'auth.signIn',
  'auth.signOut',
  'database.query',
  'database.mutate',
  'storage.upload',
  'rtc.join',
  'rtc.leave',
  'function.invoke',
  'custom',
]);

const BLOCKED_PATTERNS = [
  /\bshell\b/i,
  /\brm\s+-rf\b/i,
  /\beval\s*\(/i,
  /\bexec\s*\(/i,
  /\.\.\//,
  /\/etc\/passwd/,
  /deploy\s*:\s*mutate/i,
  /secret\.read/i,
];

/**
 * @typedef {Object} ProjectGraphPatchOp
 * @property {string} op
 * @property {Record<string, unknown>} [params]
 */

/**
 * @typedef {Object} ProjectGraphPatch
 * @property {string} patchId
 * @property {string} summary
 * @property {ProjectGraphPatchOp[]} operations
 * @property {string[]} [requiredPermissions]
 */

/**
 * @typedef {Object} ExecutionPlan
 * @property {string} planId
 * @property {string} requirement
 * @property {string} intent
 * @property {ProjectGraphPatch[]} patches
 * @property {string[]} permissions
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} ok
 * @property {string[]} errors
 * @property {string[]} warnings
 */

/**
 * @typedef {Object} AIProvider
 * @property {string} id
 * @property {(input: { requirement: string, graph?: any }) => Promise<ExecutionPlan>} plan
 */

/**
 * @param {string} text
 */
export function sanitizeRequirement(text) {
  const value = String(text || '').slice(0, 4000);
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(value)) {
      throw new ValidationError('unsafe_requirement', { details: { pattern: String(pattern) } });
    }
  }
  return value.trim();
}

/**
 * @param {ExecutionPlan} plan
 * @returns {ValidationResult}
 */
export function validateExecutionPlan(plan) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!plan || typeof plan !== 'object') errors.push('plan_required');
  if (!plan.planId) errors.push('planId_required');
  if (!plan.requirement) errors.push('requirement_required');
  if (!Array.isArray(plan.patches)) errors.push('patches_must_be_array');

  for (const patch of plan.patches || []) {
    if (!patch.patchId) errors.push('patchId_required');
    if (!Array.isArray(patch.operations)) errors.push('operations_must_be_array');
    for (const op of patch.operations || []) {
      if (!ALLOWED_PATCH_OPS.has(op.op)) errors.push(`forbidden_op:${op.op}`);
      const params = op.params || {};
      for (const [k, v] of Object.entries(params)) {
        if (typeof v === 'string') {
          for (const pattern of BLOCKED_PATTERNS) {
            if (pattern.test(v)) errors.push(`unsafe_param:${op.op}.${k}`);
          }
          if (k === 'path' && !String(v).startsWith('/')) errors.push('path_must_be_absolute');
        }
      }
      if (op.op === 'bindAction') {
        const action = /** @type {{ type?: string }} */ (params.action || {});
        if (!ALLOWED_ACTION_TYPES.has(String(action.type || ''))) {
          errors.push(`unsupported_action:${action.type}`);
        }
      }
    }
    for (const perm of patch.requiredPermissions || []) {
      if (['deploy.mutate', 'secret.read', 'shell', 'filesystem.root'].includes(perm)) {
        warnings.push(`privileged_permission_declared:${perm}`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * @param {ProjectGraphPatch} patch
 * @returns {ValidationResult}
 */
export function validateProjectGraphPatch(patch) {
  const plan = {
    planId: 'patch_validation',
    requirement: patch.summary || '',
    intent: 'patch',
    patches: [patch],
    permissions: patch.requiredPermissions || [],
  };
  return validateExecutionPlan(plan);
}

/**
 * @param {any} graph
 * @param {ProjectGraphPatch} patch
 * @param {{ grantedPermissions?: string[] }} [ctx]
 */
export function applyProjectGraphPatch(graph, patch, ctx = {}) {
  const validation = validateProjectGraphPatch(patch);
  if (!validation.ok) {
    throw new ValidationError('invalid_patch', { details: { errors: validation.errors } });
  }

  const granted = new Set(ctx.grantedPermissions || []);
  for (const perm of patch.requiredPermissions || []) {
    if (['deploy.mutate', 'secret.read', 'shell', 'filesystem.root', 'db.admin'].includes(perm) && !granted.has(perm)) {
      throw new PermissionError('patch_permission_denied', { details: { permission: perm } });
    }
  }

  const editor = createProjectGraphEditor(structuredClone(graph));
  /** @type {Map<string, string>} */
  const pageByPath = new Map(editor.graph.pages.map((p) => [p.path, p.pageId]));
  /** @type {Map<string, string>} */
  const componentByType = new Map();

  for (const op of patch.operations) {
    const params = op.params || {};
    switch (op.op) {
      case 'setProjectName':
        editor.graph.name = String(params.name || editor.graph.name);
        break;
      case 'addPage': {
        const page = editor.addPage({ path: String(params.path), title: String(params.title || params.path) });
        pageByPath.set(page.path, page.pageId);
        break;
      }
      case 'addComponent': {
        const component = editor.addComponent({
          componentType: String(params.componentType),
          props: /** @type {Record<string, unknown>} */ (params.props || {}),
        });
        componentByType.set(component.componentType, component.componentId);
        break;
      }
      case 'placeComponent': {
        const pagePath = String(params.pagePath || '/');
        const pageId = pageByPath.get(pagePath) || editor.graph.pages.find((p) => p.path === pagePath)?.pageId;
        if (!pageId) throw new ValidationError('page_not_found', { details: { pagePath } });
        let componentId = params.componentId ? String(params.componentId) : null;
        if (!componentId && params.componentType) {
          componentId =
            componentByType.get(String(params.componentType)) ||
            editor.graph.components.find((c) => c.componentType === params.componentType)?.componentId;
        }
        if (!componentId) throw new ValidationError('component_not_found');
        editor.placeComponent({ pageId, componentId: String(componentId) });
        break;
      }
      case 'updateNodeProps': {
        const pageId = resolvePageId(editor.graph, params, pageByPath);
        const node = findNode(editor.graph, pageId, params);
        editor.updateNodeProps({
          pageId,
          nodeId: node.nodeId,
          props: /** @type {Record<string, unknown>} */ (params.props || {}),
        });
        break;
      }
      case 'bindAction': {
        const pageId = resolvePageId(editor.graph, params, pageByPath);
        const node = findNode(editor.graph, pageId, params);
        editor.bindAction({
          pageId,
          nodeId: node.nodeId,
          action: /** @type {{ type: string, [k: string]: unknown }} */ (params.action),
        });
        break;
      }
      default:
        throw new ValidationError('forbidden_op', { details: { op: op.op } });
    }
  }

  return editor.toJSON();
}

function resolvePageId(graph, params, pageByPath) {
  const pagePath = String(params.pagePath || '/');
  return (
    pageByPath.get(pagePath) ||
    graph.pages.find((p) => p.path === pagePath)?.pageId ||
    graph.pages[0]?.pageId
  );
}

function findNode(graph, pageId, params) {
  const page = graph.pages.find((p) => p.pageId === pageId);
  if (!page) throw new ValidationError('page_not_found');
  if (params.nodeId) {
    const node = page.nodes.find((n) => n.nodeId === params.nodeId);
    if (!node) throw new ValidationError('node_not_found');
    return node;
  }
  const componentType = params.componentType ? String(params.componentType) : null;
  if (componentType) {
    const node = page.nodes.find((n) => {
      const cmp = graph.components.find((c) => c.componentId === n.componentId);
      return cmp?.componentType === componentType;
    });
    if (node) return node;
  }
  if (!page.nodes.length) throw new ValidationError('node_not_found');
  return page.nodes[page.nodes.length - 1];
}

/**
 * Deterministic mock provider — no paid API required.
 * @param {{ id?: string }} [opts]
 * @returns {AIProvider}
 */
export function createMockAIProvider(opts = {}) {
  return {
    id: opts.id || 'mock',
    async plan({ requirement, graph }) {
      const req = sanitizeRequirement(requirement).toLowerCase();
      const planId = `plan_${Date.now().toString(36)}`;
      /** @type {ProjectGraphPatch[]} */
      const patches = [];

      if (/basic|starter|home/.test(req)) {
        patches.push({
          patchId: `${planId}_basic`,
          summary: 'Add basic home page',
          operations: [
            { op: 'setProjectName', params: { name: 'Basic App' } },
            { op: 'addPage', params: { path: '/', title: 'Home' } },
            { op: 'addComponent', params: { componentType: 'Heading', props: { text: 'Welcome' } } },
            { op: 'addComponent', params: { componentType: 'Button', props: { label: 'Get Started' } } },
            { op: 'placeComponent', params: { pagePath: '/', componentType: 'Heading' } },
            { op: 'placeComponent', params: { pagePath: '/', componentType: 'Button' } },
          ],
        });
      } else if (/live|stream/.test(req)) {
        patches.push({
          patchId: `${planId}_live`,
          summary: 'Add live stream page',
          operations: [
            { op: 'addPage', params: { path: '/live', title: 'Live' } },
            { op: 'addComponent', params: { componentType: 'LiveStage', props: {} } },
            { op: 'placeComponent', params: { pagePath: '/live', componentType: 'LiveStage' } },
            {
              op: 'bindAction',
              params: {
                pagePath: '/live',
                componentType: 'LiveStage',
                action: { type: 'rtc.join', roomId: 'live-main', roomType: 'LIVE' },
              },
            },
          ],
        });
      } else if (/profile|social/.test(req)) {
        patches.push({
          patchId: `${planId}_social`,
          summary: 'Add profile page',
          operations: [
            { op: 'addPage', params: { path: '/profile', title: 'Profile' } },
            { op: 'addComponent', params: { componentType: 'ProfileHeader', props: {} } },
            { op: 'placeComponent', params: { pagePath: '/profile', componentType: 'ProfileHeader' } },
          ],
        });
      } else if (graph?.pages?.length) {
        patches.push({
          patchId: `${planId}_noop`,
          summary: 'Requirement recognized — no structural change',
          operations: [{ op: 'setProjectName', params: { name: graph.name || graph.projectId } }],
        });
      } else {
        patches.push({
          patchId: `${planId}_default`,
          summary: 'Default scaffold',
          operations: [
            { op: 'addPage', params: { path: '/', title: 'Home' } },
            { op: 'addComponent', params: { componentType: 'Heading', props: { text: 'UniLive' } } },
            { op: 'placeComponent', params: { pagePath: '/', componentType: 'Heading' } },
          ],
        });
      }

      return {
        planId,
        requirement,
        intent: patches[0]?.summary || 'scaffold',
        patches,
        permissions: [],
      };
    },
  };
}

/**
 * @param {{ provider?: AIProvider, grantedPermissions?: string[], maxAttempts?: number }} [options]
 */
export function createPlanner(options = {}) {
  const provider = options.provider || createMockAIProvider();
  const maxAttempts = options.maxAttempts ?? MAX_REPAIR_ATTEMPTS;

  return {
    provider,
    async planRequirement(requirement) {
      const safe = sanitizeRequirement(requirement);
      const plan = await provider.plan({ requirement: safe });
      const validation = validateExecutionPlan(plan);
      return { plan, validation };
    },

    async buildFromRequirement(input) {
      const projectId = input.projectId || `project_${Date.now().toString(36)}`;
      let graph = input.graph || createEmptyProjectGraph({ projectId, name: input.name || projectId });
      /** @type {ValidationResult[]} */
      const attempts = [];

      for (let i = 0; i < maxAttempts; i++) {
        const { plan, validation } = await this.planRequirement(input.requirement);
        attempts.push(validation);
        if (!validation.ok) continue;

        try {
          for (const patch of plan.patches) {
            graph = applyProjectGraphPatch(graph, patch, {
              grantedPermissions: options.grantedPermissions || input.grantedPermissions,
            });
          }
          validateProjectGraph(graph);
          const source = generateAppSource(graph);
          return {
            ok: true,
            graph,
            plan,
            source,
            attempts: i + 1,
            validation,
          };
        } catch (err) {
          attempts.push({
            ok: false,
            errors: [err instanceof Error ? err.message : String(err)],
            warnings: [],
          });
        }
      }

      return {
        ok: false,
        graph,
        attempts: maxAttempts,
        validation: attempts[attempts.length - 1] || { ok: false, errors: ['repair_exhausted'], warnings: [] },
      };
    },
  };
}

export { createEmptyProjectGraph, validateProjectGraph, generateAppSource };
