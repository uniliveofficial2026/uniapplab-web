import React, { createContext, useContext, useState, ReactNode, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useOptionalI18n } from './i18n/I18nContext';
import type { TranslatableMessage } from './i18n/types';
import { isTranslatableMessage } from './i18n/serverMessage';
import { shouldSuppressToast } from './toastPolicy';

export type ToastInput = string | TranslatableMessage;

interface ToastContextType {
  showToast: (msg: ToastInput) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

function ToastViewport({ toast }: { toast: TranslatableMessage | null }) {
  const reduceMotion = useReducedMotion();
  const i18n = useOptionalI18n();
  const text = toast
    ? i18n
      ? i18n.translateMessage(toast)
      : toast.translationKey
    : '';
  return (
    <div
      className="pointer-events-none fixed bottom-24 left-1/2 z-[9999] w-max max-w-[min(90vw,22rem)] -translate-x-1/2 px-4"
      aria-live="polite"
    >
      <AnimatePresence>
        {text ? (
          <motion.div
            key={text}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 8 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
            role="status"
            className="pointer-events-auto box-border h-auto max-h-20 w-max max-w-[min(90vw,22rem)] shrink-0 overflow-hidden rounded-[var(--radius-unilives-pill)] bg-[color:var(--color-unilives-text)] px-6 py-3 text-center text-sm font-bold leading-snug text-[color:var(--color-unilives-background)] shadow-[var(--shadow-unilives-lg)]"
          >
            {text}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function toMessage(msg: ToastInput): TranslatableMessage {
  if (isTranslatableMessage(msg)) return msg;
  return { translationKey: '__literal__', params: { text: msg } };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<TranslatableMessage | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: ToastInput) => {
    if (shouldSuppressToast(msg)) return;
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    setToast(toMessage(msg));
    hideTimerRef.current = setTimeout(() => {
      setToast(null);
      hideTimerRef.current = null;
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastViewport toast={toast} />
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
