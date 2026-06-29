import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Camera, User, AtSign, Globe, Check } from 'lucide-react';
import { LanguageSelector } from '../common/LanguageSelector';
import { useAuth } from '../../lib/AuthContext';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirestoreDB } from '../../lib/firebase';
import { db } from '../../lib/db';

export function ProfileSetup() {
  const { user, setProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState('');
  const [language, setLanguage] = useState('English');
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>(user?.photoURL || '');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size too large (max 5MB)');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    setLoading(true);

    const profileData = {
      id: user.uid,
      username: username.toLowerCase().replace(/\s/g, '').replace(/[^a-z0-9_.]/g, ''),
      displayName: displayName || user.displayName || username,
      email: user.email,
      avatarUrl: avatarUrl || user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`,
      bio,
      language,
      followersCount: 0,
      followingCount: 0,
      isVerified: false,
      theme: 'dark',
      storageTier: '50GB',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 1. Save locally to localStorage
    try {
      localStorage.setItem('local_profile_' + user.uid, JSON.stringify(profileData));
      localStorage.setItem('instacollab_has_onboarded', 'true');
    } catch (e) {
      console.warn("Storage quota exceeded or error occurred while updating profile in localStorage:", e);
    }

    // 2. Synchronize to LocalDB
    const updatedUsers = [...db.users];
    const existsIdx = updatedUsers.findIndex(u => u.id === user.uid);
    if (existsIdx >= 0) {
      updatedUsers[existsIdx] = profileData;
    } else {
      updatedUsers.push(profileData);
    }
    db.save('users', updatedUsers);
    db.login(user.uid);

    // 3. Update active AuthContext state for real-time local load
    setProfile(profileData);

    try {
      // 4. Try Firestore cloud backup
      const firestoreDB = getFirestoreDB();
      if (firestoreDB) {
        await setDoc(doc(firestoreDB, 'users', user.uid), {
          ...profileData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (e: any) {
      console.warn("Firestore save failed; saved locally:", e);
      alert("Note: Profile was saved locally. (Backend sync notice: " + (e.message || e) + ")");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background z-[1100] flex items-center justify-center p-6 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-card border border-border shadow-2xl rounded-[32px] p-8"
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-foreground">Set Up Profile</h2>
          <p className="text-muted-foreground mt-2">Almost there! Tell us about yourself.</p>
        </div>

        <div className="space-y-6">
          <div className="flex justify-center mb-8">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full bg-secondary overflow-hidden border-4 border-background shadow-lg">
                <img src={avatarUrl || undefined} className="w-full h-full object-cover" alt="Avatar" />
              </div>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleAvatarSelect}
                accept="image/*"
                className="hidden"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase ml-2 flex items-center gap-1">
                <AtSign className="w-3 h-3" /> Username
              </label>
              <input 
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-12 bg-secondary/50 rounded-xl border border-border px-4 focus:ring-2 focus:ring-primary outline-none transition-all"
                placeholder="unique_handle"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase ml-2 flex items-center gap-1">
                <User className="w-3 h-3" /> Display Name
              </label>
              <input 
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full h-12 bg-secondary/50 rounded-xl border border-border px-4 focus:ring-2 focus:ring-primary outline-none transition-all"
                placeholder="Full Name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase ml-2 flex items-center gap-1">
                <Globe className="w-3 h-3" /> Language Preference
              </label>
              <LanguageSelector value={language} onChange={setLanguage} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase ml-2">Bio</label>
              <textarea 
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full h-32 bg-secondary/50 rounded-xl border border-border p-4 focus:ring-2 focus:ring-primary outline-none transition-all resize-none"
                placeholder="Tell the world who you are..."
              />
            </div>
          </div>

          <button 
            onClick={handleComplete}
            disabled={loading || !username}
            className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all active:scale-95 shadow-lg shadow-primary/10 mt-4"
          >
            {loading ? 'Finalizing...' : (
              <>Complete Setup <Check className="w-5 h-5" /></>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
