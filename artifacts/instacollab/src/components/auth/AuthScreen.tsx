import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
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
import {
  UniLivesInAppLegalScreen,
  type InAppLegalDoc,
} from '../legal/brand';
import {
  UniLivesPrincessAuthActions,
  UniLivesPrincessAuthLayout,
  UniLivesPrincessAuthPanel,
  UniLivesPrincessForgotForm,
  UniLivesPrincessForgotLayout,
} from './brand';
import {
  hasCompletedOnboardingOnDevice,
  persistLaunchFunnelAfterAuth,
} from '../../lib/splashSession';

function finishAuthLaunch() {
  persistLaunchFunnelAfterAuth();
  db.markSplashSeen();
  db.completeOnboarding();
  db.advanceLaunchProgressAfterLogin(false);
}

export function AuthScreen() {
  const { loginWithGoogle, resetPassword, loginWithEmail, signupWithEmail, userAccounts, selectAccount, removeAccount } = useAuth();
  
  const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'onboarding' | 'trending'>(() => {
    try {
      if (hasCompletedOnboardingOnDevice()) {
        return 'login';
      }
      const hasAccounts = localStorage.getItem('user_accounts');
      if (hasAccounts && JSON.parse(hasAccounts).length > 0) {
        return 'login';
      }
    } catch {
      /* ignore */
    }
    return 'onboarding';
  });
  const [gate, setGate] = useState<'welcome' | 'email'>('welcome');
  const [legalDoc, setLegalDoc] = useState<InAppLegalDoc | null>(null);
  const [agreed, setAgreed] = useState(false);

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

  const authStage =
    mode === 'reset' ? (
      <UniLivesPrincessForgotLayout data-unilives-auth-legacy="">
        <UniLivesPrincessForgotForm
          email={email}
          onEmailChange={setEmail}
          onSubmit={async () => {
            try {
              if (!email) {
                alert('Please enter your email first.');
                return;
              }
              await resetPassword(email);
              alert('Recovery email sent!');
            } catch (e: any) {
              alert(e.message);
            }
          }}
          onBackToSignIn={() => {
            setGate('welcome');
            setMode('login');
          }}
        />
      </UniLivesPrincessForgotLayout>
    ) : (
    <UniLivesPrincessAuthLayout
      data-unilives-auth-legacy=""
      showPanel={gate === 'email'}
      panel={
        gate === 'email' ? (
          <UniLivesPrincessAuthPanel
            title={mode === 'login' ? 'Welcome Back' : 'Create account'}
            subtitle={
              mode === 'login' ? 'Please sign in to continue' : 'Join UniLive’s and set up your profile.'
            }
            mode={mode === 'signup' ? 'signup' : 'login'}
            onBackToWelcome={() => {
              setGate('welcome');
              setMode('login');
            }}
            backLabel="Back to welcome"
          >
            <div className="flex flex-col gap-3 w-full mb-1">
              {mode === 'signup' && (
                <label className="upa-field">
                  <span className="upa-field-label">Full name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="upa-input"
                    placeholder="Jane Doe"
                  />
                </label>
              )}
              <label className="upa-field">
                <span className="upa-field-label">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="upa-input"
                  placeholder="name@example.com"
                />
              </label>
              <label className="upa-field">
                <span className="upa-field-label">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="upa-input"
                  placeholder="••••••••"
                />
              </label>

              <button
                type="button"
                onClick={async () => {
                  try {
                    if (!agreed) {
                      alert('Please agree to the Terms and Privacy Policy first.');
                      setGate('welcome');
                      return;
                    }
                    if (mode === 'login') {
                      if (!email || !password) {
                        alert('Please fill in all fields.');
                        return;
                      }
                      await loginWithEmail(email, password);
                      finishAuthLaunch();
                    } else if (mode === 'signup') {
                      if (!email || !password || !name) {
                        alert('Please fill in all fields.');
                        return;
                      }
                      await signupWithEmail(email, password, name);
                      finishAuthLaunch();
                    }
                  } catch (e: any) {
                    alert(e.message);
                  }
                }}
                className="upa-cta"
                disabled={!agreed}
              >
                {mode === 'login' ? 'Sign In' : 'Sign up'}
              </button>
            </div>

            {userAccounts.length > 0 && mode === 'login' && (
              <div className="mb-1 space-y-2">
                <span className="upa-field-label">Recent accounts</span>
                <div className="space-y-2">
                  {userAccounts.map((acc: any, idx: number) => (
                    <div
                      key={`${acc.uid || idx}-${idx}`}
                      className="w-full p-3 rounded-xl bg-white/10 border border-[rgba(212,175,55,0.35)] flex items-center justify-between gap-3 hover:bg-white/15 transition-all cursor-pointer group"
                      onClick={() => selectAccount(acc.uid)}
                    >
                      <div className="flex items-center gap-3 overflow-hidden flex-1">
                        <img src={acc.photoURL || undefined} alt="" className="w-8 h-8 rounded-full border border-white/20" />
                        <div className="flex-1 truncate">
                          <div className="font-bold text-sm text-white">{acc.displayName}</div>
                          <div className="text-[10px] text-white/60">{acc.email}</div>
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
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-white/60 hover:text-destructive transition-colors"
                          title="Remove Account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-white/50" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="upa-foot">
              <p>
                {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                <button
                  type="button"
                  onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                  className="upa-link"
                >
                  {mode === 'login' ? 'Sign Up' : 'Sign In'}
                </button>
              </p>
            </div>
          </UniLivesPrincessAuthPanel>
        ) : null
      }
    >
      {gate === 'welcome' ? (
        <UniLivesPrincessAuthActions
          agreed={agreed}
          onToggleAgree={() => setAgreed((v) => !v)}
          onNeedAgree={() => alert('Please agree to the Terms and Privacy Policy first.')}
          onGoogle={async () => {
            try {
              if (!agreed) {
                alert('Please agree to the Terms and Privacy Policy first.');
                return;
              }
              const result = await loginWithGoogle();
              if (!result?.ok) {
                if (result?.reason) alert(result.reason);
                return;
              }
              if (result.redirecting) return;
              finishAuthLaunch();
            } catch (e: unknown) {
              console.error(e);
            }
          }}
          onEmailSignup={() => {
            if (!agreed) {
              alert('Please agree to the Terms and Privacy Policy first.');
              return;
            }
            setMode('signup');
            setGate('email');
          }}
          onForgotPassword={() => {
            setMode('reset');
            setGate('email');
          }}
          onOpenTerms={() => setLegalDoc('terms')}
          onOpenPrivacy={() => setLegalDoc('privacy')}
        />
      ) : null}
    </UniLivesPrincessAuthLayout>
  );

  return (
    <>
      {authStage}
      {legalDoc ? (
        <UniLivesInAppLegalScreen
          kind={legalDoc}
          onBack={() => setLegalDoc(null)}
          backLabel="Back to welcome"
        />
      ) : null}
    </>
  );
}
