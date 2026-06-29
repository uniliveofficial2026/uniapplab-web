import type { WorkspaceAuditLog, WorkspaceTask } from '../../dbTypes';
import type { WorkspaceTasksLayer } from '../layers';
import type { Constructor, DbCoreBacked, MixinCtor } from '../mixin';

export function WithWorkspaceTasks<T extends Constructor<DbCoreBacked>>(Base: T): MixinCtor<T, WorkspaceTasksLayer> {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
    }
    // Workspace

    get tasks(): WorkspaceTask[] {
      return this.load<WorkspaceTask[]>('workspace_tasks', [
        { id: 101, title: 'Update Marketing Assets', team: 'Design', due: 'Today', user: 1, completed: false },
        { id: 102, title: 'Setup Secure Payment Gateway', team: 'Engineering', due: 'Tomorrow', user: 3, completed: false },
        { id: 103, title: 'Weekly Analytics Review', team: 'Management', due: 'In 2 days', user: 0, completed: true },
      ]) || [];
    }
    
    addTask(task: WorkspaceTask) {
      const newTask = {
        ...task,
        id: task.id || Date.now(),
      };
      this.save('workspace_tasks', [newTask, ...this.tasks]);
      const meId = this.asLocalDB().currentUserId;
      const assigneeId = this.asLocalDB().resolveTaskAssigneeUserId(newTask);
      if (assigneeId && meId && assigneeId !== meId) {
        this.asLocalDB().pushNotificationForUser(assigneeId, {
          type: 'task',
          actorUserId: meId,
          taskId: newTask.id,
          title: 'New task assigned',
          text: `"${newTask.title}" · ${newTask.team ?? 'General'} · Due ${newTask.due ?? 'soon'}`,
          targetTab: 'workspace',
        });
      }
    }

    updateTask(id: number, updateFn: (task: WorkspaceTask) => WorkspaceTask) {
      const prior = this.tasks.find((t) => t.id === id);
      const updated = this.tasks.map((t) => (t.id === id ? updateFn(t) : t));
      this.save('workspace_tasks', updated);
      const next = updated.find((t) => t.id === id);
      if (!prior || !next) return;

      const meId = this.asLocalDB().currentUserId;
      const assigneeId = this.asLocalDB().resolveTaskAssigneeUserId(next);
      if (!meId || !assigneeId || assigneeId === meId) return;

      if (!prior.completed && next.completed) {
        this.asLocalDB().pushNotificationForUser(assigneeId, {
          type: 'task',
          actorUserId: meId,
          taskId: id,
          title: 'Task completed',
          text: `"${next.title}" was marked done`,
          targetTab: 'workspace',
        });
        return;
      }

      const metaChanged =
        prior.title !== next.title ||
        prior.due !== next.due ||
        prior.team !== next.team ||
        prior.user !== next.user;
      if (metaChanged) {
        this.asLocalDB().pushNotificationForUser(assigneeId, {
          type: 'task',
          actorUserId: meId,
          taskId: id,
          title: 'Task updated',
          text: `"${next.title}" · Due ${next.due ?? 'soon'}`,
          targetTab: 'workspace',
        });
      }
    }

    deleteTask(id: number) {
      const prior = this.tasks.find((t: { id: number }) => t.id === id);
      this.save(
        'workspace_tasks',
        this.tasks.filter((t: { id: number }) => t.id !== id)
      );
      if (!prior) return;
      const meId = this.asLocalDB().currentUserId;
      const assigneeId = this.asLocalDB().resolveTaskAssigneeUserId(prior);
      if (assigneeId && meId && assigneeId !== meId) {
        this.asLocalDB().pushNotificationForUser(assigneeId, {
          type: 'task',
          actorUserId: meId,

          taskId: id,
          title: 'Task removed',
          text: `"${prior.title}" was deleted from the workspace`,
          targetTab: 'workspace',
        });
      }
    }
    
    get auditLogs() {
      return this.load('workspace_auditLogs', [
        { id: 1, text: 'Sarah updated "Stripe Integration"', time: 'Just now' },
        { id: 2, text: 'Backup completed.', time: '1h ago' },
      ]) || [];
    }
    
    addAuditLog(
      log: Partial<WorkspaceAuditLog> & { notifyTeam?: boolean }
    ) {
      const entry = {
        id: log?.id ?? Date.now(),
        text: String(log?.text ?? 'Workspace activity'),
        time: log?.time ?? 'Just now',
      };
      this.save('workspace_auditLogs', this.cappedList([entry, ...this.auditLogs], 'audit'));
      if (log?.notifyTeam === false) return;
      this.asLocalDB().notifyWorkspaceTeam(
        {
          type: 'activity',
          actorUserId: this.asLocalDB().currentUserId,
          title: 'Workspace activity',
          text: entry.text,
          targetTab: 'workspace',
        },
        this.asLocalDB().currentUserId
      );
    }
  } as unknown as MixinCtor<T, WorkspaceTasksLayer>;
}
