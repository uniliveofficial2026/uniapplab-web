import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  Github, 
  Phone, 
  Globe,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Zap,
  Globe2,
  Trash2,
  LogOut,
  Users,
  Smartphone
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { db } from '../../lib/db/localDb';
import { TrendingScreen } from './TrendingScreen';
import { AppLogo } from '../common/AppLogo';

function finishAuthLaunch() {
  localStorage.setItem('instacollab_has_onboarded', 'true');
  db.markSplashSeen();
  db.completeOnboarding();
  db.advanceLaunchProgressAfterLogin(false);
}

export function AuthScreen() {
  const { loginWithGoogle, loginWithApple, resetPassword, loginWithEmail, signupWithEmail, userAccounts, selectAccount, removeAccount } = useAuth();
  
  const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'onboarding' | 'trending'>(() => {
    const hasOnboarded = localStorage.getItem('instacollab_has_onboarded');
    const hasAccounts = localStorage.getItem('user_accounts');
    try {
      if (hasOnboarded === 'true' || (hasAccounts && JSON.parse(hasAccounts).length > 0)) {
        return 'login';
      }
    } catch (e) {}
    return 'onboarding';
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Trending preview data for onboarding
  const trendingStats = [
    { label: 'Active Creators', value: '12.4k', icon: Users, color: 'text-blue-500' },
    { label: 'Global Projects', value: '45.2k', icon: Globe2, color: 'text-purple-500' },
    { label: 'Daily Interactions', value: '1.2M', icon: Zap, color: 'text-amber-500' },
  ];

  if (mode === 'trending') {
    return <TrendingScreen onContinue={() => setMode('signup')} />;
  }

  if (mode === 'onboarding') {
    return (
    <div className="fixed inset-0 bg-background z-[1000] flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto no-scrollbar pt-20 px-6 pb-12 max-w-lg mx-auto w-full">
          <div className="text-center mb-12">
            <AppLogo className="justify-center mb-4 flex-col" iconClassName="w-16 h-16 text-primary" textClassName="text-4xl font-black tracking-tight" showText={true} />
            <p className="text-muted-foreground text-lg leading-relaxed">
              The world's first AI-powered real-time creative marketplace and social platform.
            </p>
          </div>

          <div className="space-y-4 mb-12">
            {[
              { title: 'Real-time Sync', desc: 'Every interaction reflected across all devices instantly.', icon: Zap },
              { title: 'AI Automation', desc: 'Gemini-powered creative tools at your fingertips.', icon: Sparkles },
              { title: 'Secure Workspace', desc: 'Enterprise-grade security for your private data.', icon: ShieldCheck },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i }}
                className="p-5 rounded-2xl bg-secondary/50 border border-border flex items-start gap-4"
              >
                <div className="w-10 h-10 bg-background rounded-xl flex items-center justify-center shrink-0 border border-border shadow-sm">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div 
            className="p-6 rounded-3xl bg-secondary border border-border text-foreground shadow-xl mb-12"
          >
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
              <LogOut className="w-4 h-4 rotate-180" /> Global Trending
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {trendingStats.map((stat, i) => (
                <div key={i} className="text-center">
                  <div className={`p-2 rounded-lg bg-primary/5 inline-block mb-2 ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div className="text-lg font-black">{stat.value}</div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <button 
              onClick={() => setMode('trending')}
              className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20"
            >
              Get Started <ArrowRight className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setMode('login')}
              className="w-full h-14 bg-secondary text-foreground rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-secondary/80 transition-all active:scale-95"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background z-[1000] flex items-center justify-center p-6">
      <motion.div 
        layout
        className="w-full max-w-md bg-card border border-border shadow-2xl rounded-[32px] overflow-hidden p-8"
      >
        <div className="text-center mb-6">
          <AppLogo className="justify-center mb-4" iconClassName="w-12 h-12 text-primary" showText={false} />
          <h2 className="text-2xl font-black text-foreground">
            {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
          </h2>
          <p className="text-muted-foreground mt-1">
            {mode === 'login' ? 'Please sign in to continue' : mode === 'signup' ? 'Join our global community' : 'Enter your email to reset'}
          </p>
        </div>



        <div className="space-y-4 mb-8">
          {mode !== 'reset' && (
            <>
              {mode === 'signup' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase ml-2">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input 
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-12 bg-secondary/50 rounded-xl border border-border pl-12 pr-4 focus:ring-2 focus:ring-primary outline-none transition-all"
                      placeholder="Jane Doe"
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase ml-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-12 bg-secondary/50 rounded-xl border border-border pl-12 pr-4 focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="name@example.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase ml-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input 
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 bg-secondary/50 rounded-xl border border-border pl-12 pr-4 focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </>
          )}

          {mode === 'login' && (
            <button onClick={() => setMode('reset')} className="text-sm font-bold text-primary hover:underline ml-auto block">
              Forgot password?
            </button>
          )}

          <button 
            onClick={async () => {
              try {
                if (mode === 'reset') {
                  if (!email) { alert('Please enter your email first.'); return; }
                  await resetPassword(email);
                  alert('Recovery email sent!');
                } else if (mode === 'login') {
                  if (!email || !password) { alert('Please fill in all fields.'); return; }
                  await loginWithEmail(email, password);
                  finishAuthLaunch();
                } else if (mode === 'signup') {
                  if (!email || !password || !name) { alert('Please fill in all fields.'); return; }
                  await signupWithEmail(email, password, name);
                  finishAuthLaunch();
                }
              } catch (e: any) {
                alert(e.message);
              }
            }}
            className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-all active:scale-[0.98] shadow-md"
          >
            {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Recovery Email'}
          </button>
        </div>

        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground font-bold">Or continue with</span></div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <button 
            onClick={async () => {
              try {
                const result = await loginWithGoogle();
                if (!result?.ok) return;
                finishAuthLaunch();
              } catch (e: unknown) {
                console.error(e);
              }
            }}
            className="h-12 border border-border rounded-xl flex items-center justify-center gap-2 hover:bg-secondary transition-all active:scale-[0.98]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
            <span className="font-bold text-sm">Google</span>
          </button>
          <button 
            onClick={async () => {
              try {
                await loginWithApple();
              } catch (e: unknown) {
                console.error(e);
              }
            }}
            className="h-12 border border-border rounded-xl flex items-center justify-center gap-2 hover:bg-secondary transition-all active:scale-[0.98]"
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <svg viewBox="0 0 384 512" className="w-4 h-4 fill-current"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-39-19.9-56-44.4-56-92zM289.3 80c19.8-24 10-61.9 10-61.9-20.4 1.3-44.7 14.8-59 31.2-15.6 18.1-23.3 48.4-23.3 48.4 22.9 1.8 49.6-11.8 72.3-37.7z"/></svg>
            </div>
            <span className="font-bold text-sm">Apple</span>
          </button>
        </div>

        {userAccounts.length > 0 && (
          <div className="mb-8 space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase ml-2">Recent Accounts</label>
            <div className="space-y-2">
              {userAccounts.map((acc: any, idx: number) => (
                <div 
                  key={`${acc.uid || idx}-${idx}`}
                  className="w-full p-3 rounded-xl bg-secondary/35 border border-border flex items-center justify-between gap-3 hover:bg-secondary/60 transition-all cursor-pointer group"
                  onClick={() => selectAccount(acc.uid)}
                >
                  <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <img src={acc.photoURL || undefined} alt="" className="w-8 h-8 rounded-full border border-border" />
                    <div className="flex-1 truncate">
                      <div className="font-bold text-sm text-foreground">{acc.displayName}</div>
                      <div className="text-[10px] text-muted-foreground">{acc.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Remove ${acc.displayName || 'this account'} from this device?`)) {
                          removeAccount(acc.uid);
                        }
                      }}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 md:opacity-40"
                      title="Remove Account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {mode === 'login' ? "Don't have an account?" : "Already have an account?"}{' '}
            <button 
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="font-bold text-primary hover:underline"
            >
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
