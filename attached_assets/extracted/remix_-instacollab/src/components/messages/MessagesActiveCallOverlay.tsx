import { Phone, Video } from 'lucide-react';
import { motion } from 'motion/react';
import type { ChatGroup, User } from '../../types';
import { handleAvatarError } from '../../lib/utils';

type MessagesActiveCallOverlayProps = {
  activeCall: 'video' | 'audio';
  selectedUser: User | ChatGroup;
  currentUserAvatarUrl?: string;
  onEndCall: () => void;
};

export function MessagesActiveCallOverlay({
  activeCall,
  selectedUser,
  currentUserAvatarUrl,
  onEndCall,
}: MessagesActiveCallOverlayProps) {
  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-[200] flex flex-col pt-12 pb-8 px-4 items-center justify-between">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="flex flex-col items-center gap-4 text-center mt-12"
      >
        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary shadow-xl">
          <img
            src={selectedUser.avatarUrl || undefined}
            alt="avatar"
            className="w-full h-full object-cover"
            onError={handleAvatarError}
          />
        </div>
        <h2 className="text-2xl font-bold">{selectedUser.displayName}</h2>
        <p className="text-muted-foreground animate-pulse">
          {activeCall === 'video' ? 'Calling video...' : 'Calling audio...'}
        </p>
      </motion.div>

      {activeCall === 'video' && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          className="absolute bottom-32 right-8 w-28 h-40 bg-secondary rounded-xl border border-border shadow-2xl overflow-hidden flex items-center justify-center"
        >
          <img
            src={currentUserAvatarUrl || undefined}
            className="w-full h-full object-cover opacity-80 filter blur-[1px]"
            alt="you"
            onError={handleAvatarError}
          />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="flex items-center gap-6"
      >
        <button
          type="button"
          className="w-14 h-14 bg-secondary text-foreground hover:bg-secondary/80 rounded-full flex items-center justify-center transition-colors shadow-lg"
        >
          <Video className="w-6 h-6" />
        </button>
        <button
          type="button"
          className="w-14 h-14 bg-secondary text-foreground hover:bg-secondary/80 rounded-full flex items-center justify-center transition-colors shadow-lg"
        >
          <div className="text-xl">🎙️</div>
        </button>
        <button
          type="button"
          onClick={onEndCall}
          className="w-16 h-16 bg-red-500 text-white hover:bg-red-600 rounded-full flex items-center justify-center transition-colors shadow-xl"
        >
          <Phone className="w-8 h-8 rotate-[135deg]" />
        </button>
      </motion.div>
    </div>
  );
}
