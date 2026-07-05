import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MusicDiscPlayer } from '../messages/MusicDiscPlayer';
import { 
  CheckCircle2, Circle, Clock, MoreVertical, Search, 
  Calendar as CalendarIcon, Users, FolderKanban, ShieldCheck, PieChart,
  Moon, Sun, MessageSquare, Link as LinkIcon, FileText, History, ShieldAlert, Ban, Zap, Star, Activity, Plus, FileUp, X, Filter, Trash2, ArrowUpRight, Image,
  ChevronLeft, ChevronRight, Mail
} from 'lucide-react';
import { useDB, useDbRevision } from '../../lib/useDB';
import { handleAvatarError, handleMediaError, fileToBase64 } from '../../lib/utils';
import { nativeVideoControlGuardProps } from '../../lib/nativeVideoControls';
import { resolveUser, safeAvatarUrl } from '../../lib/safe';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { rechartsTooltipProps, useRechartsTheme } from '../../lib/useRechartsTheme';
import { useAuth } from '../../lib/AuthContext';
import { GoogleChatTab } from './GoogleChatTab';
import { GoogleKeepTab } from './GoogleKeepTab';
import { GmailTab } from './GmailTab';
import { AdminPanel } from '../admin/AdminPanel';
import { AppBrandPortalCard } from '../admin/AppBrandPortalCard';
import { AutomationControlToggles } from './AutomationControlToggles';
import { WORKSPACE_DISPLAY_NAME } from '../../lib/appBrand';
import { GoogleContactsTab } from './GoogleContactsTab';
import { GoogleCalendarTab } from './GoogleCalendarTab';
import { GoogleDocsTab } from './GoogleDocsTab';
import { WorkspaceMediaFullscreenPortal } from './WorkspaceMediaFullscreenPortal';
import type { User } from '../../types';

type TabType = 'dashboard' | 'calendar' | 'files' | 'docs' | 'gmail' | 'contacts' | 'chat' | 'keep' | 'admin';

type CollaboratorLiveInfo = {
  role: string;
  contribution: string;
  timestamp: number;
  status: 'online' | 'idle' | 'offline';
};

