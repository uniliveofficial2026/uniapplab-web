export function listTemplates(options?: { includeFuture?: boolean }): Array<{
  id: string;
  name: string;
  description: string;
  status: 'released' | 'future';
  packages: string[];
  env: string[];
  readme: string;
}>;
export function getTemplate(name: string): {
  id: string;
  name: string;
  description: string;
  status: 'released' | 'future';
  packages: string[];
  env: string[];
  readme: string;
  build: (input: { projectId: string }) => any;
};
export function createFromTemplate(
  name: string,
  options: { projectId: string; outDir: string },
): Promise<{ ok: boolean; template: string; projectId: string; outDir: string; graphPath: string; graph: any }>;
