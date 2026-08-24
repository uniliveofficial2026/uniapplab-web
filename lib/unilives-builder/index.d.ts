export const PREVIEW_SIZES: Record<
  'mobile' | 'tablet' | 'desktop',
  { id: string; width: number; height: number; label: string }
>;
export const GRAPH_FILENAME: 'project-graph.json';

export function atomicWriteJson(filePath: string, data: unknown): Promise<void>;
export function loadProjectGraphFromFile(filePath: string): Promise<any>;

export function createBuilderSession(options: {
  projectsDir: string;
  sessionId?: string;
  previewSize?: 'mobile' | 'tablet' | 'desktop';
}): {
  sessionId: string;
  projectsDir: string;
  projectId: string | null;
  previewSize: 'mobile' | 'tablet' | 'desktop';
  getComponentPalette(): Array<{ category: string; components: unknown[] }>;
  createProject(input: { projectId: string; name?: string }): Promise<{ projectId: string; path: string; graph: any }>;
  openProject(input: { projectId: string }): Promise<{ projectId: string; path: string; graph: any }>;
  addPage(input: { path: string; title?: string }): any;
  addComponentFromPalette(input: { componentType: string; props?: Record<string, unknown> }): any;
  addComponent(input: { componentType: string; props?: Record<string, unknown> }): any;
  placeComponent(input: { pageId: string; componentId: string; props?: Record<string, unknown>; order?: number }): any;
  updateNodeProps(input: { pageId: string; nodeId: string; props: Record<string, unknown> }): any;
  bindAction(input: { pageId: string; nodeId: string; action: { type: string; [k: string]: unknown } }): any;
  deleteNode(input: { pageId: string; nodeId: string }): void;
  reorderNode(input: { pageId: string; nodeId: string; toIndex: number }): void;
  undo(): boolean;
  redo(): boolean;
  setPreviewSize(size: 'mobile' | 'tablet' | 'desktop'): { id: string; width: number; height: number; label: string };
  getPreviewFrame(): { id: string; width: number; height: number; label: string; projectId: string | null };
  toJSON(): any;
  save(): Promise<{ ok: boolean; projectId: string | null; path: string }>;
  load(): Promise<{ projectId: string; path: string; graph: any }>;
  generateAppSource(): string;
};

export {
  createEmptyProjectGraph,
  createProjectGraphEditor,
  generateAppSource,
  validateProjectGraph,
} from '@unilives/project-graph';
export { listComponentPalette, getComponentStub } from '@unilives/ui';
