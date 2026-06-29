import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MusicDiscPlayer } from '../messages/MusicDiscPlayer';
import { 
  CheckCircle2, Circle, Clock, MoreVertical, Search, 
  Calendar as CalendarIcon, Users, FolderKanban, ShieldCheck, PieChart,
  Moon, Sun, MessageSquare, Link as LinkIcon, FileText, History, ShieldAlert, Ban, Zap, Star, Activity, Plus, FileUp, X, Filter, Trash2, ArrowUpRight, Image,
  ChevronLeft, ChevronRight, Mail
} from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { handleAvatarError, handleMediaError, fileToBase64 } from '../../lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../../lib/AuthContext';
import { GoogleChatTab } from './GoogleChatTab';
import { GoogleKeepTab } from './GoogleKeepTab';
import { GmailTab } from './GmailTab';
import { GoogleContactsTab } from './GoogleContactsTab';
import { GoogleCalendarTab } from './GoogleCalendarTab';
import { GoogleDocsTab } from './GoogleDocsTab';

type TabType = 'dashboard' | 'calendar' | 'files' | 'docs' | 'gmail' | 'contacts' | 'chat' | 'keep' | 'admin';

const COLLABORATOR_DETAILS: Record<string, { role: string; contribution: string; timestamp: number; status: 'online' | 'idle' | 'offline' }> = {
  'u1': { role: 'Lead Architect', contribution: 'Updated workspace dashboard layout', timestamp: Date.now() - 1000 * 60 * 45, status: 'online' }, // 45m ago
  'u2': { role: 'Product Manager', contribution: 'Approved Milestone 2 specs', timestamp: Date.now() - 1000 * 60 * 120, status: 'online' }, // 2h ago
  'u3': { role: 'Frontend Engineer', contribution: 'Refactored React Context states', timestamp: Date.now() - 1000 * 60 * 240, status: 'idle' }, // 4h ago
  'u4': { role: 'QA Lead', contribution: 'Logged 3 critical security bugs', timestamp: Date.now() - 1000 * 60 * 60 * 48, status: 'offline' }, // 2d ago
  'u5': { role: 'Cloud Specialist', contribution: 'Deployed new build containers to Cloud Run', timestamp: Date.now() - 1000 * 60 * 60 * 8, status: 'online' }, // 8h ago
  'u6': { role: 'Backend Developer', contribution: 'Wrote core middleware for API security', timestamp: Date.now() - 1000 * 60 * 60 * 24, status: 'offline' }, // 1d ago
  'u7': { role: 'Fullstack Engineer', contribution: 'Integrated persistent offline storage layer', timestamp: Date.now() - 1000 * 60 * 30, status: 'online' } // 30m ago
};

