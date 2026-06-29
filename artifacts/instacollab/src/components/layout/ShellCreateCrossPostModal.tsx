import type { Dispatch, SetStateAction } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus } from 'lucide-react';
import { toggleCrossPostOption, type CrossPostKey } from '../../lib/safe';

export type CrossPostOptions = {
  twitter: boolean;
  facebook: boolean;
  tumblr: boolean;
};

export interface ShellCreateCrossPostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crossPostOptions: CrossPostOptions;
  onCrossPostOptionsChange: Dispatch<SetStateAction<CrossPostOptions>>;
}

export function ShellCreateCrossPostModal({
  open,
  onOpenChange,
  crossPostOptions,
  onCrossPostOptionsChange,
}: ShellCreateCrossPostModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 bg-background z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => onOpenChange(false)}></div>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-background w-full max-w-[400px] rounded-[24px] overflow-hidden shadow-2xl border border-border flex flex-col relative z-10"
          >
            <div className="p-6 border-b border-border flex justify-between items-center bg-secondary/30">
              <h3 className="font-bold text-xl">Cross-Post Setup</h3>
              <button
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 bg-background rounded-full"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {[
                { id: 'twitter', label: 'Twitter (X)' },
                { id: 'facebook', label: 'Facebook Page' },
                { id: 'tumblr', label: 'Tumblr' },
              ].map((platform) => (
                <div key={platform.id} className="flex justify-between items-center py-2">
                  <span className="font-medium">{platform.label}</span>
                  <button
                    onClick={() =>
                      onCrossPostOptionsChange((prev) =>
                        toggleCrossPostOption(prev, platform.id as CrossPostKey)
                      )
                    }
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      crossPostOptions[platform.id as keyof CrossPostOptions]
                        ? 'bg-primary'
                        : 'bg-secondary'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                        crossPostOptions[platform.id as keyof CrossPostOptions]
                          ? 'left-6'
                          : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              ))}
              <button
                onClick={() => onOpenChange(false)}
                className="mt-4 w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90"
              >
                Save Settings
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
