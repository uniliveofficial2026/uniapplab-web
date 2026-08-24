export const PROJECT_GRAPH_SCHEMA_VERSION: 1;

export function validateProjectGraph(graph: unknown): true;
export function createEmptyProjectGraph(input: { projectId: string; name?: string }): any;
export function createProjectGraphEditor(graph: any): {
  graph: any;
  addPage(input: { path: string; title?: string }): any;
  addComponent(input: { componentType: string; props?: Record<string, unknown> }): any;
  placeComponent(input: { pageId: string; componentId: string; props?: Record<string, unknown>; order?: number }): any;
  updateNodeProps(input: { pageId: string; nodeId: string; props: Record<string, unknown> }): any;
  bindAction(input: { pageId: string; nodeId: string; action: { type: string; [k: string]: unknown } }): any;
  deleteNode(input: { pageId: string; nodeId: string }): void;
  reorderNode(input: { pageId: string; nodeId: string; toIndex: number }): void;
  undo(): boolean;
  redo(): boolean;
  toJSON(): any;
};
export function generateAppSource(graph: any): string;
