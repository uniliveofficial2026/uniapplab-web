import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Type, Palette, AlignLeft, AlignCenter, AlignRight, Play, Edit3 } from 'lucide-react';
import { Post as PostType } from '../../types';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { Avatar } from '../common/Avatar';

interface RepostModalProps {
  post: PostType;
  onClose: () => void;
}

const COLORS = ['#ffffff', '#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export function RepostModal({ post, onClose }: RepostModalProps) {
  const db = useDB();
  const toast = useToast();
  
  const [caption, setCaption] = useState('');
  
  // Text Overlay Editing
  const [textOverlay, setTextOverlay] = useState('');
  const [textOverlayColor, setTextOverlayColor] = useState('#ffffff');
  const [textOverlaySize, setTextOverlaySize] = useState(20);
  const [textOverlayPos, setTextOverlayPos] = useState(50);
  const [showOverlayEditor, setShowOverlayEditor] = useState(false);

  const handleRepost = () => {
    const newId = `new_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newPost: PostType = {
      id: newId,
      user: db.currentUser,
      caption: caption,
      imageUrl: '', // Blank because the content is in repost
      likes: 0,
      comments: 0,
      reposts: 0,
      createdAt: new Date().toISOString(),
      isLiked: false,
      isSaved: false,
      repost: {
        ...post,
        textOverlay: textOverlay || post.textOverlay,
        textOverlayColor: textOverlayColor || post.textOverlayColor,
        textOverlaySize: textOverlaySize || post.textOverlaySize,
        textOverlayPos: textOverlayPos || post.textOverlayPos,
      }
    };

    db.addPost(newPost);
    
    // Update local post repost count
    db.updatePost(post.id, (p) => ({
      ...p,
      reposts: (p.reposts || 0) + 1
    }));

    if (toast?.showToast) {
      toast.showToast('Reposted successfully');
    }
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-card border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="font-bold text-lg">Repost</div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full border border-border shadow-sm">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add your thoughts..."
            className="w-full bg-secondary border border-border rounded-xl p-3 min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
          />

          <div className="flex justify-between items-center bg-secondary/50 p-2 rounded-xl border border-border">
            <span className="text-sm font-semibold ml-2">Edit Meme / Overlay</span>
            <button 
              onClick={() => setShowOverlayEditor(!showOverlayEditor)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:opacity-90 transition-opacity"
            >
              <Edit3 className="w-4 h-4" />
              {showOverlayEditor ? 'Hide Editor' : 'Edit Overlay'}
            </button>
          </div>

          {showOverlayEditor && (
            <div className="space-y-4 bg-secondary border border-border rounded-xl p-4 animate-in slide-in-from-top-2">
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">Overlay Text</label>
                <textarea
                  value={textOverlay}
                  onChange={(e) => setTextOverlay(e.target.value)}
                  placeholder="Drop a funny text overlay..."
                  className="w-full bg-background border border-border rounded-lg p-2 text-sm max-h-[80px]"
                />
              </div>
              
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-2 block">Text Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setTextOverlayColor(c)}
                      className={`w-8 h-8 rounded-full border-2 ${textOverlayColor === c ? 'border-primary scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">Size: {textOverlaySize}px</label>
                  <input 
                    type="range" 
                    min="10" 
                    max="60" 
                    value={textOverlaySize} 
                    onChange={(e) => setTextOverlaySize(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">Y-Position: {textOverlayPos}%</label>
                  <input 
                    type="range" 
                    min="5" 
                    max="95" 
                    value={textOverlayPos} 
                    onChange={(e) => setTextOverlayPos(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Preview of the Repost */}
          <div className="relative border border-border rounded-[18px] overflow-hidden bg-card opacity-90 scale-[0.98]">
             <div className="flex items-start gap-3 p-3 bg-card border-b border-border/50 shrink-0">
               <Avatar user={post.user} size="sm" />
               <div className="flex flex-col">
                 <span className="font-bold text-[13px]">{post.user?.displayName || post.user?.username || 'Unknown'}</span>
                 <span className="text-[11px] text-muted-foreground truncate">{post.caption}</span>
               </div>
             </div>
             
             <div className="w-full aspect-[4/5] bg-secondary relative flex items-center justify-center">
               {post.imageUrl && (
                 <img src={post.imageUrl} alt="preview" className="w-full h-full object-cover" />
               )}
               {post.videoUrl && (
                 <div className="relative w-full h-full bg-black flex items-center justify-center">
                   <Play className="w-12 h-12 text-white/50" />
                 </div>
               )}
               {(textOverlay || post.textOverlay) && (
                 <div 
                   style={{ 
                     color: textOverlayColor || post.textOverlayColor || '#ffffff', 
                     fontSize: `${textOverlaySize || post.textOverlaySize || 20}px`,
                     top: `${textOverlayPos ?? post.textOverlayPos ?? 50}%`,
                     textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)',
                     whiteSpace: 'pre-line'
                   }} 
                   className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-center font-black tracking-tight pointer-events-none z-20 select-none px-4 py-1.5 rounded bg-black/40 backdrop-blur-[2px] border border-white/10 w-[90%]"
                 >
                   {textOverlay || post.textOverlay}
                 </div>
               )}
             </div>
          </div>
        </div>

        <div className="p-4 border-t border-border bg-card shrink-0">
          <button 
            onClick={handleRepost}
            className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity active:scale-[0.98]"
          >
            Share Repost
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