const getRelativeTimeString = (time: number) => {
  const diff = Date.now() - time;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

function roleLabelForUser(user: User): string {
  if (user.role === 'admin') return 'Admin';
  if (user.role === 'streamer') return 'Streamer';
  if (user.status === 'live') return 'Live creator';
  return 'Member';
}

function postTimeMs(post: { createdAt?: string; timestamp?: number | string }): number {
  if (post.createdAt) {
    const parsed = Date.parse(post.createdAt);
    if (Number.isFinite(parsed)) return parsed;
  }
  const ts = Number(post.timestamp || 0);
  return Number.isFinite(ts) ? ts : 0;
}

function getCollaboratorLiveInfo(
  db: {
    getUserPresence: (userId: string) => {
      online: boolean;
      lastSeenAt: number;
      lastActiveAt: number;
    };
  },
  user: User,
  posts: Array<{ user?: { id?: string }; caption?: string; createdAt?: string; timestamp?: number | string }>,
): CollaboratorLiveInfo {
  const presence = db.getUserPresence(user.id);
  const lastActive = Math.max(
    presence.lastActiveAt || 0,
    presence.lastSeenAt || 0,
    user.noteUpdatedAt || 0,
  );
  const idleCutoff = Date.now() - 30 * 60 * 1000;
  const status: CollaboratorLiveInfo['status'] = presence.online
    ? 'online'
    : lastActive >= idleCutoff
      ? 'idle'
      : 'offline';

  const userPosts = posts.filter((post) => post.user?.id === user.id);
  const latestPost = userPosts
    .slice()
    .sort((a, b) => postTimeMs(b) - postTimeMs(a))[0];
  const contribution = latestPost?.caption?.trim()
    ? `Posted: ${latestPost.caption.trim().slice(0, 72)}`
    : user.note?.trim()
      ? `Note: ${user.note.trim().slice(0, 72)}`
      : user.bio?.trim()
        ? user.bio.trim().slice(0, 72)
        : 'Active on UniLive';

  const timestamp = Math.max(
    lastActive,
    postTimeMs(latestPost || {}),
    user.noteUpdatedAt || 0,
    Date.now() - 12 * 60 * 60 * 1000,
  );

  return {
    role: roleLabelForUser(user),
    contribution,
    timestamp,
    status,
  };
}

function formatAuditLogTime(log: { id?: number; time?: string }): string {
  const id = Number(log.id);
  if (Number.isFinite(id) && id > 1_000_000_000_000) {
    return getRelativeTimeString(id);
  }
  return log.time || 'Just now';
}

function buildWeeklyActivityChart(
  posts: Array<{ createdAt?: string; timestamp?: number | string }>,
): Array<{ id: string; name: string; value: number; previous: number }> {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const thisWeek = Array.from({ length: 7 }, () => 0);
  const prevWeek = Array.from({ length: 7 }, () => 0);

  for (const post of posts) {
    const ts = postTimeMs(post);
    if (!ts) continue;
    const dayStart = new Date(ts);
    dayStart.setHours(0, 0, 0, 0);
    const dayMs = dayStart.getTime();
    const daysAgo = Math.round((startOfToday - dayMs) / (24 * 60 * 60 * 1000));
    if (daysAgo >= 0 && daysAgo < 7) {
      thisWeek[dayStart.getDay()] += 1;
    } else if (daysAgo >= 7 && daysAgo < 14) {
      prevWeek[dayStart.getDay()] += 1;
    }
  }

  // Order Mon → Sun for the chart.
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((dayIndex) => ({
    id: dayNames[dayIndex].toLowerCase(),
    name: dayNames[dayIndex],
    value: thisWeek[dayIndex],
    previous: prevWeek[dayIndex],
  }));
}

export function WorkspaceScreen() {
    const db = useDB();
    const dbRevision = useDbRevision();
    const USERS = db.users;
    const FILES = db.files;
    const me = resolveUser(db.users, db.currentUser);
    const posts = db.posts ?? [];

    const isDark = db.settings.theme === 'dark';
    const performanceChartTheme = useRechartsTheme();
    const performanceTooltipProps = rechartsTooltipProps(performanceChartTheme);

    const [activeTab, setActiveTab ] = useState<TabType>('dashboard');
    const workspaceTabsScrollRef = useRef<HTMLDivElement | null>(null);
    const [presenceTick, setPresenceTick] = useState(0);

    const scrollWorkspaceTabs = (direction: 'left' | 'right') => {
      const el = workspaceTabsScrollRef.current;
      if (!el) return;
      const amount = Math.max(220, Math.floor(el.clientWidth * 0.7));
      el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
    };
    const [collabSortBy, setCollabSortBy] = useState<'name-asc' | 'name-desc' | 'contribution-desc'>('contribution-desc');

    const collaboratorInfoById = useMemo(() => {
      const map = new Map<string, CollaboratorLiveInfo>();
      for (const user of USERS) {
        map.set(user.id, getCollaboratorLiveInfo(db, user, posts));
      }
      return map;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [USERS, posts, dbRevision, presenceTick]);

    const sortedCollaborators = useMemo(() => {
      return [...USERS].sort((a, b) => {
        const infoA = collaboratorInfoById.get(a.id)!;
        const infoB = collaboratorInfoById.get(b.id)!;
        if (collabSortBy === 'name-asc') {
          return (a.displayName || a.username).localeCompare(b.displayName || b.username);
        }
        if (collabSortBy === 'name-desc') {
          return (b.displayName || b.username).localeCompare(a.displayName || a.username);
        }
        return infoB.timestamp - infoA.timestamp;
      });
    }, [USERS, collabSortBy, collaboratorInfoById]);

    const activeProjects = useMemo(
      () => (db.tasks ?? []).filter((task) => !task.completed).length,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [db.tasks, dbRevision],
    );
    const teamActiveCount = useMemo(
      () =>
        USERS.filter((user) => {
          const info = collaboratorInfoById.get(user.id);
          return info?.status === 'online' || info?.status === 'idle';
        }).length,
      [USERS, collaboratorInfoById],
    );
    const privateShare = useMemo(() => {
      if (!USERS.length) return 100;
      const privateCount = USERS.filter((user) => user.isPrivate).length;
      return Math.round((privateCount / USERS.length) * 100);
    }, [USERS]);
    const performerRankLabel = useMemo(() => {
      const ranked = [...USERS].sort(
        (a, b) => (b.followers ?? 0) - (a.followers ?? 0) || (b.following ?? 0) - (a.following ?? 0),
      );
      const index = ranked.findIndex((user) => user.id === me.id);
      if (index < 0 || ranked.length === 0) return 'Top creator';
      const percentile = Math.max(1, Math.round(((index + 1) / ranked.length) * 100));
      return `Top ${percentile}% Performer`;
    }, [USERS, me.id]);
    const performerBarWidth = useMemo(() => {
      const ranked = [...USERS].sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0));
      const index = ranked.findIndex((user) => user.id === me.id);
      if (index < 0 || ranked.length === 0) return 50;
      return Math.max(8, Math.round((1 - index / ranked.length) * 100));
    }, [USERS, me.id]);

    const liveChartData = useMemo(() => buildWeeklyActivityChart(posts), [posts]);

    const moderationFlags = useMemo(() => {
      return posts
        .filter((post) => post.isReported && !post.isArchived)
        .slice()
        .sort((a, b) => postTimeMs(b) - postTimeMs(a))
        .map((post) => {
          const author = resolveUser(USERS, post.user);
          const thumb =
            post.imageUrl ||
            post.mediaList?.find((m) => m.type === 'image' || m.type === 'video')?.url ||
            author.avatarUrl;
          return {
            id: post.id,
            text: `Review requested on post "${String(post.id).slice(0, 14)}"`,
            reason: post.caption?.trim()
              ? `Caption: ${post.caption.trim().slice(0, 64)}`
              : 'Community Guidelines review',
            userId: author.id,
            userName: author.displayName || author.username,
            username: author.username,
            avatarUrl: author.avatarUrl,
            thumbUrl: thumb,
            isVideo: Boolean(post.videoUrl || post.mediaList?.some((m) => m.type === 'video')),
            createdAt: postTimeMs(post),
          };
        });
    }, [posts, USERS, dbRevision]);

    const approveReportedPost = (postId: string) => {
      const post = posts.find((p) => p.id === postId);
      const author = post ? resolveUser(USERS, post.user) : null;
      db.updatePost(postId, (p) => ({ ...p, isReported: false }));
      db.addAuditLog({
        id: Date.now(),
        text: `Approved post ${postId}${author ? ` by @${author.username}` : ''}`,
        time: 'Just now',
      });
    };

    const rejectReportedPost = (postId: string) => {
      const post = posts.find((p) => p.id === postId);
      const author = post ? resolveUser(USERS, post.user) : null;
      db.updatePost(postId, (p) => ({
        ...p,
        isReported: false,
        isArchived: true,
      }));
      db.addAuditLog({
        id: Date.now(),
        text: `Rejected & archived post ${postId}${author ? ` by @${author.username}` : ''}`,
        time: 'Just now',
      });
    };

    // Live update toggle
    const [liveMode, setLiveMode] = useState(true);
    
    // --- MEDIA ---
    const [taskMedia, setTaskMedia] = useState<{ url: string; isVideo: boolean }[]>([]);
    const [mediaToRemove, setMediaToRemove] = useState<number | null>(null);
    const [fullscreenMedia, setFullscreenMedia] = useState<{
      items: Array<{ url: string; isVideo?: boolean }>;
      mediaIndex: number;
    } | null>(null);
    const taskVideoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());

    const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
          try {
            const files = Array.from(e.target.files);
            const newMedia = await Promise.all(files.map(async (file) => {
              const base64 = await fileToBase64(file);
              return {
                url: base64,
                isVideo: file.type.startsWith("video/") || /\.(mp4|mov|webm|ogg|m4v|avi|wmv)$/i.test(file.name),
              };
            }));
            setTaskMedia((prev) => [...prev, ...newMedia]);
          } catch (err) {
            console.error('Error processing workspace media', err);
          }
        }
    };

    const toggleDarkMode = () => {
        db.updateSettings({ theme: isDark ? 'light' : 'dark' });
    };

    // --- MODALS ---
    const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
    const [isSyncCalendarModalOpen, setIsSyncCalendarModalOpen] = useState(false);
    const [isAddIntegrationModalOpen, setIsAddIntegrationModalOpen] = useState(false);
    
    const auditLogs = db.auditLogs;

    // Refresh presence-derived collaborator status while live mode is on.
    useEffect(() => {
        if (!liveMode) return undefined;
        const timer = window.setInterval(() => {
            setPresenceTick((tick) => tick + 1);
        }, 15_000);
        return () => window.clearInterval(timer);
    }, [liveMode]);


    // --- CALENDAR & TASKS ---
    const initialTasks = db.tasks;
    const tasks = db.tasks;
    const [taskFilter, setTaskFilter] = useState<'all'|'pending'|'completed'>('all');
    const [newTaskTitle, setNewTaskTitle] = useState('');

    const toggleTask = (id: number) => {
        db.updateTask(id, t => ({ ...t, completed: !t.completed }));
    };
    
    const addTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;
        db.addTask({
            id: Date.now(),
            title: newTaskTitle,
            team: 'General',
            due: 'Soon',
            user: 0,
            completed: false,
            media: taskMedia.length > 0 ? taskMedia : undefined
        });
        setNewTaskTitle('');
        setTaskMedia([]);
    };

    const filteredTasks = tasks.filter((t: any) => {
        if (taskFilter === 'pending') return !t.completed;
        if (taskFilter === 'completed') return t.completed;
        return true;
    });

    // --- FILES & VERSIONS ---
    const { googleAccessToken, loginWithGoogle } = useAuth();
    const [fileQuery, setFileQuery] = useState('');
    const filesLocal = db.files;
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [driveFiles, setDriveFiles] = useState<any[]>([]);
    const [loadingDrive, setLoadingDrive] = useState(false);
    const [pickerSearch, setPickerSearch] = useState('');

    const fetchDriveFiles = async () => {
        if (!googleAccessToken) return;
        setLoadingDrive(true);
        try {
            const res = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=15&fields=files(id,name,mimeType,size,modifiedTime)', {
                headers: {
                    'Authorization': `Bearer ${googleAccessToken}`,
                    'Accept': 'application/json'
                }
            });
            if (res.ok) {
                const data = await res.json();
                setDriveFiles(data.files || []);
            } else {
                setDriveFiles([]);
            }
        } catch (e) {
            console.error('Error fetching drive files', e);
            setDriveFiles([]);
        } finally {
            setLoadingDrive(false);
        }
    };

    useEffect(() => {
        if (isPickerOpen && googleAccessToken) {
            fetchDriveFiles();
        } else if (isPickerOpen && !googleAccessToken) {
            // Seed beautiful mockup Drive files so they can import immediately
            setDriveFiles([
                { id: 'dr1', name: 'Website_Wireframes_Ver3.fig', mimeType: 'application/vnd.google-apps.drawing', size: '4200000', modifiedTime: new Date(Date.now() - 36000000 * 2).toISOString() },
                { id: 'dr2', name: 'Product_Backlog_unilive.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: '1500000', modifiedTime: new Date(Date.now() - 36000000 * 10).toISOString() },
                { id: 'dr3', name: 'Venture_Pitch_Deck.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', size: '12400000', modifiedTime: new Date(Date.now() - 36000000 * 50).toISOString() },
                { id: 'dr4', name: 'Firestore_Security_Audit_Report.pdf', mimeType: 'application/pdf', size: '890000', modifiedTime: new Date(Date.now() - 36000000 * 1).toISOString() },
            ]);
        }
    }, [isPickerOpen, googleAccessToken]);

    const [previewMedia, setPreviewMedia] = useState<{ url: string; name: string; isVideo: boolean } | null>(null);

    const handleImportDriveFile = (file: any) => {
        if (filesLocal.some((existing) => existing.id === file.id)) {
            setIsPickerOpen(false);
            return;
        }
        const sizeString = file.size ? `${(Number(file.size) / (1024 * 1024)).toFixed(1)} MB` : '1.5 MB';
        // Check if it's media (mock check based on name extension for now since mimeType isn't fully reliable)
        const isMedia = /\.(mp3|mp4|mov|wav|ogg)$/i.test(file.name);
        
        db.addFile({
            id: file.id,
            name: file.name,
            date: 'Drive ' + new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
            size: sizeString,
            author: 0
        });
        
        if (isMedia) {
             // Mock url to demonstrate
             setPreviewMedia({ url: 'https://cdn.pixabay.com/audio/2022/10/26/audio_4f09d8aa04.mp3', name: file.name, isVideo: false });
        }
        setIsPickerOpen(false);
    };

    const handleFileUpload = () => {
        if(uploading) return;
        setUploading(true);
        setUploadProgress(0);
        const interval = setInterval(() => {
            setUploadProgress(p => {
                const next = p + 15 + Math.random() * 10;
                if (next >= 100) {
                    clearInterval(interval);
                    setUploading(false);
                    db.addFile({ id: Date.now().toString(), name: 'New_Dataset_Export.csv', date: 'Just now', size: '1.2 MB', author: 0 });
                    return 100;
                }
                return next;
            });
        }, 300);
    };

    const deleteFile = (id: string) => {
        db.deleteFile(id);
    };


    // --- ADMIN & INTEGRATIONS ---
    const cloudConnections = Array.isArray(db.settings.cloudConnections)
      ? db.settings.cloudConnections
      : [];
    const [integrations, setIntegrations] = useState<Record<string, boolean>>(() => ({
      slack: cloudConnections.some((c) => /slack/i.test(String(c?.id ?? c?.provider ?? ''))),
      trello: cloudConnections.some((c) => /trello/i.test(String(c?.id ?? c?.provider ?? ''))),
      github: cloudConnections.some((c) => /github|git/i.test(String(c?.id ?? c?.provider ?? ''))),
    }));
    
    // --- SPLASH AD SETTINGS ---
    const [splashAdUrl, setSplashAdUrl] = useState<string>((db.settings.splashAdUrl as string) || '');
    const [splashAdDuration, setSplashAdDuration] = useState<number>((db.settings.splashAdDuration as number) || 2);
    const [splashAdEnabled, setSplashAdEnabled] = useState<boolean>((db.settings.splashAdEnabled as boolean) || false);

    const handleSaveSplashSettings = () => {
        db.updateSettings({
            splashAdUrl,
            splashAdDuration,
            splashAdEnabled
        });
        window.dispatchEvent(new CustomEvent('app-toast', { 
            detail: 'Splash ad settings saved successfully!' 
        }));
    };
    const activeFlags = moderationFlags;

    const toggleIntegration = (key: string) => {
        const newVal = !integrations[key];
        db.addAuditLog({ id: Date.now(), text: `Integration ${key} was ${newVal ? 'connected' : 'disconnected'}.`, time: 'Just now' });
        setIntegrations(prev => ({...prev, [key]: newVal}));
    };

    // Simulated latency pings for integrations
    const [pings, setPings] = useState({ slack: 45, trello: 0, github: 120 });
    useEffect(() => {
        if (!liveMode) return;
        const pingInterval = setInterval(() => {
            setPings(prev => ({
                slack: integrations.slack ? Math.max(10, prev.slack + Math.floor(Math.random() * 21 - 10)) : 0,
                trello: integrations.trello ? Math.max(10, prev.trello + Math.floor(Math.random() * 21 - 10)) : 0,
                github: integrations.github ? Math.max(20, prev.github + Math.floor(Math.random() * 41 - 20)) : 0,
            }));
        }, 2000);
        return () => clearInterval(pingInterval);
    }, [integrations, liveMode]);

    return (
        <div className="w-full flex flex-col pt-6 md:pt-10 px-4 md:px-8 max-w-[1200px] mx-auto min-h-0 pb-6 overflow-x-hidden">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-serif italic font-black flex items-center gap-3 flex-wrap">
                        <span className="vibe-gradient-text">{WORKSPACE_DISPLAY_NAME}</span>
                        {liveMode && (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-green-500 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20 shadow-sm animate-pulse">
                                <Circle className="w-2 h-2 fill-green-500" /> Live
                            </span>
                        )}
                    </h1>
                    <p className="text-muted-foreground mt-1 font-medium text-sm">Advanced project management & analytics dashboard</p>
                </div>
                <div className="flex flex-col gap-3 w-full sm:w-auto sm:items-end">
                    <AutomationControlToggles />
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setLiveMode(!liveMode)}
                        className={`p-2 border rounded-full transition-colors flex items-center justify-center ${liveMode ? 'border-primary/50 text-primary bg-primary/10' : 'border-border bg-secondary/50 hover:bg-secondary'}`}
                        title="Toggle Live Real-time Mode"
                    >
                        <Activity className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={toggleDarkMode} 
                        className="p-2 border border-border rounded-full hover:bg-secondary transition-colors"
                        title="Toggle Dark Mode"
                    >
                        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                    <button 
                        onClick={() => setIsNewProjectModalOpen(true)}
                        className="px-5 py-2 bg-primary text-primary-foreground rounded-xl font-bold shadow-md hover:bg-primary/90 transition-colors flex items-center gap-2">
                        <Plus className="w-4 h-4" /> New Project
                    </button>
                </div>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="sticky top-0 z-30 bg-background pb-4 pt-4 -mx-4 px-4 md:-mx-8 md:px-8 mb-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => scrollWorkspaceTabs('left')}
                      className="hidden md:flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card/90 text-foreground hover:bg-secondary transition-colors"
                      aria-label="Scroll workspace tabs left"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div ref={workspaceTabsScrollRef} className="flex flex-1 gap-3 overflow-x-auto no-scrollbar pb-2 pt-1 -mx-1 px-1 snap-x scroll-smooth">
                        {(['dashboard', 'calendar', 'files', 'docs', 'gmail', 'contacts', 'chat', 'keep', 'admin'] as TabType[]).map(tabId => {
                            const labels = { 
                                dashboard: 'Dashboard', 
                                calendar: 'Calendar & Meet', 
                                files: 'Files & Picker', 
                                docs: 'Google Docs',
                                gmail: 'Gmail',
                                contacts: 'Contacts',
                                chat: 'Google Chat',
                                keep: 'Google Keep',
                                admin: 'Admin & Portal' 
                            };
                            const icons = { 
                                dashboard: PieChart, 
                                calendar: CalendarIcon, 
                                files: FileText, 
                                docs: FileText,
                                gmail: Mail,
                                contacts: Users,
                                chat: MessageSquare,
                                keep: FolderKanban,
                                admin: ShieldCheck 
                            };
                            const Label = labels[tabId];
                            const Icon = icons[tabId];

                            return (
                                <button 
                                    key={tabId}
                                    onClick={() => setActiveTab(tabId)}
                                    className={`group shrink-0 snap-start flex items-center gap-2.5 px-6 py-3 rounded-full font-bold text-[14px] transition-all duration-300 ease-out outline-none min-w-max ${
                                      activeTab === tabId 
                                        ? 'bg-foreground text-background shadow-md' 
                                        : 'bg-secondary text-foreground hover:bg-secondary/80 border border-transparent hover:border-border/60 hover:shadow-sm'
                                    }`}
                                >
                                    <Icon className={`w-4 h-4 transition-transform duration-300 ${activeTab === tabId ? 'scale-110' : 'group-hover:scale-110'}`} /> 
                                    {Label}
                                    {tabId === 'admin' && activeFlags.length > 0 && (
                                        <span className="ml-1 w-2 h-2 rounded-full bg-destructive animate-pulse" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <button
                      type="button"
                      onClick={() => scrollWorkspaceTabs('right')}
                      className="hidden md:flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card/90 text-foreground hover:bg-secondary transition-colors"
                      aria-label="Scroll workspace tabs right"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
                {/* Fade edges to indicate scrolling on mobile */}
                <div className="absolute top-0 right-0 bottom-4 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none sm:hidden" />
            </div>

            {/* View Switching */}
            <div className="min-w-0">
                
                {/* Dashboard View */}
                {activeTab === 'dashboard' && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="p-6 border border-border rounded-2xl bg-card shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl"><FolderKanban className="w-6 h-6" /></div>
                                <MoreVertical className="w-5 h-5 text-muted-foreground cursor-pointer" />
                            </div>
                            <div className="text-3xl font-black mb-1">{activeProjects}</div>
                            <div className="text-sm font-medium text-muted-foreground">Active Projects</div>
                        </div>
                        <div className="p-6 border border-border rounded-2xl bg-card shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-green-500/10 text-green-500 rounded-xl"><ShieldCheck className="w-6 h-6" /></div>
                            </div>
                            <div className="text-3xl font-black mb-1 text-green-500">{privateShare}%</div>
                            <div className="text-sm font-medium text-muted-foreground">Private accounts</div>
                        </div>
                        <div className="p-6 border border-border rounded-2xl bg-card shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl"><Users className="w-6 h-6" /></div>
                            </div>
                            <div className="text-3xl font-black mb-1">{teamActiveCount}</div>
                            <div className="text-sm font-medium text-muted-foreground">Team Active</div>
                            <div className="flex items-center gap-[-8px] mt-2">
                                {sortedCollaborators
                                  .filter((u) => {
                                    const status = collaboratorInfoById.get(u.id)?.status;
                                    return status === 'online' || status === 'idle';
                                  })
                                  .slice(0, 5)
                                  .map((u) => (
                                    <img key={u.id} src={safeAvatarUrl(u.avatarUrl)} className="w-6 h-6 rounded-full border-2 border-background object-cover" alt="" onError={handleAvatarError} />
                                  ))}
                            </div>
                        </div>
                        <div className="p-6 border border-border rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 text-card-foreground shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-orange-500/20 text-orange-500 rounded-xl"><Star className="w-6 h-6 fill-orange-500" /></div>
                            </div>
                            <div className="text-3xl font-black mb-1 text-orange-500">Rank</div>
                            <div className="text-sm font-bold text-foreground">{performerRankLabel}</div>
                            <div className="w-full bg-black/10 rounded-full h-1.5 mt-2 overflow-hidden"><div className="bg-orange-500 h-full" style={{ width: `${performerBarWidth}%` }}></div></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 border border-border rounded-2xl overflow-hidden bg-card text-card-foreground shadow-sm min-w-0 flex flex-col">
                            <div className="p-5 border-b border-border flex justify-between items-center bg-secondary/10">
                                <h2 className="text-lg font-bold flex items-center gap-2"><PieChart className="w-5 h-5 text-primary" /> Performance Analytics</h2>
                                <span className="text-xs font-bold text-muted-foreground px-3 py-1 bg-secondary rounded-full flex items-center gap-1 text-[11px] sm:text-xs">
                                  {liveMode && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                                  Real-time
                                </span>
                            </div>
                            <div className="p-6 h-[350px] w-full min-w-0 overflow-hidden pr-0 pl-0 sm:pl-2">
                                 <ResponsiveContainer width="99%" height="100%">
                                     <AreaChart data={liveChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                       <defs>
                                         <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={performanceChartTheme.seriesFillTop} stopOpacity={1}/>
                                            <stop offset="95%" stopColor={performanceChartTheme.seriesFillBottom} stopOpacity={1}/>
                                         </linearGradient>
                                         <linearGradient id="colorPrevious" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={performanceChartTheme.previousFillTop} stopOpacity={1}/>
                                            <stop offset="95%" stopColor={performanceChartTheme.previousFillBottom} stopOpacity={1}/>
                                         </linearGradient>
                                       </defs>
                                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={performanceChartTheme.grid} opacity={0.6} />
                                       <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: performanceChartTheme.tick, fontSize: 13, fontWeight: 600 }} dy={10} />
                                       <YAxis axisLine={false} tickLine={false} tick={{ fill: performanceChartTheme.tick, fontSize: 13, fontWeight: 600 }} dx={-10} />
                                       <Tooltip
                                         {...performanceTooltipProps}
                                         labelStyle={{
                                           ...performanceTooltipProps.labelStyle,
                                           fontSize: '13px',
                                           textTransform: 'uppercase',
                                           letterSpacing: '0.05em',
                                         }}
                                         isAnimationActive={false}
                                       />
                                       <Area type="monotone" isAnimationActive={false} dataKey="previous" stroke={performanceChartTheme.previous} strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorPrevious)" name="Previous Week" />
                                       <Area type="monotone" isAnimationActive={false} dataKey="value" stroke={performanceChartTheme.series} strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" name="This Week" activeDot={{ r: 6, stroke: performanceChartTheme.dotStroke, strokeWidth: 2 }} />
                                    </AreaChart>
                                 </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="border border-border rounded-2xl overflow-hidden bg-card text-card-foreground shadow-sm flex flex-col h-[350px] lg:h-auto max-h-[600px]">
                            <div className="p-5 border-b border-border bg-secondary/20 shrink-0">
                                <h2 className="text-lg font-bold flex items-center gap-2"><Clock className="w-5 h-5 text-accent" /> Audit Trail</h2>
                            </div>
                            <div className="p-5 overflow-y-auto space-y-6 flex-1 no-scrollbar relative">
                                {auditLogs.length === 0 ? (
                                    <p className="text-sm text-muted-foreground font-medium">No workspace activity yet.</p>
                                ) : (
                                  auditLogs.map((activity, i) => (
                                    <div key={activity.id} className="relative pl-6 animate-in slide-in-from-left-2 fade-in duration-300">
                                        {i !== auditLogs.length - 1 && <div className="absolute left-2 top-2 bottom-[-24px] w-[2px] bg-border" />}
                                        <div className="absolute left-[3px] top-1.5 w-2 h-2 rounded-full bg-primary ring-4 ring-background" />
                                        <p className="text-[13px] font-bold leading-relaxed">{activity.text}</p>
                                        <span className="text-[11px] text-muted-foreground font-medium">{formatAuditLogTime(activity)}</span>
                                    </div>
                                  ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Team Collaborators Sortable List */}
                    <div className="border border-border rounded-2xl overflow-hidden bg-card text-card-foreground shadow-sm mt-6 flex flex-col">
                        <div className="p-5 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center bg-secondary/10 gap-4">
                            <div>
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <Users className="w-5 h-5 text-primary" /> Workspace Collaborators
                                </h2>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Active team members and their latest workspace contributions.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
                                <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">Sort by:</span>
                                <select 
                                    id="collaborator-sort-select"
                                    value={collabSortBy}
                                    onChange={(e: any) => setCollabSortBy(e.target.value)}
                                    className="bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/45 outline-none cursor-pointer"
                                >
                                    <option value="contribution-desc">Recent Contribution</option>
                                    <option value="name-asc">Name (A-Z)</option>
                                    <option value="name-desc">Name (Z-A)</option>
                                </select>
                            </div>
                        </div>
                        <div className="p-5 overflow-x-auto no-scrollbar">
                            <div className="min-w-[600px] divide-y divide-border/60">
                                {sortedCollaborators.map((user) => {
                                    const info = collaboratorInfoById.get(user.id) ?? getCollaboratorLiveInfo(db, user, posts);
                                    return (
                                        <div key={user.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0 group">
                                            <div className="flex items-center gap-3.5">
                                                <div className="relative">
                                                    <img 
                                                        src={safeAvatarUrl(user.avatarUrl)} 
                                                        className="w-11 h-11 rounded-full object-cover border border-border/80" 
                                                        alt={user.displayName}
                                                        onError={handleAvatarError}
                                                    />
                                                    <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card ${
                                                        info.status === 'online' ? 'bg-emerald-500' : 
                                                        info.status === 'idle' ? 'bg-amber-400' : 'bg-gray-300'
                                                    }`} />
                                                </div>
                                                <div>
                                                    <div className="font-extrabold text-sm text-foreground flex items-center gap-1.5">
                                                        {user.displayName}
                                                        <span className="text-[11px] font-medium text-muted-foreground">@{user.username}</span>
                                                        {user.isVerified && (
                                                            <span className="w-4 h-4 text-primary shrink-0">
                                                                <ShieldCheck className="w-4 h-4 fill-primary/10" />
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] font-bold text-primary/80 mt-0.5">{info.role}</div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <div className="text-xs font-bold text-foreground max-w-[280px] truncate" title={info.contribution}>
                                                        {info.contribution}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground font-medium mt-0.5 flex items-center gap-1 justify-end">
                                                        <Clock className="w-3.5 h-3.5" /> {getRelativeTimeString(info.timestamp)}
                                                    </div>
                                                </div>
                                                
                                                <div className="shrink-0 w-24 text-right">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                                        info.status === 'online' ? 'bg-emerald-500/10 text-emerald-600' :
                                                        info.status === 'idle' ? 'bg-amber-500/10 text-amber-600' : 'bg-secondary text-muted-foreground'
                                                    }`}>
                                                        {info.status.toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                  </div>
                )}

                {/* Calendar & Tasks View */}
                {activeTab === 'calendar' && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <GoogleCalendarTab />
                  </div>
                )}

                {false && activeTab === 'calendar' && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <div className="border border-border bg-card rounded-2xl p-4 sm:p-6 shadow-sm mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" />

                     {/* Filters and Add */}
                     <div className="flex flex-col md:flex-row gap-4 mb-6 items-stretch md:items-center justify-between">
                         <div className="flex-1 flex flex-col gap-2 relative">
                            <form onSubmit={addTask} className="flex gap-2">
                             <input 
                                value={newTaskTitle}
                                onChange={e => setNewTaskTitle(e.target.value)}
                                placeholder="What needs to be done?" 
                                className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary shadow-sm text-sm font-medium"
                             />
                             <input
                               type="file"
                               id="task-media"
                               className="hidden"
                               accept="image/*,video/*"
                               multiple
                               onChange={handleMediaUpload}
                             />
                             <label
                               htmlFor="task-media"
                               className="p-3 bg-secondary text-foreground rounded-xl cursor-pointer hover:bg-secondary/80 transition-colors"
                             >
                               <Image className="w-5 h-5" />
                             </label>
                             <button type="submit" disabled={!newTaskTitle.trim()} className="p-3 bg-primary text-primary-foreground rounded-xl disabled:opacity-50 transition-opacity">
                                <Plus className="w-5 h-5"/>
                             </button>
                            </form>
                             {taskMedia.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto py-2">
                                  {taskMedia.map((media, idx) => (
                                    <div
                                      key={idx}
                                      className="relative inline-block border border-border rounded-lg max-w-[100px] h-20 group shrink-0 overflow-hidden"
                                    >
                                      {media.isVideo ? (
                                        <video
                                          src={media.url || undefined}
                                          className="w-full h-full object-cover"
                                          muted
                                          playsInline
                                          controls
                                          preload="auto"
                                          autoPlay
                                          loop
                                          {...nativeVideoControlGuardProps()}
                                        />
                                      ) : (
                                        <img
                                          src={media.url || undefined}
                                          className="w-full h-full object-cover cursor-pointer"
                                          onError={handleMediaError}
                                          onClick={() => setFullscreenMedia({ items: taskMedia, mediaIndex: idx })}
                                        />
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => setMediaToRemove(idx)}
                                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 z-10"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                      {media.isVideo && (
                                         <button
                                           onClick={() => setFullscreenMedia({ items: taskMedia, mediaIndex: idx })}
                                           className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
                                         >
                                           <div className="text-white">▶</div>
                                         </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                             )}
                          </div>
                         <div className="flex bg-secondary p-1 rounded-xl shadow-inner overflow-x-auto">
                            {(['all', 'pending', 'completed'] as const).map(filter => (
                                <button
                                    key={filter}
                                    onClick={() => setTaskFilter(filter)}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-bold capitalize transition-all ${taskFilter === filter ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    {filter}
                                </button>
                            ))}
                         </div>
                     </div>

                     <div className="space-y-3">
                        {filteredTasks.length === 0 ? (
                           <div className="text-center p-12 border border-dashed border-border rounded-2xl text-muted-foreground font-medium">
                               No tasks found.
                           </div>
                        ) : (
                            filteredTasks.map((task) => (
                                <div key={task.id} className={`p-4 border rounded-xl flex sm:items-center justify-between transition-all flex-col sm:flex-row gap-4 group ${task.completed ? 'bg-secondary/20 border-border/50' : 'bg-card border-border hover:border-primary/50 shadow-sm'}`}>
                                    <div className="flex items-start sm:items-center gap-4">
                                        <button onClick={() => toggleTask(task.id)} className="shrink-0 mt-1 sm:mt-0 outline-none">
                                            {task.completed ? (
                                                <CheckCircle2 className="w-6 h-6 text-green-500 hover:text-green-600 transition-colors" />
                                            ) : (
                                                <Circle className="w-6 h-6 text-muted-foreground hover:text-green-500 transition-colors" />
                                            )}
                                        </button>
                                        <div>
                                            <div className={`font-bold text-[15px] transition-all ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{task.title}</div>
                                            <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-2 flex-wrap">
                                            <span className="px-2 py-0.5 bg-secondary text-foreground rounded font-semibold">{task.team}</span> 
                                            <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> Due {task.due}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
                                        <button onClick={() => db.deleteTask(task.id)} className="text-muted-foreground hover:text-destructive opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity p-2">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <div className="flex items-center">
                                            <img src={safeAvatarUrl(USERS.length > 0 ? USERS[(task.user as number ?? 0) % USERS.length]?.avatarUrl : db.currentUser?.avatarUrl)} className="w-8 h-8 rounded-full border-2 border-background object-cover shadow-sm bg-secondary" alt="assignee" onError={handleAvatarError} />
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                     </div>
                  </div>
                )}

                {/* Files & Versions View */}
                {activeTab === 'files' && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 border border-border bg-card rounded-2xl p-4 sm:p-6 shadow-sm">
                     <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                           <h2 className="text-xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-primary" /> Document Repository</h2>
                           <p className="text-sm text-muted-foreground mt-1">Organize and track your project files and their versions.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input 
                                    type="text" 
                                    value={fileQuery}
                                    onChange={e => setFileQuery(e.target.value)}
                                    placeholder="Search files..." 
                                    className="w-full bg-secondary/50 border border-border rounded-lg pl-9 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" 
                                />
                            </div>
                            <button onClick={() => setIsPickerOpen(true)} className="bg-secondary text-foreground hover:bg-secondary/80 border border-border px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap transition-all shadow-sm mr-2"><LinkIcon className="w-4 h-4 text-primary" /> Import from Drive</button><button onClick={handleFileUpload} disabled={uploading} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-bold text-sm shadow flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-70 whitespace-nowrap">
                                {uploading ? <Activity className="w-4 h-4 animate-spin"/> : <FileUp className="w-4 h-4"/>}
                                {uploading ? 'Uploading...' : 'Upload File'}
                            </button>
                        </div>
                     </div>
                     
                     {uploading && (
                         <div className="mb-6 p-4 rounded-xl bg-secondary/50 border border-border flex flex-col gap-3">
                             <div className="flex justify-between items-center text-sm font-bold">
                                 <span>Uploading new dataset...</span>
                                 <span>{Math.floor(uploadProgress)}%</span>
                             </div>
                             <div className="w-full bg-secondary rounded-full h-2 overflow-hidden border border-border/50 relative">
                                 <div className="bg-primary h-full transition-all duration-[300ms] ease-out absolute left-0 top-0" style={{ width: `${uploadProgress}%` }}></div>
                             </div>
                         </div>
                     )}                      {isPickerOpen && ( <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if(e.target === e.currentTarget) setIsPickerOpen(false); }}><div className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col h-[500px]" onClick={e => e.stopPropagation()}><div className="p-4 border-b border-border bg-secondary/5 flex justify-between items-center"><div className="flex items-center gap-2"><div className="bg-blue-600 rounded px-1.5 py-0.5 text-white font-bold text-[10px]">GD</div><span className="font-bold text-sm text-foreground">Google Picker</span></div><button onClick={() => setIsPickerOpen(false)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button></div><div className="flex-1 flex overflow-hidden"><div className="w-40 border-r border-border bg-secondary/15 p-3 hidden sm:flex flex-col gap-1 text-[11px] font-bold text-foreground"><button className="flex items-center gap-2 p-2 bg-primary/10 text-primary rounded-xl text-left"><FileText className="w-3.5 h-3.5" /> My Drive</button><button className="flex items-center gap-2 p-2 text-muted-foreground hover:bg-secondary/40 rounded-xl text-left"><Users className="w-3.5 h-3.5" /> Shared with me</button><button className="flex items-center gap-2 p-2 text-muted-foreground hover:bg-secondary/40 rounded-xl text-left"><Star className="w-3.5 h-3.5" /> Starred</button></div><div className="flex-1 flex flex-col overflow-hidden p-4 bg-card"><div className="relative mb-3"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="text" value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="Search team documents, spreadsheets..." className="w-full bg-secondary/50 border border-border rounded-xl pl-9 p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground font-semibold" /></div>{!googleAccessToken && ( <div className="mb-3 p-3 bg-primary/5 rounded-xl border border-primary/15 text-[11px] font-bold text-foreground flex justify-between items-center gap-3"><span>Link Google Drive to browse live documents.</span><button onClick={loginWithGoogle} className="bg-primary hover:bg-primary/95 text-primary-foreground text-[10px] py-1 px-3 rounded-lg shadow-sm whitespace-nowrap">Link Account</button></div> )}<div className="flex-1 overflow-y-auto space-y-1">{loadingDrive ? ( <div className="text-center py-12 text-xs text-muted-foreground">Loading file repository...</div> ) : driveFiles.filter(f => f.name.toLowerCase().includes(pickerSearch.toLowerCase())).length === 0 ? ( <div className="text-center py-12 text-xs text-muted-foreground">No drive resources found.</div> ) : ( driveFiles.filter(f => f.name.toLowerCase().includes(pickerSearch.toLowerCase())).map(file => ( <button key={file.id} onClick={() => handleImportDriveFile(file)} className="w-full flex items-center justify-between p-3 rounded-xl border border-border/50 hover:border-primary/45 bg-card hover:bg-secondary/25 transition-all text-left group" ><div className="flex items-center gap-3 text-foreground truncate max-w-[70%]"><div className="p-2 rounded-lg bg-secondary text-primary group-hover:bg-primary/10 transition-colors"><FileText className="w-3.5 h-3.5" /></div><span className="truncate text-foreground font-bold text-xs">{file.name}</span></div><div className="text-[10px] text-muted-foreground text-right shrink-0 font-semibold mb-0.5"><p className="text-foreground font-bold">{(Number(file.size || 1500000) / (1024 * 1024)).toFixed(1)} MB</p><p className="text-[9px] text-muted-foreground/75 mt-0.5">{new Date(file.modifiedTime || Date.now()).toLocaleDateString()}</p></div></button> )) )}</div></div></div></div></div> )}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filesLocal.filter(f => (f.name as string | undefined)?.toLowerCase().includes(fileQuery.toLowerCase())).length === 0 ? (
                           <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center p-12 border border-dashed border-border rounded-xl text-muted-foreground font-medium">
                               No files match your search criteria.
                           </div>
                        ) : (
                            filesLocal.filter(f => (f.name as string | undefined)?.toLowerCase().includes(fileQuery.toLowerCase())).map((file, i) => (
                                <div key={file.id || i} className="p-4 border border-border rounded-xl hover:border-primary/50 transition-all cursor-pointer group bg-card hover:bg-secondary/20 shadow-sm relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                    <div className="flex justify-between items-start mb-3 relative z-10">
                                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <FileText className="w-5 h-5 text-primary" />
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={(e) => { e.stopPropagation(); deleteFile(file.id as string); }} className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity rounded">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <button className="p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity rounded">
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                    </div>
                                    </div>
                                    <h3 className="font-bold text-sm truncate relative z-10" title={file.name}>{file.name}</h3>
                                    <div className="flex justify-between items-center mt-4 relative z-10">
                                    <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                                        <img src={safeAvatarUrl(USERS.length > 0 ? USERS[(file.author as number ?? 0) % USERS.length]?.avatarUrl : db.currentUser?.avatarUrl)} className="w-4 h-4 rounded-full object-cover" alt="author" onError={handleAvatarError}/>
                                        {String(file.date ?? '')} • {String(file.size ?? '')}
                                    </div>
                                    <div className="flex items-center gap-1 text-[11px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full"><History className="w-3 h-3" /> v{Math.floor((Number(file.id) || 123) % 5) + 1}</div>
                                    </div>
                                </div>
                            ))
                        )}
                     </div>
                  </div>
                )}

                {/* Google Chat View */}
                {activeTab === 'chat' && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <GoogleChatTab />
                  </div>
                )}

                {/* Google Keep View */}
                {activeTab === 'keep' && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <GoogleKeepTab />
                  </div>
                )}

                {/* Google Docs View */}
                {activeTab === 'docs' && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <GoogleDocsTab />
                  </div>
                )}

                {/* Gmail View */}
                {activeTab === 'gmail' && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <GmailTab />
                  </div>
                )}

                {/* Contacts View */}
                {activeTab === 'contacts' && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <GoogleContactsTab />
                  </div>
                )}

                {/* Admin & Integrations View */}
                {activeTab === 'admin' && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                     <AppBrandPortalCard />
                     <AdminPanel />
                     
                     <div className="border border-border bg-card rounded-2xl overflow-hidden shadow-sm">
                        <div className="p-5 border-b border-border bg-destructive/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                           <div>
                               <h2 className="text-lg font-bold flex items-center gap-2 text-destructive"><ShieldAlert className="w-5 h-5" /> Content Moderation</h2>
                               <p className="text-xs text-muted-foreground mt-1">Review flagged content and system security alerts.</p>
                           </div>
                           <span className="text-xs font-bold bg-destructive/10 text-destructive px-3 py-1 rounded-full whitespace-nowrap">
                             {activeFlags.length} Items Flagged
                           </span>
                        </div>
                        <div className="p-5">
                           {activeFlags.map((flag) => {
                               const author = resolveUser(USERS, { id: flag.userId });
                               return (
                               <div key={flag.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-destructive/20 rounded-xl bg-destructive/5 mb-3 gap-4">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="relative shrink-0">
                                      <img
                                        src={safeAvatarUrl(flag.thumbUrl || author.avatarUrl)}
                                        className="w-12 h-12 rounded-lg object-cover border border-border"
                                        alt=""
                                        onError={handleAvatarError}
                                      />
                                      <img
                                        src={safeAvatarUrl(author.avatarUrl)}
                                        className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full object-cover border-2 border-card"
                                        alt=""
                                        onError={handleAvatarError}
                                      />
                                    </div>
                                    <div className="min-w-0">
                                       <div className="font-bold text-[14px] truncate">{flag.text}</div>
                                       <div className="text-xs text-muted-foreground mt-0.5 truncate">
                                         {author.displayName || flag.userName} · @{author.username || flag.username}
                                         {flag.createdAt ? ` · ${getRelativeTimeString(flag.createdAt)}` : ''}
                                       </div>
                                       <div className="text-xs text-destructive flex items-center gap-1 mt-0.5"><Zap className="w-3 h-3 shrink-0"/> Reason: {flag.reason}</div>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 self-end sm:self-auto shrink-0">
                                     <button
                                       type="button"
                                       onClick={() => rejectReportedPost(flag.id)}
                                       className="px-3 py-1.5 border border-border rounded-lg hover:bg-secondary text-sm font-bold flex items-center gap-1"
                                     >
                                       <Ban className="w-4 h-4 text-destructive" /> Reject
                                     </button>
                                     <button
                                       type="button"
                                       onClick={() => approveReportedPost(flag.id)}
                                       className="px-3 py-1.5 border border-border rounded-lg hover:bg-secondary text-sm font-bold flex items-center gap-1"
                                     >
                                       <CheckCircle2 className="w-4 h-4 text-green-500" /> Approve
                                     </button>
                                  </div>
                               </div>
                           );
                           })}
                           {activeFlags.length === 0 && (
                             <div className="text-center text-sm font-medium text-muted-foreground py-8 flex flex-col items-center justify-center gap-2">
                               <ShieldCheck className="w-10 h-10 text-green-500 opacity-50" />
                               All clear! No reported posts pending review.
                             </div>
                           )}
                        </div>
                     </div>

                     <div className="border border-border bg-card rounded-2xl overflow-hidden shadow-sm">
                        <div className="p-5 border-b border-border bg-secondary/10">
                            <h2 className="text-lg font-bold flex items-center gap-2"><Image className="w-5 h-5 text-primary" /> Splash Screen Ads</h2>
                            <p className="text-xs text-muted-foreground mt-1">Configure ads displayed during app launch.</p>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="flex items-center gap-2 mb-4">
                              <input 
                                type="checkbox" 
                                id="splashAdEnabled"
                                checked={splashAdEnabled}
                                onChange={(e) => setSplashAdEnabled(e.target.checked)}
                                className="w-4 h-4"
                              />
                              <label htmlFor="splashAdEnabled" className="font-bold text-sm">Enable Splash Screen Ad</label>
                            </div>
                            
                            {splashAdEnabled && (
                              <>
                                <div>
                                  <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Ad Media (Image/Video)</label>
                                  <div className="flex flex-col gap-3">
                                    <div className="flex gap-2">
                                      <input 
                                        type="file" 
                                        accept="image/*,video/*"
                                        onChange={(e) => {
                                          if (e.target.files && e.target.files[0]) {
                                            const file = e.target.files[0];
                                            const reader = new FileReader();
                                            reader.onload = (event) => {
                                              if (event.target?.result) {
                                                setSplashAdUrl(event.target.result as string);
                                              }
                                            };
                                            reader.readAsDataURL(file);
                                          }
                                        }}
                                        className="hidden" 
                                        id="splash-media-upload"
                                      />
                                      <input 
                                        type="text" 
                                        value={splashAdUrl}
                                        onChange={(e) => setSplashAdUrl(e.target.value)}
                                        placeholder="https://example.com/ad.mp4" 
                                        className="w-full bg-secondary/50 border border-border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono" 
                                      />
                                      <label htmlFor="splash-media-upload" className="shrink-0 px-4 py-2.5 bg-secondary hover:bg-secondary/80 font-bold rounded-lg cursor-pointer text-sm whitespace-nowrap overflow-hidden transition-colors border border-border flex items-center justify-center">
                                        Upload File
                                      </label>
                                    </div>
                                    {splashAdUrl && (
                                      <div className="w-full max-w-sm bg-black/10 rounded-xl border border-border overflow-hidden flex items-center justify-center mt-2 mx-auto sm:mx-0 relative group shadow-inner" style={{ aspectRatio: '16/9' }}>
                                         {(splashAdUrl.includes('video') || splashAdUrl.endsWith('.mp4') || splashAdUrl.endsWith('.mov') || splashAdUrl.endsWith('.webm') || splashAdUrl.startsWith('data:video/')) ? (
                                           <video src={splashAdUrl} className="w-full h-full object-cover" controls {...nativeVideoControlGuardProps()} />
                                         ) : (
                                           <img src={splashAdUrl} alt="Ad preview" className="w-full h-full object-cover" />
                                         )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Display Duration (Seconds)</label>
                                  <input 
                                    type="number" 
                                    min="1"
                                    max="15"
                                    value={splashAdDuration}
                                    onChange={(e) => setSplashAdDuration(Number(e.target.value))}
                                    className="w-full bg-secondary/50 border border-border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" 
                                  />
                                </div>
                              </>
                            )}
                            
                            <button 
                              onClick={handleSaveSplashSettings}
                              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm shadow hover:bg-primary/90 transition-colors mt-2"
                            >
                              Save Ad Settings
                            </button>
                        </div>
                     </div>

                     <div className="border border-border bg-card rounded-2xl overflow-hidden shadow-sm">
                        <div className="p-5 border-b border-border bg-secondary/10 flex justify-between items-center">
                           <div>
                               <h2 className="text-lg font-bold flex items-center gap-2"><LinkIcon className="w-5 h-5 text-primary" /> App Integrations</h2>
                               <p className="text-xs text-muted-foreground mt-1">Manage connected third-party services.</p>
                           </div>
                           <button onClick={() => setIsAddIntegrationModalOpen(true)} className="text-sm font-bold text-primary flex items-center gap-1"><Plus className="w-4 h-4"/> Add New</button>
                        </div>
                        <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                           {[
                               { id: 'slack', name: 'Slack Integration', desc: 'Sync channels and alerts', color: 'bg-purple-500', icon: MessageSquare },
                               { id: 'trello', name: 'Trello Boards', desc: 'Sync task cards directly', color: 'bg-blue-500', icon: FolderKanban },
                               { id: 'github', name: 'GitHub Sync', desc: 'Code commits tracking', color: 'bg-foreground', icon: LinkIcon }
                           ].map(integ => (
                               <div 
                                 key={integ.id}
                                 onClick={() => toggleIntegration(integ.id)}
                                 className={`p-5 border rounded-xl flex flex-col justify-between transition-all cursor-pointer shadow-sm relative overflow-hidden ${integrations[integ.id] ? 'border-primary/50 bg-secondary/10 hover:bg-secondary/20' : 'border-border bg-card hover:bg-secondary/20'}`}
                               >
                                  <div className="flex items-start justify-between mb-4">
                                     <div className={`w-12 h-12 ${integ.color}/10 text-${integ.color.replace('bg-','')} rounded-xl flex items-center justify-center shadow-sm`}>
                                        <integ.icon className={`w-6 h-6 ${integ.color === 'bg-foreground' ? 'text-foreground' : ''}`} />
                                     </div>
                                     <div className={`w-11 h-6 rounded-full relative transition-colors shadow-inner ${integrations[integ.id] ? 'bg-green-500' : 'bg-secondary border border-border'}`}>
                                        <div className={`w-5 h-5 rounded-full absolute top-[1px] transition-all ${integrations[integ.id] ? 'bg-white right-[2px] shadow' : 'bg-muted-foreground left-[2px]'}`}></div>
                                     </div>
                                  </div>
                                  <div>
                                     <div className="font-bold text-[15px] mb-1">{integ.name}</div>
                                     <div className="text-xs text-muted-foreground">{integ.desc}</div>
                                  </div>
                                  
                                  {/* Status Indicator */}
                                  <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between text-[11px] font-bold">
                                      {integrations[integ.id] ? (
                                          <>
                                            <span className="text-green-500 flex items-center gap-1.5">
                                              <Circle className="w-2 h-2 fill-green-500" /> Connected
                                            </span>
                                            {liveMode && <span className="text-muted-foreground font-mono">{pings[integ.id as keyof typeof pings]}ms ping</span>}
                                          </>
                                      ) : (
                                          <span className="text-muted-foreground flex items-center gap-1.5">
                                            <Circle className="w-2 h-2" /> Disconnected
                                          </span>
                                      )}
                                  </div>
                               </div>
                           ))}
                        </div>
                     </div>

                  </div>
                )}
            </div>

            {/* MODALS */}
            {fullscreenMedia ? (
              <WorkspaceMediaFullscreenPortal
                fullscreenMedia={fullscreenMedia}
                onClose={() => setFullscreenMedia(null)}
                onMediaIndexChange={(mediaIndex) =>
                  setFullscreenMedia((prev) => (prev ? { ...prev, mediaIndex } : null))
                }
                taskVideoRefs={taskVideoRefs}
              />
            ) : null}
            {isNewProjectModalOpen && (
                <div className="fixed inset-0 bg-white dark:bg-zinc-950 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0" onClick={() => setIsNewProjectModalOpen(false)}></div>
                    <div className="bg-white dark:bg-zinc-900 border border-border w-full max-w-md rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative z-10">
                        <div className="p-4 border-b border-border flex justify-between items-center">
                           <h3 className="font-bold text-lg">Create New Project</h3>
                           <button onClick={() => setIsNewProjectModalOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                               <label className="block text-sm font-bold mb-1.5 text-muted-foreground">Project Name</label>
                               <input type="text" className="w-full border border-border rounded-lg bg-secondary/50 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="e.g. Website Redesign"/>
                            </div>
                            <div>
                               <label className="block text-sm font-bold mb-1.5 text-muted-foreground">Team</label>
                               <select className="w-full border border-border rounded-lg bg-secondary/50 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground">
                                  <option>Design</option>
                                  <option>Engineering</option>
                                  <option>Marketing</option>
                               </select>
                            </div>
                            <button onClick={() => {
                                setIsNewProjectModalOpen(false);
                                db.addAuditLog({ id: Date.now(), text: `You created a new project.`, time: 'Just now' });
                            }} className="w-full mt-2 py-2.5 bg-primary text-primary-foreground rounded-lg font-bold">Create Project</button>
                        </div>
                    </div>
                </div>
            )}

            {isSyncCalendarModalOpen && (
                <div className="fixed inset-0 bg-white dark:bg-zinc-950 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0" onClick={() => setIsSyncCalendarModalOpen(false)}></div>
                    <div className="bg-white dark:bg-zinc-900 border border-border w-full max-w-sm rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative z-10">
                        <div className="p-4 border-b border-border flex justify-between items-center">
                           <h3 className="font-bold text-lg">Sync Calendar</h3>
                           <button onClick={() => setIsSyncCalendarModalOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-muted-foreground mb-6">Choose your calendar provider to sync your tasks and events seamlessly.</p>
                            <div className="space-y-3">
                               <button onClick={() => { setIsSyncCalendarModalOpen(false); db.addAuditLog({ id: Date.now(), text: `You initiated Google Calendar sync.`, time: 'Just now' }); }} className="w-full flex items-center justify-center gap-2 border border-border rounded-lg p-3 hover:bg-secondary font-bold text-sm"><img src="https://static.cdnlogo.com/logos/g/12/google-calendar.svg" className="w-5 h-5" alt="Google" onError={handleMediaError} /> Google Calendar</button>
                               <button onClick={() => { setIsSyncCalendarModalOpen(false); db.addAuditLog({ id: Date.now(), text: `You initiated Apple Calendar sync.`, time: 'Just now' }); }} className="w-full flex items-center justify-center gap-2 border border-border rounded-lg p-3 hover:bg-secondary font-bold text-sm"><img src="https://static.cdnlogo.com/logos/a/80/apple.svg" className="w-5 h-5 dark:invert" alt="Apple" onError={handleMediaError} /> Apple Calendar</button>
                               <button onClick={() => { setIsSyncCalendarModalOpen(false); db.addAuditLog({ id: Date.now(), text: `You initiated Outlook sync.`, time: 'Just now' }); }} className="w-full flex items-center justify-center gap-2 border border-border rounded-lg p-3 hover:bg-secondary font-bold text-sm"><img src="https://static.cdnlogo.com/logos/m/8/microsoft-office-outlook.svg" className="w-5 h-5" alt="Outlook" onError={handleMediaError} /> Outlook</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isAddIntegrationModalOpen && (
                <div className="fixed inset-0 bg-white dark:bg-zinc-950 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0" onClick={() => setIsAddIntegrationModalOpen(false)}></div>
                    <div className="bg-white dark:bg-zinc-900 border border-border w-full max-w-sm rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative z-10">
                        <div className="p-4 border-b border-border flex justify-between items-center">
                           <h3 className="font-bold text-lg">Add Integration</h3>
                           <button onClick={() => setIsAddIntegrationModalOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6">
                           <div className="relative w-full mb-4">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input type="text" placeholder="Search app..." className="w-full bg-secondary/50 border border-border rounded-lg pl-9 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"/>
                            </div>
                            <div className="text-center text-sm font-medium text-muted-foreground py-8 flex flex-col items-center justify-center gap-2 border border-dashed border-border rounded-xl">
                               <Plus className="w-10 h-10 text-muted-foreground opacity-50" />
                               No new apps found.
                             </div>
                        </div>
                    </div>
                </div>
            )}

            {mediaToRemove !== null && (
                <div className="fixed inset-0 bg-white dark:bg-zinc-950 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0" onClick={() => setMediaToRemove(null)}></div>
                    <div className="bg-white dark:bg-zinc-900 border border-border w-full max-w-sm rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative z-10">
                        <div className="p-4 border-b border-border flex justify-between items-center">
                           <h3 className="font-bold text-lg">Remove Attachment</h3>
                           <button onClick={() => setMediaToRemove(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-foreground mb-6">Are you sure you want to remove this media attachment?</p>
                            <div className="flex gap-3">
                               <button onClick={() => setMediaToRemove(null)} className="flex-1 py-2.5 rounded-lg font-bold bg-secondary hover:bg-secondary/80 transition-colors">Cancel</button>
                               <button onClick={() => {
                                   setTaskMedia(prev => prev.filter((_, i) => i !== mediaToRemove));
                                   setMediaToRemove(null);
                               }} className="flex-1 py-2.5 rounded-lg font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors">Remove</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {previewMedia && (
                <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreviewMedia(null)}>
                    <div className="bg-card border border-border p-6 rounded-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                           <h2 className="font-bold text-lg">{previewMedia.name}</h2>
                           <button onClick={() => setPreviewMedia(null)} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5"/></button>
                        </div>
                        <MusicDiscPlayer url={previewMedia.url} name={previewMedia.name} />
                    </div>
                </div>
            )}
        </div>
    );
}

export default WorkspaceScreen;
