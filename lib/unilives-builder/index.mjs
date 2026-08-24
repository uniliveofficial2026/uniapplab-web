import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ValidationError } from '@unilives/errors';
import {
  createEmptyProjectGraph,
  createProjectGraphEditor,
  generateAppSource,
  validateProjectGraph,
} from '@unilives/project-graph';
import { getComponentStub, listComponentPalette } from '@unilives/ui';

export const PREVIEW_SIZES = {
  mobile: { id: 'mobile', width: 390, height: 844, label: 'Mobile' },
  tablet: { id: 'tablet', width: 768, height: 1024, label: 'Tablet' },
  desktop: { id: 'desktop', width: 1280, height: 800, label: 'Desktop' },
};

export const GRAPH_FILENAME = 'project-graph.json';

function mint(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function graphPath(projectsDir, projectId) {
  return join(projectsDir, projectId, GRAPH_FILENAME);
}

/**
 * Atomic JSON write — temp file then rename.
 * @param {string} filePath
 * @param {unknown} data
 */
export async function atomicWriteJson(filePath, data) {
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await rename(tmp, filePath);
}

/**
 * @param {string} filePath
 */
export async function loadProjectGraphFromFile(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const graph = JSON.parse(raw);
  validateProjectGraph(graph);
  return graph;
}

/**
 * @param {{ projectsDir: string, sessionId?: string, previewSize?: keyof typeof PREVIEW_SIZES }} options
 */
export function createBuilderSession(options) {
  if (!options?.projectsDir) throw new ValidationError('projectsDir_required');
  const projectsDir = options.projectsDir;
  const sessionId = options.sessionId || mint('bsess');
  /** @type {string | null} */
  let activeProjectId = null;
  /** @type {ReturnType<typeof createProjectGraphEditor> | null} */
  let editor = null;
  /** @type {keyof typeof PREVIEW_SIZES} */
  let previewSize = options.previewSize || 'desktop';

  function requireEditor() {
    if (!editor || !activeProjectId) {
      throw new ValidationError('no_active_project', { details: { sessionId } });
    }
    return editor;
  }

  return {
    sessionId,
    get projectsDir() {
      return projectsDir;
    },
    get projectId() {
      return activeProjectId;
    },
    get previewSize() {
      return previewSize;
    },

    getComponentPalette() {
      return listComponentPalette();
    },

    async createProject({ projectId, name }) {
      if (!projectId) throw new ValidationError('projectId_required');
      const path = graphPath(projectsDir, projectId);
      if (existsSync(path)) {
        throw new ValidationError('project_already_exists', { details: { projectId } });
      }
      const graph = createEmptyProjectGraph({ projectId, name: name || projectId });
      await atomicWriteJson(path, graph);
      activeProjectId = projectId;
      editor = createProjectGraphEditor(graph);
      return { projectId, path, graph: editor.toJSON() };
    },

    async openProject({ projectId }) {
      if (!projectId) throw new ValidationError('projectId_required');
      const path = graphPath(projectsDir, projectId);
      if (!existsSync(path)) {
        throw new ValidationError('project_not_found', { details: { projectId } });
      }
      const graph = await loadProjectGraphFromFile(path);
      activeProjectId = projectId;
      editor = createProjectGraphEditor(graph);
      return { projectId, path, graph: editor.toJSON() };
    },

    addPage({ path, title }) {
      const ed = requireEditor();
      return ed.addPage({ path, title });
    },

    addComponentFromPalette({ componentType, props = {} }) {
      const stub = getComponentStub(componentType);
      if (!stub) {
        throw new ValidationError('unknown_component_type', { details: { componentType } });
      }
      const ed = requireEditor();
      return ed.addComponent({
        componentType,
        props: { ...(stub.defaultProps || {}), ...props },
      });
    },

    addComponent({ componentType, props = {} }) {
      const ed = requireEditor();
      return ed.addComponent({ componentType, props });
    },

    placeComponent(input) {
      return requireEditor().placeComponent(input);
    },

    updateNodeProps(input) {
      return requireEditor().updateNodeProps(input);
    },

    bindAction(input) {
      return requireEditor().bindAction(input);
    },

    deleteNode(input) {
      return requireEditor().deleteNode(input);
    },

    reorderNode(input) {
      return requireEditor().reorderNode(input);
    },

    undo() {
      return requireEditor().undo();
    },

    redo() {
      return requireEditor().redo();
    },

    setPreviewSize(size) {
      if (!PREVIEW_SIZES[size]) {
        throw new ValidationError('invalid_preview_size', { details: { size } });
      }
      previewSize = size;
      return PREVIEW_SIZES[size];
    },

    getPreviewFrame() {
      return { ...PREVIEW_SIZES[previewSize], projectId: activeProjectId };
    },

    toJSON() {
      const ed = requireEditor();
      return ed.toJSON();
    },

    async save() {
      const ed = requireEditor();
      const json = ed.toJSON();
      const path = graphPath(projectsDir, activeProjectId);
      await atomicWriteJson(path, json);
      return { ok: true, projectId: activeProjectId, path };
    },

    async load() {
      if (!activeProjectId) throw new ValidationError('no_active_project');
      return this.openProject({ projectId: activeProjectId });
    },

    generateAppSource() {
      return generateAppSource(requireEditor().toJSON());
    },
  };
}

export {
  createEmptyProjectGraph,
  createProjectGraphEditor,
  generateAppSource,
  validateProjectGraph,
  listComponentPalette,
  getComponentStub,
};