const getCollaboratorInfo = (userId: string) => {
  return COLLABORATOR_DETAILS[userId] || {
    role: 'Contributor',
    contribution: 'Involved in active task review',
    timestamp: Date.now() - 1000 * 60 * 60 * 12, // 12h ago
    status: 'offline' as const
  };
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

export function WorkspaceScreen() {
    const db = useDB();
    const USERS = db.users;
    const FILES = db.files;

    const isDark = db.settings.theme === 'dark';
    const [activeTab, setActiveTab ] = useState<TabType>('dashboard');
    const [collabSortBy, setCollabSortBy] = useState<'name-asc' | 'name-desc' | 'contribution-desc'>('contribution-desc');

    const sortedCollaborators = React.useMemo(() => {
      return [...USERS].sort((a, b) => {
        const infoA = getCollaboratorInfo(a.id);
        const infoB = getCollaboratorInfo(b.id);
        if (collabSortBy === 'name-asc') {
          return (a.displayName || a.username).localeCompare(b.displayName || b.username);
        } else if (collabSortBy === 'name-desc') {
          return (b.displayName || b.username).localeCompare(a.displayName || a.username);
        } else if (collabSortBy === 'contribution-desc') {
          return infoB.timestamp - infoA.timestamp;
        }
        return 0;
      });
    }, [USERS, collabSortBy]);


    
    // Live update toggle
    const [liveMode, setLiveMode] = useState(true);
    
    // --- MEDIA ---
    const [taskMedia, setTaskMedia] = useState<{ url: string; isVideo: boolean }[]>([]);
    const [mediaToRemove, setMediaToRemove] = useState<number | null>(null);
    const [fullscreenMedia, setFullscreenMedia] = useState<{
      items: Array<{ url: string; isVideo?: boolean }>;
      mediaIndex: number;
    } | null>(null);

    // Full screen swipe handlers
    const [fsTouchStart, setFsTouchStart] = useState<number | null>(null);
    const [fsTouchEnd, setFsTouchEnd] = useState<number | null>(null);
    const minSwipeDistance = 50;

    const handleFsTouchStart = (e: React.TouchEvent) => {
      setFsTouchEnd(null);
      setFsTouchStart(e.targetTouches[0].clientX);
    };

    const handleFsTouchMove = (e: React.TouchEvent) => {
      setFsTouchEnd(e.targetTouches[0].clientX);
    };

    const handleFsTouchEnd = () => {
      if (!fsTouchStart || !fsTouchEnd) return;
      const distance = fsTouchStart - fsTouchEnd;
      const isLeftSwipe = distance > minSwipeDistance;
      const isRightSwipe = distance < -minSwipeDistance;
      if (isLeftSwipe || isRightSwipe) {
        if (fullscreenMedia && fullscreenMedia.items.length > 1) {
          if (isLeftSwipe) {
            setFullscreenMedia((prev) => 
               prev ? { ...prev, mediaIndex: (prev.mediaIndex === prev.items.length - 1 ? 0 : prev.mediaIndex + 1) } : null
            );
          } else {
            setFullscreenMedia((prev) => 
               prev ? { ...prev, mediaIndex: (prev.mediaIndex === 0 ? prev.items.length - 1 : prev.mediaIndex - 1) } : null
            );
          }
        }
      }
    };

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
    
    // --- DASHBOARD REALTIME DATA ---
    const [chartData, setChartData] = useState([
       { id: 'mon', name: 'Mon', value: 40, previous: 30 },
       { id: 'tue', name: 'Tue', value: 70, previous: 50 },
       { id: 'wed', name: 'Wed', value: 45, previous: 60 },
       { id: 'thu', name: 'Thu', value: 90, previous: 40 },
       { id: 'fri', name: 'Fri', value: 65, previous: 70 },
       { id: 'sat', name: 'Sat', value: 80, previous: 55 },
       { id: 'sun', name: 'Sun', value: 100, previous: 85 },
    ]);

    const auditLogs = db.auditLogs;

    useEffect(() => {
        if (!liveMode) return;
        
        // Jitter chart data slightly to simulate real-time analytics
        const chartInterval = setInterval(() => {
            setChartData(prev => {
                const newData = [...prev];
                const lastIndex = newData.length - 1;
                const jitter = Math.floor(Math.random() * 11) - 5; // -5 to +5
                let newValue = newData[lastIndex].value + jitter;
                if (newValue < 20) newValue = 20;
                if (newValue > 150) newValue = 150;
                newData[lastIndex] = { ...newData[lastIndex], value: newValue };
                return newData;
            });
        }, 3000);

        // Add an audit log occasionally
        const systemLogEvents = [
           'New API key generated by Alice.',
           'Failed login attempt detected from IP 192.168.1.5',
           'System scaled up instances due to high traffic.',
           'Payment gateway webhook received: successful charge.',
           'User preference schema updated.'
        ];
        
        const logInterval = setInterval(() => {
             if (Math.random() > 0.6) {
                const msg = systemLogEvents[Math.floor(Math.random() * systemLogEvents.length)];
                db.addAuditLog({ id: Date.now(), text: msg, time: 'Just now' });
             }
        }, 8000);

        return () => {
            clearInterval(chartInterval);
            clearInterval(logInterval);
        };
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
    const [integrations, setIntegrations] = useState<Record<string, boolean>>({ slack: true, trello: false, github: true });
    const [dismissedFlags, setDismissedFlags] = useState<Record<number, boolean>>({});
    
    // --- SPLASH AD SETTINGS ---
    const [splashAdUrl, setSplashAdUrl] = useState(db.settings.splashAdUrl || '');
    const [splashAdDuration, setSplashAdDuration] = useState(db.settings.splashAdDuration || 2);
    const [splashAdEnabled, setSplashAdEnabled] = useState(db.settings.splashAdEnabled || false);

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
    const flags = [
        { id: 1, text: 'Review requested on post "p_9842"', reason: 'Community Guidelines Violation', user: 5 },
        { id: 2, text: 'Suspicious login activity reported', reason: 'Unusual IP location', user: 2 }
    ];
    const activeFlags = flags.filter(f => !dismissedFlags[f.id]);

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
                    <h1 className="text-3xl font-serif italic font-black flex items-center gap-3">
                        <span className="vibe-gradient-text">Collab Workspace</span>
                        {liveMode && (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-green-500 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20 shadow-sm animate-pulse">
                                <Circle className="w-2 h-2 fill-green-500" /> Live
                            </span>
                        )}
                    </h1>
                    <p className="text-muted-foreground mt-1 font-medium text-sm">Advanced project management & analytics dashboard</p>
                </div>
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

            {/* Tabs Navigation */}
            <div className="sticky top-0 z-30 bg-white dark:bg-zinc-900 pb-4 pt-4 -mx-4 px-4 md:-mx-8 md:px-8 mb-4 border-b border-border/50">
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 pt-1 -mx-1 px-1 snap-x scroll-smooth">
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
                {/* Fade edges to indicate scrolling */}
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
                            <div className="text-3xl font-black mb-1">12</div>
                            <div className="text-sm font-medium text-muted-foreground">Active Projects</div>
                        </div>
                        <div className="p-6 border border-border rounded-2xl bg-card shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-green-500/10 text-green-500 rounded-xl"><ShieldCheck className="w-6 h-6" /></div>
                            </div>
                            <div className="text-3xl font-black mb-1 text-green-500">100%</div>
                            <div className="text-sm font-medium text-muted-foreground">Data Encrypted</div>
                        </div>
                        <div className="p-6 border border-border rounded-2xl bg-card shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl"><Users className="w-6 h-6" /></div>
                            </div>
                            <div className="text-3xl font-black mb-1">24</div>
                            <div className="text-sm font-medium text-muted-foreground">Team Active</div>
                            <div className="flex items-center gap-[-8px] mt-2">
                                {USERS.slice(0, 5).map(u => (
                                    <img key={u.id} src={u.avatarUrl || undefined} className="w-6 h-6 rounded-full border-2 border-background object-cover" alt="team" onError={handleAvatarError} />
                                ))}
                            </div>
                        </div>
                        <div className="p-6 border border-border rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 text-card-foreground shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-orange-500/20 text-orange-500 rounded-xl"><Star className="w-6 h-6 fill-orange-500" /></div>
                            </div>
                            <div className="text-3xl font-black mb-1 text-orange-500">Rank</div>
                            <div className="text-sm font-bold text-foreground">Top 5% Performer</div>
                            <div className="w-full bg-black/10 rounded-full h-1.5 mt-2 overflow-hidden"><div className="bg-orange-500 w-[85%] h-full"></div></div>
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
                                     <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                       <defs>
                                         <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5}/>
                                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.0}/>
                                         </linearGradient>
                                         <linearGradient id="colorPrevious" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.0}/>
                                         </linearGradient>
                                       </defs>
                                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                                       <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 13, fontWeight: 600 }} dy={10} />
                                       <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 13, fontWeight: 600 }} dx={-10} />
                                       <Tooltip 
                                         cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.5 }}
                                         contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '16px', color: 'hsl(var(--foreground))', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', padding: '12px 16px' }}
                                         itemStyle={{ fontWeight: 'bold' }}
                                         labelStyle={{ color: 'hsl(var(--muted-foreground))', fontWeight: 'bold', marginBottom: '8px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                         isAnimationActive={false}
                                       />
                                       <Area type="monotone" isAnimationActive={false} dataKey="previous" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorPrevious)" name="Previous Week" />
                                       <Area type="monotone" isAnimationActive={false} dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" name="This Week" activeDot={{ r: 6, stroke: 'hsl(var(--background))', strokeWidth: 2 }} />
                                    </AreaChart>
                                 </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="border border-border rounded-2xl overflow-hidden bg-card text-card-foreground shadow-sm flex flex-col h-[350px] lg:h-auto max-h-[600px]">
                            <div className="p-5 border-b border-border bg-secondary/20 shrink-0">
                                <h2 className="text-lg font-bold flex items-center gap-2"><Clock className="w-5 h-5 text-accent" /> Audit Trail</h2>
                            </div>
                            <div className="p-5 overflow-y-auto space-y-6 flex-1 no-scrollbar relative">
                                {auditLogs.map((activity, i) => (
                                    <div key={activity.id} className="relative pl-6 animate-in slide-in-from-left-2 fade-in duration-300">
                                        {i !== auditLogs.length - 1 && <div className="absolute left-2 top-2 bottom-[-24px] w-[2px] bg-border" />}
                                        <div className="absolute left-[3px] top-1.5 w-2 h-2 rounded-full bg-primary ring-4 ring-background" />
                                        <p className="text-[13px] font-bold leading-relaxed">{activity.text}</p>
                                        <span className="text-[11px] text-muted-foreground font-medium">{activity.time}</span>
                                    </div>
                                ))}
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
                                    const info = getCollaboratorInfo(user.id);
                                    return (
                                        <div key={user.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0 group">
                                            <div className="flex items-center gap-3.5">
                                                <div className="relative">
                                                    <img 
                                                        src={user.avatarUrl || undefined} 
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
                                          preload="auto"
                                          autoPlay
                                          loop
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
                                            <img src={(USERS.length > 0 ? USERS[task.user % USERS.length]?.avatarUrl : db.currentUser.avatarUrl) || undefined} className="w-8 h-8 rounded-full border-2 border-background object-cover shadow-sm bg-secondary" alt="assignee" onError={handleAvatarError} />
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
                        {filesLocal.filter(f => f.name.toLowerCase().includes(fileQuery.toLowerCase())).length === 0 ? (
                           <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center p-12 border border-dashed border-border rounded-xl text-muted-foreground font-medium">
                               No files match your search criteria.
                           </div>
                        ) : (
                            filesLocal.filter(f => f.name.toLowerCase().includes(fileQuery.toLowerCase())).map((file, i) => (
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
                                        <img src={(USERS.length > 0 ? USERS[file.author % USERS.length]?.avatarUrl : db.currentUser.avatarUrl) || undefined} className="w-4 h-4 rounded-full object-cover" alt="author" onError={handleAvatarError}/>
                                        {file.date} • {file.size}
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
                           {activeFlags.map((flag) => (
                               <div key={flag.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-destructive/20 rounded-xl bg-destructive/5 mb-3 gap-4">
                                  <div className="flex items-center gap-3">
                                    <img src={(USERS.length > 0 ? USERS[flag.user % USERS.length]?.avatarUrl : db.currentUser.avatarUrl) || undefined} className="w-10 h-10 rounded-lg object-cover border border-border" alt="flagged" onError={handleAvatarError} />
                                    <div>
                                       <div className="font-bold text-[14px]">{flag.text}</div>
                                       <div className="text-xs text-destructive flex items-center gap-1 mt-0.5"><Zap className="w-3 h-3"/> Reason: {flag.reason}</div>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 self-end sm:self-auto">
                                     <button onClick={() => setDismissedFlags(prev => ({...prev, [flag.id]: true}))} className="px-3 py-1.5 border border-border rounded-lg hover:bg-secondary text-sm font-bold flex items-center gap-1"><Ban className="w-4 h-4 text-destructive" /> Reject</button>
                                     <button onClick={() => setDismissedFlags(prev => ({...prev, [flag.id]: true}))} className="px-3 py-1.5 border border-border rounded-lg hover:bg-secondary text-sm font-bold flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-500" /> Approve</button>
                                  </div>
                               </div>
                           ))}
                           {activeFlags.length === 0 && (
                             <div className="text-center text-sm font-medium text-muted-foreground py-8 flex flex-col items-center justify-center gap-2">
                               <ShieldCheck className="w-10 h-10 text-green-500 opacity-50" />
                               All clear! No pending moderations.
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
                                           <video src={splashAdUrl} className="w-full h-full object-cover" controls />
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
            {fullscreenMedia && createPortal(
                <div 
                  id="workspace-fs-modal"
                  className="fixed inset-0 z-[250] flex items-center justify-center bg-white dark:bg-zinc-950 pointer-events-auto animate-in fade-in duration-200"
                  onTouchStart={handleFsTouchStart}
                  onTouchMove={handleFsTouchMove}
                  onTouchEnd={handleFsTouchEnd}
                >
                  <button
                    onClick={() => setFullscreenMedia(null)}
                    className="absolute top-4 right-4 z-[260] text-white p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                  >
                    <X className="w-8 h-8 drop-shadow-md" />
                  </button>
                  <div className="w-full h-full flex items-center justify-center p-4 select-none">
                    {(() => {
                      const item = fullscreenMedia.items[fullscreenMedia.mediaIndex];
                      if (!item) return null;
                      if (item.isVideo) {
                        return (
                          <video
                            key={`ws-fs-vid-${fullscreenMedia.mediaIndex}`}
                            src={item.url || undefined}
                            className="max-w-full max-h-full object-contain"
                            controls
                            autoPlay
                            loop
                            playsInline
                            preload="auto"
                          />
                        );
                      } else {
                        return (
                          <img
                            key={`ws-fs-img-${fullscreenMedia.mediaIndex}`}
                            src={item.url || undefined}
                            className="max-w-full max-h-full object-contain pointer-events-none"
                            alt="Fullscreen media"
                            onError={handleMediaError}
                          />
                        );
                      }
                    })()}
                  </div>

                  {/* Navigation controls - Hidden on Mobile / Tablet, Swipes active everywhere */}
                  {fullscreenMedia.items.length > 1 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFullscreenMedia((prev) => 
                            prev ? { ...prev, mediaIndex: (prev.mediaIndex === 0 ? prev.items.length - 1 : prev.mediaIndex - 1) } : null
                          );
                        }}
                        className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 hidden lg:flex items-center justify-center text-white transition-all z-[260] hover:scale-105 active:scale-95"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFullscreenMedia((prev) => 
                            prev ? { ...prev, mediaIndex: (prev.mediaIndex === prev.items.length - 1 ? 0 : prev.mediaIndex + 1) } : null
                          );
                        }}
                        className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 hidden lg:flex items-center justify-center text-white transition-all z-[260] hover:scale-105 active:scale-95"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>

                      {/* Dot indicators */}
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-[260] bg-zinc-900 border border-border px-3 py-1.5 rounded-full shadow-lg">
                        {fullscreenMedia.items.map((_, i) => (
                          <div 
                            key={`ws-fs-dot-${i}`}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${i === fullscreenMedia.mediaIndex ? 'bg-white scale-125' : 'bg-white/30'}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>,
                document.body
             )}
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
