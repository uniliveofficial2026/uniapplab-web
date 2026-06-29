import { motion, AnimatePresence } from 'motion/react';
import React from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, Wand2, Share2, Plus, Play, Music, Scissors, Type, LayoutDashboard, Image } from 'lucide-react';

interface CreateModalProps {
  showCreateMenu: boolean;
  resetCreatePost: () => void;
  createStep: 'upload' | 'edit' | 'share';
  setCreateStep: (step: 'upload' | 'edit' | 'share') => void;
  createType: 'post' | 'reel';
  setCreateType: (type: 'post' | 'reel') => void;
  handleShare: () => void;
  children: React.ReactNode;
}

export function CreateModal({ 
  showCreateMenu, 
  resetCreatePost, 
  createStep, 
  setCreateStep, 
  createType, 
  setCreateType,
  handleShare,
  children
}: CreateModalProps) {
  if (!showCreateMenu) return null;
  
  return createPortal(
    <div 
      id="create-modal" 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-md p-4 sm:p-6 md:p-8"
      onClick={resetCreatePost}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`glass-bg backdrop-blur-3xl w-full rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col transition-all duration-300 ${
          createStep === 'edit' 
            ? 'max-w-4xl h-[90vh] md:h-[680px] max-h-[90vh] md:max-h-[680px] overflow-y-auto md:overflow-hidden' 
            : 'max-w-lg max-h-[90vh] overflow-y-auto'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-12 shrink-0 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 sticky top-0 glass-bg backdrop-blur-md z-10">
          <div className="w-8 flex items-center">
             {createStep === 'edit' && <button onClick={() => setCreateStep('upload')} className="bg-zinc-800 dark:bg-zinc-700 rounded-full p-1"><ArrowLeft className="w-5 h-5 text-white hover:text-zinc-300 transition-colors" /></button>}
          </div>
        <h2 className="font-bold flex items-center gap-4">
             {createStep === 'upload' && (
              <div className="flex p-1.5 rounded-full shadow-inner border border-zinc-200 dark:border-zinc-800 bg-white/10 dark:bg-zinc-800/50 backdrop-blur-sm">
                <button 
                  onClick={() => setCreateType('post')}
                  className={`px-5 py-2 rounded-full text-xs font-bold transition-all text-white ${createType === 'post' ? 'bg-zinc-700 dark:bg-zinc-900 border border-zinc-500' : 'bg-transparent'}`}
                >
                  Photo/Video
                </button>
                <button 
                  onClick={() => setCreateType('reel')}
                  className={`px-5 py-2 rounded-full text-xs font-bold transition-all text-white ${createType === 'reel' ? 'bg-zinc-600 dark:bg-zinc-900 border border-zinc-500' : 'bg-transparent'}`}
                >
                  Reel
                </button>
                <button 
                  onClick={() => { setCreateType('post'); setCreateStep('edit'); }}
                  className={`px-5 py-2 rounded-full text-xs font-bold transition-all text-white ${(createStep as any) === 'edit' ? 'bg-zinc-500 dark:bg-zinc-900 border border-zinc-500' : 'bg-transparent'}`}
                >
                  Edit 
                </button>
              </div>
            )}
            {createStep === 'edit' && 'Edit & Share'}
            {createStep === 'share' && 'Shared!'}
          </h2>
          <div className="w-8 flex justify-end">
            {createStep === 'edit' ? (
              <button onClick={handleShare} className="text-primary font-bold hover:text-primary/80 transition-colors">Share</button>
            ) : (
              <button onClick={resetCreatePost} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-6 h-6" /></button>
            )}
          </div>
        </div>
        
        {children}
      </motion.div>
    </div>,
    document.body
  );
}
