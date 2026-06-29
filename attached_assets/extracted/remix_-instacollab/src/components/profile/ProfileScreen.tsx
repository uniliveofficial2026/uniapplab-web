import React, { useState } from 'react';
import { useDB } from '../../lib/useDB';
import { Settings, Grid, PlaySquare, Bookmark, UserSquare, Heart, MessageCircle, Shield, Download, Moon, Sun, Award, Zap, Bell, Palette, Database, ArrowLeft, MoreHorizontal, Send, Share, Link, CheckCircle2, Copy, X, LogOut, UserPlus, Trash2, CheckCircle } from 'lucide-react';
import { Post } from '../feed/Post';
import { useToast } from '../../lib/ToastContext';
import { Avatar } from '../common/Avatar';
import { useAuth } from '../../lib/AuthContext';
import { getFirestoreDB, handleFirestoreError, OperationType } from '../../lib/firebase';
import { addDoc, collection } from 'firebase/firestore';

import { PostModal } from '../feed/PostModal';
import { handleAvatarError, handleMediaError, fileToBase64 } from '../../lib/utils';

export function ProfileScreen({ userId, onBack }: { userId?: string; onBack?: () => void }) {
  const db = useDB();
  const { logout, switchAccount, deleteAccount, profile: authProfile, setProfile, userAccounts, selectAccount, removeAccount } = useAuth();
  const currentUser = authProfile || db.currentUser;
  const POSTS = db.posts;
  const { showToast } = useToast();
  
  const targetUser = userId ? (db.users.find(u => u.id === userId) || currentUser) : currentUser;
  const isCurrentUser = !!(targetUser && currentUser && targetUser.id === currentUser.id);
  
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved' | 'tagged'>('posts');
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const commentInputRef = React.useRef<HTMLInputElement>(null);
  
  const [localUser, setLocalUser] = useState(targetUser);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);

  React.useEffect(() => {
    setLocalUser(targetUser);
    setEditingUsername(targetUser?.username || '');
  }, [targetUser]);
  const [editingUsername, setEditingUsername] = useState(targetUser?.username || '');
  const [storageStats, setStorageStats] = useState(db.getStorageStats());
  const [settings, setSettings] = useState(db.settings);

  const updateUserProfile = async (fieldUpdates: any) => {
    const updatedUser = { ...localUser, ...fieldUpdates, updatedAt: new Date().toISOString() };
    setLocalUser(updatedUser);
    
    // 1. Update local DB
    db.updateUser(localUser.id, () => updatedUser);
    
    // 2. Update AuthContext profile state (only if it matches logged-in user)
    if (isCurrentUser) {
      setProfile(updatedUser);
      // 3. Save to localStorage backup
      try {
        localStorage.setItem('local_profile_' + localUser.id, JSON.stringify(updatedUser));
      } catch (e) {
        console.warn("Storage quota exceeded or error occurred while updating profile in localStorage:", e);
      }
    }
    
    // 4. Update Firestore in the background
    try {
      const dbInstance = getFirestoreDB();
      if (dbInstance) {
        const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
        await setDoc(doc(dbInstance, 'users', localUser.id), {
          ...updatedUser,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (error) {
      console.warn("Background Firestore profile sync failed:", error);
    }
  };
  
  const handleSaveUsername = () => {
       if (!editingUsername.trim()) {
           showToast('User ID cannot be empty');
           return;
       }
       if (editingUsername === localUser.username) return;

       const lastChange = localUser.lastUsernameChange ? new Date(localUser.lastUsernameChange).getTime() : 0;
       const now = new Date().getTime();
       const daysSinceChange = (now - lastChange) / (1000 * 3600 * 24);
       if (daysSinceChange < 7) {
         showToast(`You can only change your User ID once every 7 days.`);
         setEditingUsername(localUser.username); // revert
         return;
       }
       
       const isoNow = new Date().toISOString();
       updateUserProfile({ username: editingUsername, lastUsernameChange: isoNow });
       showToast('User ID updated successfully!');
  };
  
  const handleClearCache = () => {
    if (window.confirm('Are you sure you want to clear all cached data? Your login will be preserved but messages, posts, and notifications will be reset to defaults.')) {
      db.clearCache();
      setStorageStats(db.getStorageStats());
      setSettings(db.settings);
      showToast('Cache cleared successfully');
    }
  };

  const updateSetting = (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    db.updateSettings({ [key]: value });
    
    if (key === 'theme') {
      if (value === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      updateUserProfile({ theme: value });
    }
  };

  const userPosts = POSTS.filter(p => p.user?.id === localUser.id);
  const selectedPost = POSTS.find(p => p.id === selectedPostId);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const newAvatarUrl = await fileToBase64(file);
        await updateUserProfile({ avatarUrl: newAvatarUrl });
        showToast('Avatar updated successfully!');
      } catch (err) {
        showToast('Error updating avatar');
      }
    }
  };

  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [collections, setCollections] = useState(['Design Inspo', 'Moodboard']);

  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationReason, setVerificationReason] = useState('');
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);

  const handleRequestVerification = async () => {
    if (!verificationReason.trim()) return;
    const firestoreDB = getFirestoreDB();
    if (!firestoreDB) {
      showToast('Firebase is not configured');
      return;
    }
    
    setIsSubmittingVerification(true);
    const requestsRef = collection(firestoreDB, 'verification_requests');
    try {
      await addDoc(requestsRef, {
        userId: currentUser?.uid || localUser.id,
        status: 'pending',
        reason: verificationReason,
        createdAt: new Date().toISOString()
      });
      setShowVerificationModal(false);
      setVerificationReason('');
      showToast('Verification request submitted successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'verification_requests');
      showToast('Failed to submit verification request.');
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  const handleCreateCollection = () => {
      if (!newCollectionName.trim()) return;
      setCollections(prev => [...prev, newCollectionName]);
      setNewCollectionName('');
      setShowNewCollectionModal(false);
      showToast('Collection created!');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://instacollab.app/p/${selectedPost?.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedPostId) return;
    db.addPostComment(selectedPostId, {
      username: currentUser.username, 
      text: commentText, 
      avatarUrl: currentUser.avatarUrl
    });
    setCommentText('');
  };

  return (
    <div className="w-full max-w-[935px] mx-auto pt-8 px-4 flex flex-col min-h-0 pb-6">
      
      {/* Post Modal View */}
      {showNewCollectionModal && (
        <div className="fixed inset-0 bg-background z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setShowNewCollectionModal(false)}></div>
          <div className="bg-card border border-border w-full max-w-sm rounded-[24px] shadow-xl p-6 relative">
            <button onClick={() => setShowNewCollectionModal(false)} className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground"><X className="w-5 h-5"/></button>
            <h3 className="font-bold text-lg mb-4">New Collection</h3>
            <div className="mb-4">
               <input 
                 autoFocus
                 type="text" 
                 value={newCollectionName}
                 onChange={e => setNewCollectionName(e.target.value)}
                 className="w-full bg-secondary outline-none px-4 py-3 rounded-xl text-sm font-medium" 
                 placeholder="Collection Name" 
               />
            </div>
            <button 
              onClick={handleCreateCollection} 
              disabled={!newCollectionName.trim()}
              className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:bg-primary/90 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {selectedPostId && (
        <PostModal postId={selectedPostId} onClose={() => setSelectedPostId(null)} />
      )}

      {/* Edit Profile Modal */}
      {showArchive && (
        <div id="archive-modal" className="fixed inset-0 z-[200] flex items-center justify-center bg-background">
          <div className="absolute inset-0" onClick={() => setShowArchive(false)}></div>
          <div className="bg-card w-full max-w-2xl rounded-3xl border border-border shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-y-auto no-scrollbar relative z-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Post Archive</h2>
              <button onClick={() => setShowArchive(false)} className="text-muted-foreground hover:text-foreground"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full border-2 border-muted flex items-center justify-center mb-6 text-muted-foreground">
                <Bookmark className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black mb-2 opacity-80">No archived posts</h3>
              <p className="text-muted-foreground font-medium max-w-sm leading-relaxed text-sm">When you archive posts, they will appear here. Only you can see them.</p>
            </div>
          </div>
        </div>
      )}

      {showVerificationModal && (
        <div id="verification-modal" className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => !isSubmittingVerification && setShowVerificationModal(false)}></div>
          <div className="bg-card w-full max-w-sm rounded-[32px] border border-border shadow-2xl p-8 relative z-10 flex flex-col">
            <div className="flex justify-center mb-6">
               <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <CheckCircle className="w-8 h-8" />
               </div>
            </div>
            <h2 className="text-2xl font-black text-center mb-2">Request Verification</h2>
            <p className="text-center text-muted-foreground text-sm font-medium mb-6">
              Verified badges confirm that an account is the authentic presence of the public figure, celebrity, or global brand it represents.
            </p>
            <div className="space-y-4 mb-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Reason for verification</label>
                <textarea 
                  value={verificationReason} 
                  onChange={e => setVerificationReason(e.target.value)} 
                  disabled={isSubmittingVerification}
                  placeholder="Explain why your account should be verified..."
                  className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary h-24 resize-none" 
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleRequestVerification}
                disabled={isSubmittingVerification || !verificationReason.trim()}
                className="w-full py-3.5 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmittingVerification ? 'Submitting...' : 'Submit Request'}
              </button>
              <button 
                onClick={() => !isSubmittingVerification && setShowVerificationModal(false)}
                className="w-full py-3.5 bg-secondary text-foreground font-bold rounded-xl hover:bg-secondary/80 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditProfile && (
        <div id="edit-profile-modal" className="fixed inset-0 z-[200] flex items-center justify-center bg-background">
          <div className="absolute inset-0" onClick={() => setShowEditProfile(false)}></div>
          <div className="bg-card w-full max-w-md rounded-3xl border border-border shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-y-auto no-scrollbar relative z-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Settings & Privacy</h2>
              <button onClick={() => setShowEditProfile(false)} className="text-muted-foreground hover:text-foreground"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <img src={localUser.avatarUrl || undefined} className="w-16 h-16 rounded-full object-cover border border-border" alt="avatar" onError={handleAvatarError} />
                <button onClick={() => fileInputRef.current?.click()} className="text-primary font-bold text-sm hover:underline">Change Profile Photo</button>
                <input type="file" ref={fileInputRef} onChange={handleAvatarChange} accept="image/*" className="hidden" />
              </div>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-sm font-bold text-muted-foreground">
                    <label>User ID</label>
                    <span className="text-xs font-medium">Once per 7 days</span>
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={editingUsername} onChange={e => {
                        setEditingUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''));
                    }} className="flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full" />
                    {editingUsername !== localUser.username && (
                      <button onClick={handleSaveUsername} className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 text-sm whitespace-nowrap">
                        Save
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-muted-foreground">Name</label>
                  <input type="text" value={localUser.displayName || ''} onChange={e => {
                      const newName = e.target.value;
                      setLocalUser(prev => ({...prev, displayName: newName}));
                      setProfile(prev => ({...prev, displayName: newName}));
                      db.updateUser(localUser.id, u => ({...u, displayName: newName}));
                  }} onBlur={() => {
                      updateUserProfile({ displayName: localUser.displayName });
                  }} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-muted-foreground">Bio</label>
                  <textarea value={localUser.bio || ''} onChange={e => {
                      const newBio = e.target.value;
                      setLocalUser(prev => ({...prev, bio: newBio}));
                      setProfile(prev => ({...prev, bio: newBio}));
                      db.updateUser(localUser.id, u => ({...u, bio: newBio}));
                  }} onBlur={() => {
                      updateUserProfile({ bio: localUser.bio });
                  }} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary h-20 resize-none" />
                </div>
              </div>

              <div className="pt-4 border-t border-border space-y-4">
                <h3 className="font-bold flex items-center gap-2"><Settings className="w-5 h-5 text-primary" /> App Preferences</h3>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold flex items-center gap-2"><Bell className="w-4 h-4 text-muted-foreground" /> Push Notifications</span>
                  <button onClick={() => updateSetting('notificationsEnabled', !settings.notificationsEnabled)} className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.notificationsEnabled ? 'bg-green-500' : 'bg-secondary'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.notificationsEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold flex items-center gap-2"><Palette className="w-4 h-4 text-muted-foreground" /> App Theme</span>
                  <select 
                    value={settings.theme === 'dark' ? 'Vibrant Dark' : 'Minimalist Light'} 
                    onChange={(e) => updateSetting('theme', e.target.value === 'Vibrant Dark' ? 'dark' : 'light')}
                    className="bg-secondary text-sm font-semibold rounded-lg px-2 py-1 outline-none border border-border"
                  >
                    <option>Vibrant Dark</option>
                    <option>Minimalist Light</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-border space-y-4">
                <h3 className="font-bold flex items-center gap-2"><Shield className="w-5 h-5 text-accent" /> Privacy & Security</h3>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Private Account</span>
                  <button onClick={() => updateSetting('isPrivate', !settings.isPrivate)} className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.isPrivate ? 'bg-green-500' : 'bg-secondary'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.isPrivate ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Language & Region</span>
                  <select 
                    value={settings.language} 
                    onChange={(e) => {
                       updateSetting('language', e.target.value);
                       const select = document.querySelector('.goog-te-combo') as HTMLSelectElement;
                       if (select) {
                         select.value = e.target.value;
                         select.dispatchEvent(new Event('change'));
                       }
                    }}
                    className="bg-secondary text-sm font-semibold rounded-lg px-2 py-1 outline-none border border-border"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="ja">Japanese</option>
                    <option value="zh-CN">Chinese</option>
                  </select>
                </div>
                
                <button
                  onClick={() => setShowVerificationModal(true)}
                  className="flex items-center justify-between w-full font-semibold text-sm text-foreground hover:text-primary transition-colors pt-2"
                >
                  <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-blue-500" /> Request Verification</span>
                  <ArrowLeft className="w-4 h-4 rotate-180 text-muted-foreground" />
                </button>
                
                <button onClick={() => { updateSetting('offlineSync', !settings.offlineSync); showToast(settings.offlineSync ? 'Offline Sync Disabled' : 'Offline Sync Enabled'); }} className="flex items-center gap-2 font-semibold text-sm text-foreground hover:text-primary transition-colors pt-2">
                  <Database className={`w-4 h-4 ${settings.offlineSync ? 'text-green-500' : 'text-muted-foreground'}`} /> {settings.offlineSync ? 'Disable Offline Sync' : 'Enable Offline Sync / Data Backup'}
                </button>
                <button 
                  onClick={() => {
                    const data = {
                      user: localUser,
                      settings: db.settings,
                      posts: db.posts.filter(p => p.user?.id === localUser.id),
                      timestamp: new Date().toISOString()
                    };
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `instacollab_activity_${localUser.username}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast('Activity report generated and downloaded');
                  }}
                  className="flex items-center gap-2 font-semibold text-sm text-foreground hover:text-primary transition-colors"
                >
                  <Download className="w-4 h-4 text-muted-foreground" /> Download Activity & Reports
                </button>
              </div>

              <div className="pt-4 border-t border-border space-y-4">
                <h3 className="font-bold flex items-center gap-2"><Database className="w-5 h-5 text-indigo-500" /> Storage & Data Store</h3>
                
                <div className="space-y-2">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">Storage Plan Control</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['50GB', '100GB', 'Unlimited'].map((tier) => (
                      <button
                        key={tier}
                        onClick={() => {
                          updateUserProfile({ storageTier: tier });
                          showToast(`Storage plan updated to ${tier}`);
                        }}
                        className={`py-3 px-2 rounded-xl border text-xs font-black transition-all ${
                          (localUser.storageTier || '50GB') === tier 
                            ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]' 
                            : 'bg-secondary/50 border-border text-muted-foreground hover:border-primary/50'
                        }`}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground px-1 leading-tight">
                    Switching to <b>Unlimited</b> removes all local caching caps and enables full-res multimedia sync.
                  </p>
                </div>

                <div className="bg-secondary/30 rounded-xl p-4 border border-border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold">Active Usage Meter</span>
                    <span className="text-xs font-mono bg-secondary px-2 py-1 rounded">{storageStats.size}</span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden mb-2">
                    <div 
                      className="h-full bg-primary transition-all duration-1000" 
                      style={{ 
                        width: `${Math.min(100, (storageStats.rawSize / ((localUser.storageTier === 'Unlimited' ? 1000 : (localUser.storageTier === '100GB' ? 100 : 50)) * 1024 * 1024 * 1024)) * 100)}%` 
                      }} 
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">Cached Item Count</span>
                    <span className="text-xs font-mono bg-secondary px-2 py-1 rounded">{storageStats.items}</span>
                  </div>
                </div>
                
                  <button 
                    onClick={async () => {
                      if (window.confirm('Are you sure you want to permanently delete your account? This action cannot be undone.')) {
                        await deleteAccount();
                        showToast('Account permanently deleted');
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold rounded-xl transition-colors border border-red-500/20"
                  >
                    <Trash2 className="w-4 h-4" /> Permanent Account Deletion
                  </button>

                  <button 
                    onClick={() => {
                      if (window.confirm('Clear all local cache? System stability will be maintained.')) {
                        db.clearCache();
                        setStorageStats(db.getStorageStats());
                        showToast('Cache purged');
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-secondary text-foreground font-bold rounded-xl transition-colors border border-border"
                  >
                    <X className="w-4 h-4" /> Clear Cache & Purge Data
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-border space-y-3">
                <button 
                  onClick={logout}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-secondary text-foreground font-bold rounded-xl hover:bg-secondary/80 transition-colors"
                >
                  <LogOut className="w-5 h-5 text-red-500" /> Log Out
                </button>
                <button 
                  onClick={() => setShowAccountSwitcher(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-secondary text-foreground font-bold rounded-xl hover:bg-secondary/80 transition-colors"
                >
                  <UserPlus className="w-5 h-5 text-primary" /> Add or Switch Account
                </button>
              </div>

              <button 
                onClick={() => { setShowEditProfile(false); showToast('Preferences Saved'); }} 
                className="mt-8 w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}

      {onBack && (
        <button 
          onClick={onBack} 
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-semibold text-sm mb-6 transition-colors w-fit -mt-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      )}

      {/* Profile Header */}
      <div className="flex flex-col md:flex-row mb-12 gap-8 md:gap-24 items-center md:items-start max-w-[800px] w-full mx-auto">
        <div 
          className={`w-[150px] h-[150px] rounded-full overflow-hidden shrink-0 relative ${isCurrentUser ? 'group cursor-pointer' : ''}`} 
          onClick={isCurrentUser ? () => fileInputRef.current?.click() : undefined}
        >
          <Avatar user={localUser} size="lg" className="w-full h-full" />
          {isCurrentUser && (
            <div className="absolute inset-0 bg-black/50 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-bold">UPDATE</div>
          )}
        </div>
        
        <div className="flex flex-col items-center md:items-start text-center md:text-left flex-1">
          
          <div className="flex flex-col md:flex-row items-center gap-4 mb-5">
            <h1 className="text-[20px] font-normal">{localUser.username}</h1>
            <div className="flex items-center gap-2">
              {isCurrentUser ? (
                <>
                  <button onClick={() => setShowEditProfile(true)} className="bg-secondary hover:bg-secondary/80 text-foreground px-4 py-1.5 rounded-lg text-[14px] font-semibold transition-colors">
                    Edit profile
                  </button>
                  <button 
                    onClick={() => setShowArchive(true)}
                    className="bg-secondary hover:bg-secondary/80 text-foreground px-4 py-1.5 rounded-lg text-[14px] font-semibold transition-colors">
                    View archive
                  </button>
                  <button onClick={() => setShowEditProfile(true)} className="p-1 hover:opacity-70"><Settings className="w-6 h-6" /></button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => {
                      db.updateUser(localUser.id, (u: any) => ({ ...u, isFollowing: !u.isFollowing }));
                      setLocalUser(prev => ({ ...prev, isFollowing: !prev.isFollowing }));
                    }} 
                    className={`px-6 py-1.5 rounded-lg text-[14px] font-bold transition-colors ${
                      localUser.isFollowing 
                        ? 'bg-secondary hover:bg-secondary/80 text-foreground border border-border' 
                        : 'bg-primary hover:bg-primary/95 text-primary-foreground'
                    }`}
                  >
                    {localUser.isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button 
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'messages', chatId: localUser.id } }));
                    }}
                    className="bg-secondary hover:bg-secondary/80 text-foreground px-6 py-1.5 rounded-lg text-[14px] font-bold transition-colors border border-border"
                  >
                    Message
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-8 mb-4">
            <div><span className="font-bold">{userPosts.length}</span> posts</div>
            <div className="cursor-pointer hover:opacity-70"><span className="font-bold">{localUser.followers}</span> followers</div>
            <div className="cursor-pointer hover:opacity-70"><span className="font-bold">{localUser.following}</span> following</div>
          </div>

          <div className="flex items-center gap-3 mb-4 bg-secondary/30 px-3 py-1.5 rounded-xl border border-border inline-flex">
             <div className="flex items-center gap-1 text-xs font-bold text-orange-500"><Zap className="w-4 h-4 fill-orange-500" /> Lvl 24 Creator</div>
             <div className="w-px h-4 bg-border"></div>
             <div className="flex items-center gap-1 text-xs font-bold text-accent"><Award className="w-4 h-4" /> 14,200 XP</div>
          </div>

          <div className="flex flex-col mb-4 items-center md:items-start">
            <span className="font-semibold text-[14px] flex items-center gap-2">
              {localUser.displayName}
            </span>
            <span className="text-[14px] whitespace-pre-wrap mt-1 leading-relaxed">{localUser.bio}</span>
          </div>

        </div>
      </div>

      {/* Tabs */}
      <div className="border-t border-border flex justify-center gap-12 text-[12px] font-bold text-muted-foreground uppercase tracking-widest h-[52px]">
         <div onClick={() => setActiveTab('posts')} className={`flex items-center gap-2 h-full cursor-pointer transition-colors ${activeTab === 'posts' ? 'border-t-2 border-foreground text-foreground' : 'hover:text-foreground'}`}>
             <Grid className="w-4 h-4" /> POSTS
         </div>
         <div onClick={() => setActiveTab('reels')} className={`flex items-center gap-2 h-full cursor-pointer transition-colors hidden sm:flex ${activeTab === 'reels' ? 'border-t-2 border-foreground text-foreground' : 'hover:text-foreground'}`}>
             <PlaySquare className="w-4 h-4" /> REELS
         </div>
         {isCurrentUser && (
           <div onClick={() => setActiveTab('saved')} className={`flex items-center gap-2 h-full cursor-pointer transition-colors hidden sm:flex ${activeTab === 'saved' ? 'border-t-2 border-foreground text-foreground' : 'hover:text-foreground'}`}>
               <Bookmark className="w-4 h-4" /> SAVED
           </div>
         )}
         <div onClick={() => setActiveTab('tagged')} className={`flex items-center gap-2 h-full cursor-pointer transition-colors hidden sm:flex ${activeTab === 'tagged' ? 'border-t-2 border-foreground text-foreground' : 'hover:text-foreground'}`}>
             <UserSquare className="w-4 h-4" /> TAGGED
         </div>
      </div>

      {/* Grid */}
      {activeTab === 'posts' && (
        <div className="grid grid-cols-3 gap-1 md:gap-4 lg:gap-8">
          {userPosts.map(post => (
            <div key={post.id} onClick={() => setSelectedPostId(post.id)} className="aspect-square bg-secondary group cursor-pointer relative rounded-xl overflow-hidden shadow-sm">
              <img src={post.imageUrl || undefined} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" alt="Post" onError={handleMediaError} />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-4 backdrop-blur-[2px]">
                <div className="flex items-center gap-1 font-bold"><Heart className="w-5 h-5 fill-white" /> {post?.likes || 0}</div>
                <div className="flex items-center gap-1 font-bold"><MessageCircle className="w-5 h-5 fill-white" /> {post?.comments || 0}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'saved' && (
        <div className="pt-8 text-center px-4">
          <p className="text-muted-foreground mb-4 font-medium text-sm">Only you can see what you've saved.</p>
          <div className="grid grid-cols-3 gap-1 md:gap-4 lg:gap-8">
            {db.posts.filter((p: any) => p.isSaved).map((post: any) => (
              <div key={post.id} onClick={() => setSelectedPostId(post.id)} className="aspect-square bg-secondary group cursor-pointer relative rounded-xl overflow-hidden shadow-sm">
                <img src={post.imageUrl || undefined} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" alt="Post" onError={handleMediaError} />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-4 backdrop-blur-[2px]">
                  <div className="flex items-center gap-1 font-bold"><Heart className="w-5 h-5 fill-white" /> {post?.likes || 0}</div>
                  <div className="flex items-center gap-1 font-bold"><MessageCircle className="w-5 h-5 fill-white" /> {post?.comments || 0}</div>
                </div>
              </div>
            ))}
            {db.posts.filter((p: any) => p.isSaved).length === 0 && (
              <div className="col-span-3 py-20 text-center text-muted-foreground font-medium">No saved posts yet</div>
            )}
          </div>
        </div>
      )}

      {(activeTab === 'reels' || activeTab === 'tagged') && (
        <div className="pt-20 flex flex-col items-center justify-center text-center">
           <div className="w-20 h-20 rounded-full border-2 border-muted flex items-center justify-center mb-6 text-muted-foreground">
              {activeTab === 'reels' ? <PlaySquare className="w-8 h-8" /> : <UserSquare className="w-8 h-8" />}
           </div>
           <h2 className="text-2xl font-black mb-2 opacity-80">Capture your {activeTab}</h2>
           <p className="text-muted-foreground font-medium max-w-xs leading-relaxed">When you share {activeTab}, they will appear on your profile seamlessly.</p>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && selectedPost && (
         <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center pointer-events-none">
           <div className="absolute inset-0 bg-background pointer-events-auto" onClick={() => setShowShareModal(false)}></div>
           <div className="w-full max-w-md bg-card border border-border rounded-t-3xl sm:rounded-3xl p-6 relative z-10 pointer-events-auto shadow-2xl overflow-hidden translate-y-0 opacity-100 transition-all duration-300">
              <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6 sm:hidden"></div>
              <h3 className="text-xl font-bold mb-6 text-center">Share to Messages</h3>
              <div className="flex gap-4 mb-6 overflow-x-auto no-scrollbar pb-2">
                 {db.users.filter(u => u.id !== db.currentUser.id).map(u => (
                    <div key={u.id} onClick={() => { 
                      setShowShareModal(false); 
                      db.addMessage(u.id, { text: `Shared a post: https://instacollab.app/p/${selectedPost.id}`, isAuthor: true });
                    }} className="flex flex-col items-center gap-2 cursor-pointer group min-w-[72px]">
                      <div className="w-14 h-14 rounded-full border border-border group-hover:border-primary transition-colors overflow-hidden bg-card">
                         <img src={u.avatarUrl || undefined} alt={u.username} className="w-full h-full object-cover" onError={handleAvatarError} />
                      </div>
                      <span className="text-xs font-bold text-center truncate w-full px-1">{u.username}</span>
                    </div>
                 ))}
              </div>
              <div className="flex items-center gap-3 p-3 bg-secondary rounded-xl border border-border">
                 <div className="w-10 h-10 rounded-lg bg-card flex items-center justify-center border border-border shrink-0">
                   <Link className="w-5 h-5 text-muted-foreground" />
                 </div>
                 <div className="flex-1 truncate text-sm font-medium text-muted-foreground">https://instacollab.app/p/{selectedPost.id}</div>
                 <button 
                   onClick={handleCopyLink}
                   className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-bold shrink-0 hover:opacity-90 transition-opacity flex items-center gap-2"
                 >
                   {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                 </button>
              </div>
           </div>
         </div>
      )}

      {/* Account Switcher Modal */}
      {showAccountSwitcher && (
        <div className="fixed inset-0 z-[2900] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto animate-in fade-in duration-200" 
            onClick={() => setShowAccountSwitcher(false)} 
          />
          <div className="w-full max-w-md bg-card border border-border rounded-[32px] p-6 relative z-10 pointer-events-auto shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-border mb-4 shrink-0">
              <h3 className="text-lg font-black text-foreground">Add or Switch Account</h3>
              <button 
                onClick={() => setShowAccountSwitcher(false)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
                id="close-account-switcher"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pr-1">
              {userAccounts.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground font-semibold">
                  No other accounts stored on this device.
                </div>
              ) : (
                userAccounts.map((acc: any, idx: number) => {
                  const isActive = acc.uid === currentUser?.uid || acc.uid === currentUser?.id;
                  return (
                    <div 
                      key={`${acc.uid || idx}-${idx}`}
                      onClick={async () => {
                        if (isActive) return;
                        try {
                          showToast(`Switching to ${acc.displayName || 'selected account'}...`);
                          await selectAccount(acc.uid);
                          setShowAccountSwitcher(false);
                        } catch (e) {
                          showToast('Failed to switch account.');
                        }
                      }}
                      className={`w-full p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all cursor-pointer group ${
                        isActive 
                          ? 'bg-primary/5 border-primary/35' 
                          : 'bg-secondary/20 border-border hover:bg-secondary/50'
                      }`}
                      id={`account-item-${acc.uid}`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden flex-1">
                        <img 
                          src={acc.photoURL || undefined} 
                          alt="" 
                          className={`w-10 h-10 rounded-full border object-cover ${isActive ? 'border-primary' : 'border-border'}`} 
                          onError={handleAvatarError}
                        />
                        <div className="flex-1 truncate">
                          <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                            <span className="truncate">{acc.displayName}</span>
                            {isActive && (
                              <span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">{acc.email}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Remove ${acc.displayName || 'this account'} from this device?`)) {
                              removeAccount(acc.uid);
                            }
                          }}
                          className="p-2 rounded-xl bg-destructive/5 hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-all"
                          title="Remove Account"
                          id={`remove-account-${acc.uid}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-4 border-t border-border mt-4 shrink-0 space-y-3">
              <button
                onClick={async () => {
                  try {
                    setShowAccountSwitcher(false);
                    setShowEditProfile(false);
                    await switchAccount();
                  } catch (e) {
                    showToast('Failed to start account linking.');
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-black rounded-xl hover:opacity-95 active:scale-[0.99] transition-all text-sm shadow-md shadow-primary/15"
                id="btn-link-google-account"
              >
                <UserPlus className="w-4 h-4" /> Add / Link New Google Account
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

