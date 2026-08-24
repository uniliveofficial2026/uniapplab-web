import { ValidationError } from '@unilives/errors';

export const PROJECT_GRAPH_SCHEMA_VERSION = 1;

const ACTION_TYPES = new Set([
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

function mint(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {any} graph
 */
export function validateProjectGraph(graph) {
  if (!graph || typeof graph !== 'object') {
    throw new ValidationError('project_graph_required');
  }
  if (Number(graph.schemaVersion) !== PROJECT_GRAPH_SCHEMA_VERSION) {
    throw new ValidationError('unsupported_schema_version', {
      details: { schemaVersion: graph.schemaVersion, expected: PROJECT_GRAPH_SCHEMA_VERSION },
    });
  }
  if (!graph.projectId || typeof graph.projectId !== 'string') {
    throw new ValidationError('projectId_required');
  }
  if (!Array.isArray(graph.pages)) throw new ValidationError('pages_must_be_array');
  if (!Array.isArray(graph.routes)) throw new ValidationError('routes_must_be_array');
  if (!Array.isArray(graph.components)) throw new ValidationError('components_must_be_array');

  const pageIds = new Set();
  const componentIds = new Set();
  for (const c of graph.components) {
    if (!c.componentId || !c.componentType) {
      throw new ValidationError('component_requires_id_and_type');
    }
    if (componentIds.has(c.componentId)) {
      throw new ValidationError('duplicate_componentId', { details: { componentId: c.componentId } });
    }
    componentIds.add(c.componentId);
  }

  for (const page of graph.pages) {
    if (!page.pageId || !page.path) throw new ValidationError('page_requires_id_and_path');
    if (pageIds.has(page.pageId)) {
      throw new ValidationError('duplicate_pageId', { details: { pageId: page.pageId } });
    }
    pageIds.add(page.pageId);
    const nodeIds = new Set();
    for (const node of page.nodes || []) {
      if (node.nodeId) {
        if (nodeIds.has(node.nodeId)) {
          throw new ValidationError('duplicate_nodeId', { details: { nodeId: node.nodeId } });
        }
        nodeIds.add(node.nodeId);
      }
      if (!componentIds.has(node.componentId) && !node.componentType) {
        throw new ValidationError('page_node_unknown_component', {
          details: { pageId: page.pageId, componentId: node.componentId },
        });
      }
      for (const action of node.actions || []) {
        if (!ACTION_TYPES.has(action.type)) {
          throw new ValidationError('unsupported_action_type', { details: { type: action.type } });
        }
      }
      for (const binding of node.bindings || []) {
        const kind = binding?.kind || binding?.type;
        if (kind && !['static', 'route', 'auth', 'query', 'state', 'env', 'computed'].includes(kind)) {
          throw new ValidationError('unsafe_or_unknown_binding', { details: { kind } });
        }
        if (kind === 'computed' && typeof binding.expression === 'string' && /eval\(|Function\(|new Function/i.test(binding.expression)) {
          throw new ValidationError('unsafe_binding_expression');
        }
      }
    }
  }

  for (const route of graph.routes) {
    if (!route.routeId || !route.path || !route.pageId) {
      throw new ValidationError('route_requires_id_path_page');
    }
    if (!pageIds.has(route.pageId)) {
      throw new ValidationError('route_missing_page', { details: { pageId: route.pageId } });
    }
  }

  // Detect naive child cycles via node.children references
  for (const page of graph.pages) {
    const childrenMap = new Map();
    for (const node of page.nodes || []) {
      childrenMap.set(node.nodeId, (node.children || []).map((c) => (typeof c === 'string' ? c : c.nodeId)).filter(Boolean));
    }
    for (const nodeId of childrenMap.keys()) {
      const seen = new Set();
      let cur = nodeId;
      while (cur) {
        if (seen.has(cur)) throw new ValidationError('component_tree_cycle', { details: { pageId: page.pageId, nodeId } });
        seen.add(cur);
        const kids = childrenMap.get(cur) || [];
        cur = kids[0];
        if (kids.length > 1) break; // only walk first chain for cycle probe
      }
    }
  }
  return true;
}

/**
 * Future migration hook — schemaVersion 1 is current; no-op migrate.
 * @param {any} graph
 */
export function migrateProjectGraph(graph) {
  if (!graph || typeof graph !== 'object') throw new ValidationError('project_graph_required');
  const version = Number(graph.schemaVersion || 0);
  if (version === PROJECT_GRAPH_SCHEMA_VERSION) {
    validateProjectGraph(graph);
    return graph;
  }
  if (version < 1) {
    const next = { ...graph, schemaVersion: PROJECT_GRAPH_SCHEMA_VERSION };
    if (!next.pages) next.pages = [];
    if (!next.routes) next.routes = [];
    if (!next.components) next.components = [];
    validateProjectGraph(next);
    return next;
  }
  throw new ValidationError('unsupported_schema_version', {
    details: { schemaVersion: version, expected: PROJECT_GRAPH_SCHEMA_VERSION },
  });
}

/**
 * @param {{ projectId: string, name?: string }} input
 */
export function createEmptyProjectGraph(input) {
  return {
    schemaVersion: PROJECT_GRAPH_SCHEMA_VERSION,
    projectId: input.projectId,
    name: input.name || input.projectId,
    pages: [],
    routes: [],
    components: [],
    dataSources: [],
    bindings: {
      data: [],
      actions: [],
      permissions: [],
      auth: [],
      rtc: [],
      storage: [],
      deployment: [],
    },
    theme: { id: 'unilives-reference', tokens: {} },
    plugins: [],
  };
}

/**
 * Mutable builder helpers — operate on ProjectGraph safely (no eval).
 */
export function createProjectGraphEditor(graph) {
  validateProjectGraph(graph);
  /** @type {any[]} */
  const history = [];
  /** @type {any[]} */
  const future = [];
  const MAX = 50;

  function snapshot() {
    history.push(JSON.stringify(graph));
    if (history.length > MAX) history.shift();
    future.length = 0;
  }

  return {
    get graph() {
      return graph;
    },
    addPage({ path, title }) {
      snapshot();
      const page = {
        pageId: mint('page'),
        path,
        title: title || path,
        nodes: [],
      };
      graph.pages.push(page);
      graph.routes.push({ routeId: mint('route'), path, pageId: page.pageId });
      return page;
    },
    addComponent({ componentType, props = {} }) {
      snapshot();
      const component = {
        componentId: mint('cmp'),
        componentType,
        props,
      };
      graph.components.push(component);
      return component;
    },
    placeComponent({ pageId, componentId, props = {}, order }) {
      snapshot();
      const page = graph.pages.find((p) => p.pageId === pageId);
      if (!page) throw new ValidationError('page_not_found', { details: { pageId } });
      const node = {
        nodeId: mint('node'),
        componentId,
        props,
        actions: [],
        bindings: [],
        children: [],
      };
      if (typeof order === 'number') page.nodes.splice(order, 0, node);
      else page.nodes.push(node);
      return node;
    },
    updateNodeProps({ pageId, nodeId, props }) {
      snapshot();
      const page = graph.pages.find((p) => p.pageId === pageId);
      const node = page?.nodes?.find((n) => n.nodeId === nodeId);
      if (!node) throw new ValidationError('node_not_found');
      node.props = { ...node.props, ...props };
      return node;
    },
    bindAction({ pageId, nodeId, action }) {
      snapshot();
      if (!ACTION_TYPES.has(action.type)) {
        throw new ValidationError('unsupported_action_type', { details: { type: action.type } });
      }
      const page = graph.pages.find((p) => p.pageId === pageId);
      const node = page?.nodes?.find((n) => n.nodeId === nodeId);
      if (!node) throw new ValidationError('node_not_found');
      node.actions = node.actions || [];
      node.actions.push({ actionId: mint('act'), ...action });
      return node;
    },
    deleteNode({ pageId, nodeId }) {
      snapshot();
      const page = graph.pages.find((p) => p.pageId === pageId);
      if (!page) throw new ValidationError('page_not_found');
      page.nodes = (page.nodes || []).filter((n) => n.nodeId !== nodeId);
    },
    reorderNode({ pageId, nodeId, toIndex }) {
      snapshot();
      const page = graph.pages.find((p) => p.pageId === pageId);
      if (!page) throw new ValidationError('page_not_found');
      const idx = page.nodes.findIndex((n) => n.nodeId === nodeId);
      if (idx < 0) throw new ValidationError('node_not_found');
      const [node] = page.nodes.splice(idx, 1);
      page.nodes.splice(Math.max(0, Math.min(toIndex, page.nodes.length)), 0, node);
    },
    undo() {
      if (!history.length) return false;
      future.push(JSON.stringify(graph));
      const prev = JSON.parse(history.pop());
      Object.keys(graph).forEach((k) => delete graph[k]);
      Object.assign(graph, prev);
      return true;
    },
    redo() {
      if (!future.length) return false;
      history.push(JSON.stringify(graph));
      const next = JSON.parse(future.pop());
      Object.keys(graph).forEach((k) => delete graph[k]);
      Object.assign(graph, next);
      return true;
    },
    toJSON() {
      validateProjectGraph(graph);
      return JSON.parse(JSON.stringify(graph));
    },
  };
}

/**
 * Deterministic code generation — SDK/UI/RTC only, no provider SDKs.
 * @param {any} graph
 */
export function generateAppSource(graph) {
  validateProjectGraph(graph);
  const pages = graph.pages
    .map((page) => {
      const nodes = (page.nodes || [])
        .map((n) => {
          const cmp = graph.components.find((c) => c.componentId === n.componentId);
          const type = cmp?.componentType || n.componentType || 'div';
          const props = JSON.stringify({ ...(cmp?.props || {}), ...(n.props || {}) });
          return `      <${type} {...${props}} />`;
        })
        .join('\n');
      return `
export function Page_${page.pageId.replace(/[^a-zA-Z0-9_]/g, '_')}() {
  return (
    <main data-page="${page.path}">
${nodes || '      null'}
    </main>
  );
}`;
    })
    .join('\n');

  return `/** @generated by @unilives/project-graph — do not hand-edit without ownership markers */
import { createUniLive } from '@unilives/sdk';

export const projectId = ${JSON.stringify(graph.projectId)};
export const uni = createUniLive({ projectId });

${pages}

export const routes = ${JSON.stringify(
    graph.routes.map((r) => ({ path: r.path, pageId: r.pageId })),
    null,
    2,
  )};
`;
}
