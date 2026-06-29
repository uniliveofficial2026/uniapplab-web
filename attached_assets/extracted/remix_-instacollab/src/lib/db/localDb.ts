import { DbCore } from './dbCore';
import { WithAuthLaunch } from './domains/authLaunch';
import { WithAuthPosts } from './domains/authPosts';
import { WithFollowBlocked } from './domains/followBlocked';
import { WithProfile } from './domains/profile';
import { WithWorkspaceTasks } from './domains/workspaceTasks';
import { WithReels } from './domains/reels';
import { WithNotifications } from './domains/notifications';
import { WithWorkspaceFiles } from './domains/workspaceFiles';
import { WithMessages } from './domains/messages';
import { WithStories } from './domains/stories';
import { WithSettings } from './domains/settings';
import { WithCloud } from './domains/cloud';
import { WithComments } from './domains/comments';
import { WithUiFlags } from './domains/uiFlags';
import { WithDating } from './domains/dating';
import type { Constructor } from './mixin';
import type { LocalDB } from './localDbType';

const DbWithLaunch = WithAuthLaunch(DbCore);
const DbWithAuth = WithAuthPosts(DbWithLaunch);
const DbWithFollow = WithFollowBlocked(DbWithAuth);
const DbWithProfile = WithProfile(DbWithFollow);
const DbWithWorkspaceTasks = WithWorkspaceTasks(DbWithProfile);
const DbWithReels = WithReels(DbWithWorkspaceTasks);
const DbWithNotifications = WithNotifications(DbWithReels);
const DbWithWorkspaceFiles = WithWorkspaceFiles(DbWithNotifications);
const DbWithMessages = WithMessages(DbWithWorkspaceFiles);
const DbWithStories = WithStories(DbWithMessages);
const DbWithSettings = WithSettings(DbWithStories);
const DbWithCloud = WithCloud(DbWithSettings);
const DbWithComments = WithComments(DbWithCloud);
const DbWithDating = WithDating(DbWithComments);
const DbComposed = WithUiFlags(DbWithDating) as unknown as Constructor<LocalDB>;

class LocalDBImpl extends DbComposed {}


export const db = new LocalDBImpl();
