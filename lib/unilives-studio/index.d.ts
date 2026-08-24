export function startStudioServer(options?: {
  port?: number;
  host?: string;
  projectsDir?: string;
  controlPlane?: import('@unilives/platform-core').createControlPlaneStore extends (...args: any) => infer R ? R : never;
}): Promise<{
  server: import('node:http').Server;
  port: number;
  host: string;
  url: string;
  close(): Promise<void>;
}>;

export const PUBLIC_DIR: string;
