import type { WorkspaceFile } from '../../dbTypes';
import type { WorkspaceFilesLayer } from '../layers';
import type { Constructor, DbCoreBacked, MixinCtor } from '../mixin';

export function WithWorkspaceFiles<T extends Constructor<DbCoreBacked>>(Base: T): MixinCtor<T, WorkspaceFilesLayer> {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
    }
    get files() {
      const defaultFiles = [
        { id: '1', name: 'App_Architecture.pdf', date: '2 hrs ago', size: '2.4 MB', author: 1 },
        { id: '2', name: 'Financials.xlsx', date: 'Yesterday', size: '1.1 MB', author: 0 },
      ];
      return this.load('workspace_files', defaultFiles) || defaultFiles;
    }

    addFile(file: WorkspaceFile) {
      this.save('workspace_files', [file, ...this.files]);
      this.asLocalDB().notifyWorkspaceTeam(
        {
          type: 'activity',
          actorUserId: this.asLocalDB().currentUserId,
          title: 'File uploaded',
          text: `${file?.name ?? 'New file'} added to workspace files`,
          targetTab: 'workspace',
        },
        this.asLocalDB().currentUserId
      );
    }

    deleteFile(id: string) {
      this.save('workspace_files', this.files.filter((f) => f.id !== id));
    }
  } as unknown as MixinCtor<T, WorkspaceFilesLayer>;
}
