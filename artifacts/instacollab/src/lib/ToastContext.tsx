import React, { createContext, useContext, useState, ReactNode, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

interface ToastContextType {
  showToast: (msg: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

function ToastViewport({ toastMsg }: { toastMsg: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {toastMsg ? (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: 50, scale: 0.95 }}
          transition={reduceMotion ? { duration: 0 } : undefined}
          role="status"
          aria-live="polite"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] bg-[color:var(--color-unilives-text)] text-[color:var(--color-unilives-background)] px-6 py-3 rounded-[var(--radius-unilives-pill)] font-bold text-sm shadow-[var(--shadow-unilives-lg)]"
        >
          {toastMsg}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toastMsg, setToastMsg] = useState('');
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    setToastMsg(msg);
    hideTimerRef.current = setTimeout(() => {
      setToastMsg('');
      hideTimerRef.current = null;
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastViewport toastMsg={toastMsg} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
