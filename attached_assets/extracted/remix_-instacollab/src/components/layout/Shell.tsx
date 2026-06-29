import { motion, AnimatePresence } from 'motion/react';
import React, { ReactNode, useState } from 'react';
import { Home, Search, PlaySquare, MessageCircle, Send, Heart, Bell, PlusSquare, Plus, User as UserIcon, LayoutDashboard, Menu, Store, Share2, Wand2, ArrowLeft, CheckCircle2, X, Scissors, Music, Type, Image, Radio, Gamepad2, Globe, Wallet, Play } from 'lucide-react';
import { Tab, User } from '../../types';
import { useToast } from '../../lib/ToastContext';
import { handleAvatarError, handleMediaError, fileToBase64 } from '../../lib/utils';
import { Avatar } from '../common/Avatar';
import { AppLogo } from '../common/AppLogo';
import { CreateModal } from './CreateModal';
import { MarketplaceModal } from './MarketplaceModal';

import { useDB } from '../../lib/useDB';

interface ShellProps {
  currentTab: Tab;
  setCurrentTab: (tab: Tab) => void;
  currentUser: User;
  children: ReactNode;
}

export function Shell({ currentTab, setCurrentTab, currentUser, children }: ShellProps) {
  const db = useDB();
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [createStep, setCreateStep] = useState<'upload' | 'edit' | 'share'>('upload');
  const [createType, setCreateType] = useState<'post' | 'reel'>('post');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedIsVideo, setUploadedIsVideo] = useState(false);
  const [uploadedMediaList, setUploadedMediaList] = useState<Array<{ url: string; type: 'image' | 'video' | 'audio'; name: string }>>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState<number>(0);
  const [caption, setCaption] = useState('');
  const [showHashtagList, setShowHashtagList] = useState(false);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  
  const [videoEditTab, setVideoEditTab] = useState<'none' | 'trim' | 'audio' | 'text' | 'cover' | 'filters' | 'adjust' | 'font' | 'bg' | 'align' | 'size' | 'color'>('none');
  const [textPostFont, setTextPostFont] = useState('font-sans');
  const [textPostBg, setTextPostBg] = useState('bg-gradient-to-br from-indigo-500 to-purple-600');
  const [textPostColor, setTextPostColor] = useState('text-white');
  const [textPostAlignment, setTextPostAlignment] = useState('text-center');
  const [textPostSizeValue, setTextPostSizeValue] = useState(48); // Store as number for easy slider use
  const textPostSize = `text-[${textPostSizeValue}px]`;

  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [textOverlay, setTextOverlay] = useState('');
  const [textOverlayColor, setTextOverlayColor] = useState('#ffffff');
  const [textOverlaySize, setTextOverlaySize] = useState(24);
  const [textOverlayPos, setTextOverlayPos] = useState(50);
  const [audioTrack, setAudioTrack] = useState('none');
  
  const suggestedHashtags = ['#fyp', '#viral', '#trending', '#explore', '#photography', '#art', '#daily'];
  const suggestedMentions = ['@alex', '@sarah', '@design_guru', '@tech_insider', '@daily_vibes'];
  const [filter, setFilter] = useState('none');
  const [activeMktTab, setActiveMktTab] = useState('Presets');
  const [purchasedItems, setPurchasedItems] = useState<Record<string, boolean>>({});
  const { showToast } = useToast();

  const activeItem = uploadedMediaList[activeMediaIndex] || { url: uploadedImage || '', type: uploadedIsVideo ? 'video' : 'image', name: '' };
  
  const filterStyle = {
    filter: `${filter === 'grayscale' ? 'grayscale(100%)' : filter === 'sepia' ? 'sepia(100%)' : filter === 'blur' ? 'blur(4px)' : filter === 'noir' ? 'grayscale(100%) contrast(140%) brightness(90%)' : filter === 'vintage' ? 'sepia(80%) hue-rotate(-10deg) saturate(120%)' : filter === 'sunset' ? 'saturate(150%) hue-rotate(15deg) sepia(20%)' : filter === 'cold' ? 'hue-rotate(180deg) saturate(110%) contrast(110%)' : filter === 'chrome' ? 'contrast(150%) saturate(140%)' : 'none'} brightness(${brightness}%) contrast(${contrast}%)`
  };

  const [isCrossPostModalOpen, setIsCrossPostModalOpen] = useState(false);
  const [crossPostOptions, setCrossPostOptions] = useState({
    twitter: false,
    facebook: false,
    tumblr: false
  });
  
  const handleBuy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPurchasedItems(prev => ({ ...prev, [id]: true }));
    showToast('Item purchased successfully');
  };
  
  const mainNavItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'search', icon: Search, label: 'Explore' },
    { id: 'reels', icon: PlaySquare, label: 'Reels' },
    { id: 'messages', icon: MessageCircle, label: 'Messages' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
  ];

  const appNavItems = [
    { id: 'workspace', icon: LayoutDashboard, label: 'Workspace' },
    { id: 'live', icon: Radio, label: 'Live Hub' },
    { id: 'local-games', icon: Gamepad2, label: 'Local Library' },
    { id: 'third-party-games', icon: Globe, label: 'Game Network' },
    { id: 'wallet', icon: Wallet, label: 'Trade Wallet' },
  ];

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const processSelectedFiles = async (files: File[]) => {
    try {
      const newList = [...uploadedMediaList];
      for (const file of files) {
        const base64 = await fileToBase64(file);
        let type: 'image' | 'video' | 'audio' = 'image';
        if (file.type.startsWith('video/') || /\.(mp4|mov|webm|ogg|m4v|avi|wmv)$/i.test(file.name)) {
          type = 'video';
        } else if (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|aac|m4a|flac)$/i.test(file.name)) {
          type = 'audio';
        }
        newList.push({ url: base64, type, name: file.name });
      }
      if (newList.length > 0) {
        setUploadedMediaList(newList);
        // Fallbacks for backward compatibility
        setUploadedImage(newList[0].url);
        setUploadedIsVideo(newList[0].type === 'video');
        setActiveMediaIndex(uploadedMediaList.length);
        setCreateStep('edit');
      }
    } catch (err) {
      showToast('Error reading files');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processSelectedFiles(Array.from(files));
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processSelectedFiles(Array.from(files));
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const resetCreatePost = () => {
    setShowCreateMenu(false);
    setTimeout(() => {
      setCreateStep('upload');
      setUploadedImage(null);
      setUploadedIsVideo(false);
      setUploadedMediaList([]);
      setActiveMediaIndex(0);
      setCaption('');
      setFilter('none');
      setBrightness(100);
      setContrast(100);
      setTextOverlay('');
      setTextOverlayColor('#ffffff');
      setTextOverlaySize(24);
      setTextOverlayPos(50);
      setAudioTrack('none');
      setVideoEditTab('none');
    }, 300);
  };

  const handleShare = () => {
    setCreateStep('share');
    const newId = `new_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    const mediaArray = uploadedMediaList.map(m => ({
      url: m.url,
      type: m.type,
      name: m.name || ''
    }));
    
    // Choose active or first media as default fallback
    const fallbackItem = uploadedMediaList[activeMediaIndex] || uploadedMediaList[0] || { url: uploadedImage, type: uploadedIsVideo ? 'video' : 'image' };
    const fallbackUrl = fallbackItem?.url || uploadedImage || '';
    const fallbackIsVideo = fallbackItem?.type === 'video';
    const fallbackIsAudio = fallbackItem?.type === 'audio';

    if (createType === 'reel') {
      db.addReel({
        id: newId,
        user: currentUser,
        likes: 0,
        comments: 0,
        shares: 0,
        caption: caption,
        audioUrl: audioTrack !== 'none' ? audioTrack : (fallbackIsAudio ? fallbackUrl : 'Original Audio - ' + currentUser.username),
        videoUrl: fallbackUrl,
        createdAt: new Date().toISOString(),
        filter,
        brightness,
        contrast,
        textOverlay,
        textOverlayColor,
        textOverlaySize,
        textOverlayPos,
        mediaList: mediaArray,
        font: textPostFont,
        color: textPostColor,
        alignment: textPostAlignment,
        size: textPostSize,
        bg: textPostBg
      });
    } else {
      db.addPost({
        id: newId,
        user: currentUser,
        imageUrl: !fallbackIsVideo ? fallbackUrl : '',
        videoUrl: fallbackIsVideo ? fallbackUrl : '',
        audioUrl: audioTrack !== 'none' ? audioTrack : (fallbackIsAudio ? fallbackUrl : undefined),
        likes: 0,
        comments: 0,
        caption: caption,
        time: 'Just now',
        createdAt: new Date().toISOString(),
        isLiked: false,
        isSaved: false,
        filter,
        brightness,
        contrast,
        textOverlay,
        textOverlayColor,
        textOverlaySize,
        textOverlayPos,
        mediaList: mediaArray,
        font: textPostFont,
        color: textPostColor,
        alignment: textPostAlignment,
        size: textPostSize,
        bg: textPostBg
      });
    }
    setTimeout(() => {
      resetCreatePost();
    }, 2000);
  };

  return (
    <div className="flex h-[100dvh] w-full bg-background text-foreground overflow-hidden font-sans">
      
      {/* Create Modal */}
      <CreateModal 
        showCreateMenu={showCreateMenu}
        resetCreatePost={resetCreatePost}
        createStep={createStep}
        setCreateStep={setCreateStep}
        createType={createType}
        setCreateType={setCreateType}
        handleShare={handleShare}
      >
        {createStep === 'upload' && (
          <div 
            className="p-8 flex flex-col items-center justify-center min-h-[500px] glass-bg dark:bg-transparent backdrop-blur-xl rounded-b-3xl"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <div className="w-24 h-24 mb-4 opacity-50 relative animate-pulse">
              <svg viewBox="0 0 97.6 77.3" fill="currentColor">
                  <path d="M16.3 24h.3c2.8-.2 4.9-2.6 4.8-5.4-.2-2.8-2.6-4.9-5.4-4.8s-4.9 2.6-4.8 5.4c.1 2.7 2.4 4.8 5.1 4.8zm-2.4-7.2c.5-.6 1.3-1 2.1-1h.2c1.7 0 3.1 1.4 3.1 3.1v.2c-.2 1.7-1.7 2.9-3.4 2.8-1.7-.2-2.9-1.7-2.8-3.4.1-.7.4-1.4.8-1.7z"></path>
                  <path d="M94.3 31.6C94.1 22.8 87.2 16 78.4 16H66.8V4.5c0-2.5-2-4.5-4.5-4.5H35.4c-2.5 0-4.5 2-4.5 4.5V16H19.2C10.5 16 3.5 22.9 3.3 31.6v37c.2 8.8 7.3 15.7 16 15.7h59.1c8.8 0 15.8-7 16-15.8v-36.9zM35.4 4.5h26.9V16H35.4V4.5zm54.4 64c-.1 6.3-5.2 11.3-11.5 11.4H19.2c-6.3-11.4-5.2-11.5-11.5v-37c.1-6.3 5.2-11.3 11.5-11.4h59.1c6.3.1 11.4 5.2 11.5 11.5v37z"></path>
                  <path d="M48.8 28.5c-11.4-.2-20.8 8.8-21 20.2-.2 11.4 8.8 20.8 20.2 21 11.4.2 20.8-8.8 21-20.2.2-11.4-8.8-20.8-20.2-21zm0 36.8c-8.9 0-16.1-7.2-16.1-16.1s7.2-16.1 16.1-16.1 16.1 7.2 16.1 16.1-7.2 16.1-16.1 16.1z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-medium mb-4">
              {createType === 'reel' ? 'Drag videos here' : 'Drag photos and videos here'}
            </h3>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*,video/*,audio/*" 
              multiple
              className="hidden" 
            />
            <button onClick={triggerFileUpload} className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors active:scale-95">
              Select from computer
            </button>

              <div className="flex items-center gap-6 mt-10 pt-10 border-t border-border w-full text-sm font-semibold text-muted-foreground justify-center">
              <span onClick={() => { 
                setFilter(prev => prev === 'none' ? 'sepia' : prev === 'sepia' ? 'grayscale' : prev === 'grayscale' ? 'blur' : 'none'); 
                showToast('Filter applied'); 
              }} className="flex items-center gap-2 hover:text-foreground cursor-pointer transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary"><Wand2 className="w-4 h-4" /> Apply AI Filters</span>
              <span onClick={() => setIsCrossPostModalOpen(true)} className="flex items-center gap-2 hover:text-foreground cursor-pointer transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary"><Share2 className="w-4 h-4" /> Cross-post Setup</span>
            </div>
          </div>
        )}
            {createStep === 'edit' && (
              <div className="flex flex-col md:flex-row flex-1 min-h-0 h-auto md:h-full md:overflow-hidden no-scrollbar glass-bg dark:bg-transparent backdrop-blur-xl rounded-b-3xl">
                  <div className="flex-1 w-full glass-bg dark:bg-secondary/10 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800/50 flex flex-col md:overflow-hidden min-h-[440px] md:min-h-0 md:h-full">
                      <div className="flex-1 relative group flex items-center justify-center glass-bg dark:bg-secondary/10 p-4 min-h-[340px] md:min-h-0 overflow-hidden">
                        {uploadedMediaList.length === 0 ? (
                          <div className={`w-full h-full flex items-center justify-center p-8 ${textPostBg} rounded-xl overflow-auto`}>
                             <p className={`${textPostFont} ${textPostAlignment} ${textPostSize} ${textPostColor} font-black break-words w-full`}>
                               {caption || 'Start typing...'}
                             </p>
                          </div>
                        ) : activeItem.type === 'video' ? (
                          <video 
                            src={activeItem.url || undefined} 
                            style={filterStyle} 
                            className="max-w-full max-h-full object-contain rounded-xl shadow-lg transition-transform duration-700 bg-black" 
                            preload="auto" 
                            autoPlay 
                            loop 
                            muted 
                            playsInline 
                            controls 
                          />
                        ) : activeItem.type === 'audio' ? (
                          <div className="flex flex-col items-center justify-center p-6 bg-card border border-border shadow-md rounded-2xl w-full max-w-[280px] aspect-square relative z-10">
                            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 relative overflow-hidden animate-pulse">
                              <Music className="w-10 h-10 animate-bounce" />
                              <div className="absolute inset-0 border-2 border-dashed border-primary/20 rounded-full animate-spin [animation-duration:10s]"></div>
                            </div>
                            <p className="font-bold text-sm text-center mb-1 max-w-[240px] truncate">{activeItem.name || 'Audio Track'}</p>
                            <p className="text-xs text-muted-foreground mb-4">Audio Playback Preview</p>
                            <audio src={activeItem.url || undefined} controls className="w-full accent-primary focus:outline-none" />
                          </div>
                        ) : (
                          <img 
                            style={filterStyle} 
                            src={activeItem.url || undefined} 
                            className="max-w-full max-h-full object-contain rounded-xl shadow-lg transition-transform duration-700 bg-secondary/10" 
                            alt="Preview" 
                            onError={handleMediaError} 
                          />
                        )}

                      {textOverlay.trim() && (
                        <div 
                          style={{ 
                            color: textOverlayColor, 
                            fontSize: `${textOverlaySize}px`,
                            top: `${textOverlayPos}%`,
                            textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)'
                          }} 
                          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-center font-black tracking-tight pointer-events-none z-30 select-none px-4 py-1.5 rounded bg-black/40 backdrop-blur-[2px] border border-white/10"
                        >
                          {textOverlay}
                        </div>
                      )}
                    </div>

                    {/* Multiple Media Thumbnail Gallery Selector */}
                    {uploadedMediaList.length > 0 && (
                      <div className="px-4 py-2 bg-white/40 dark:bg-zinc-950/30 border-t border-white/40 dark:border-zinc-800/50 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
                        {uploadedMediaList.map((item, index) => (
                          <div 
                            key={`thumb-${index}`}
                            className={`relative w-14 h-14 rounded-lg overflow-hidden cursor-pointer border-2 transition-all flex-shrink-0 ${activeMediaIndex === index ? 'border-primary ring-2 ring-primary/20 scale-95' : 'border-muted hover:border-foreground/40'}`}
                            onClick={() => {
                              setActiveMediaIndex(index);
                            }}
                          >
                            {item.type === 'image' ? (
                              <img src={item.url || undefined} className="w-full h-full object-cover" />
                            ) : item.type === 'video' ? (
                              <div className="w-full h-full bg-secondary/50 flex items-center justify-center text-[10px] text-foreground/70">
                                <Play className="w-4 h-4 fill-current shrink-0" />
                              </div>
                            ) : (
                              <div className="w-full h-full bg-secondary flex items-center justify-center text-primary">
                                <Music className="w-5 h-5 shrink-0" />
                              </div>
                            )}
                            
                            {/* Remove button */}
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newList = uploadedMediaList.filter((_, i) => i !== index);
                                setUploadedMediaList(newList);
                                if (newList.length === 0) {
                                  resetCreatePost();
                                } else {
                                  if (activeMediaIndex >= newList.length) {
                                    setActiveMediaIndex(newList.length - 1);
                                  }
                                }
                              }}
                              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white text-[8px] font-black z-20"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        
                        {/* Plus button to add more media items dynamically */}
                        <button 
                          type="button"
                          onClick={triggerFileUpload}
                          className="w-14 h-14 rounded-lg border-2 border-dashed border-muted hover:border-foreground/30 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-all flex-shrink-0"
                          title="Add more files"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    )}

                  {/* Tool Tabs Ribbon */}
                  <div className="border-t border-white/40 dark:border-zinc-800/50 bg-white/40 dark:bg-zinc-950/30 p-2 flex gap-1.5 overflow-x-auto no-scrollbar items-center shrink-0">
                    {uploadedMediaList.length === 0 ? (
                      <>
                        <button onClick={() => setVideoEditTab(videoEditTab === 'font' ? 'none' : 'font')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 text-xs font-bold ${videoEditTab === 'font' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/50 text-muted-foreground'}`}><Type className="w-3.5 h-3.5" /> <span>Font</span></button>
                        <button onClick={() => setVideoEditTab(videoEditTab === 'bg' ? 'none' : 'bg')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 text-xs font-bold ${videoEditTab === 'bg' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/50 text-muted-foreground'}`}><Image className="w-3.5 h-3.5" /> <span>BG</span></button>
                        <button onClick={() => setVideoEditTab(videoEditTab === 'color' ? 'none' : 'color')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 text-xs font-bold ${videoEditTab === 'color' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/50 text-muted-foreground'}`}><Type className="w-3.5 h-3.5" /> <span>Color</span></button>
                        <button onClick={() => setVideoEditTab(videoEditTab === 'align' ? 'none' : 'align')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 text-xs font-bold ${videoEditTab === 'align' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/50 text-muted-foreground'}`}><LayoutDashboard className="w-3.5 h-3.5" /> <span>Align</span></button>
                        <button onClick={() => setVideoEditTab(videoEditTab === 'size' ? 'none' : 'size')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 text-xs font-bold ${videoEditTab === 'size' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/50 text-muted-foreground'}`}><Type className="w-3.5 h-3.5" /> <span>Size</span></button>
                      </>
                    ) : (
                      <>
                    <button 
                      onClick={() => setVideoEditTab(videoEditTab === 'filters' ? 'none' : 'filters')} 
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 text-xs font-bold ${videoEditTab === 'filters' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/50 text-muted-foreground'}`}
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Filters</span>
                    </button>
                    <button 
                      onClick={() => setVideoEditTab(videoEditTab === 'adjust' ? 'none' : 'adjust')} 
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 text-xs font-bold ${videoEditTab === 'adjust' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/50 text-muted-foreground'}`}
                    >
                      <Plus className="w-3.5 h-3.5 rotate-45" />
                      <span>Adjust</span>
                    </button>
                    <button 
                      onClick={() => setVideoEditTab(videoEditTab === 'text' ? 'none' : 'text')} 
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 text-xs font-bold ${videoEditTab === 'text' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/50 text-muted-foreground'}`}
                    >
                      <Type className="w-3.5 h-3.5" />
                      <span>Text Overlay</span>
                    </button>
                    <button 
                      onClick={() => setVideoEditTab(videoEditTab === 'audio' ? 'none' : 'audio')} 
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 text-xs font-bold ${videoEditTab === 'audio' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/50 text-muted-foreground'}`}
                    >
                      <Music className="w-3.5 h-3.5" />
                      <span>Soundtrack</span>
                    </button>
                    {uploadedIsVideo && (
                      <button 
                        onClick={() => setVideoEditTab(videoEditTab === 'trim' ? 'none' : 'trim')} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 text-xs font-bold ${videoEditTab === 'trim' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/50 text-muted-foreground'}`}
                      >
                        <Scissors className="w-3.5 h-3.5" />
                        <span>Trim</span>
                      </button>
                    )}
                      </>
                    )}

                  {/* Tool Options Panels */}
                  {videoEditTab !== 'none' && (
                    <div className="p-3 border-t border-white/20 dark:border-zinc-800/50 glass-bg dark:bg-secondary/15 shrink-0 select-none">
                      {/* COLOR PANEL */}
                      {videoEditTab === 'color' && (
                        <div className="flex gap-2 px-2 py-1 flex-wrap">
                          {[
                            { color: 'text-foreground', bg: 'bg-background' },
                            { color: 'text-muted-foreground', bg: 'bg-secondary' },
                            { color: 'text-indigo-500', bg: 'bg-indigo-500' },
                            { color: 'text-teal-400', bg: 'bg-teal-400' },
                            { color: 'text-orange-400', bg: 'bg-orange-400' },
                            { color: 'text-red-500', bg: 'bg-red-500' },
                            { color: 'text-transparent bg-clip-text bg-gradient-to-r from-blue-100 via-white to-blue-50', bg: 'bg-gradient-to-br from-blue-100 to-white' },
                            { color: 'text-transparent bg-clip-text bg-gradient-to-b from-blue-300 to-blue-600', bg: 'bg-gradient-to-br from-blue-300 to-blue-600' }
                          ].map(item => (
                            <button 
                              key={item.color} 
                              onClick={() => setTextPostColor(item.color)} 
                              className={`w-8 h-8 rounded-full border-2 ${item.bg} ${textPostColor === item.color ? 'border-primary' : 'border-border'}`} 
                            />
                          ))}
                        </div>
                      )}
                      
                      {/* FONT PANEL */}
                      {videoEditTab === 'font' && (
                        <div className="flex gap-2 px-2 py-1">
                          {['sans', 'serif', 'mono'].map(f => (
                            <button key={f} onClick={() => setTextPostFont(`font-${f}`)} className={`px-4 py-2 rounded-lg text-sm font-bold ${textPostFont === `font-${f}` ? 'bg-primary text-white' : 'bg-secondary'}`}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
                          ))}
                        </div>
                      )}

                      {/* BG PANEL */}
                      {videoEditTab === 'bg' && (
                        <div className="flex gap-2 px-2 py-1 flex-wrap">
                          {['bg-transparent', 'backdrop-blur-xl bg-background/50', 'bg-card', 'bg-gradient-to-br from-indigo-500 to-purple-600', 'bg-gradient-to-br from-teal-400 to-emerald-500', 'bg-gradient-to-br from-orange-400 to-red-500', 'bg-secondary'].map(b => (
                            <button key={b} onClick={() => setTextPostBg(b)} className={`w-8 h-8 rounded-full ${b} border-2 ${textPostBg === b ? 'border-primary' : 'border-border'}`} />
                          ))}
                        </div>
                      )}

                      {/* ALIGN PANEL */}
                      {videoEditTab === 'align' && (
                        <div className="flex gap-2 px-2 py-1">
                          {['left', 'center', 'right'].map(a => (
                            <button key={a} onClick={() => setTextPostAlignment(`text-${a}`)} className={`px-4 py-2 rounded-lg text-sm font-bold ${textPostAlignment === `text-${a}` ? 'bg-primary text-white' : 'bg-secondary'}`}>{a}</button>
                          ))}
                        </div>
                      )}

                      {/* SIZE PANEL */}
                      {videoEditTab === 'size' && (
                        <div className="px-2 py-1 space-y-1">
                          <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            <span>Text Size</span>
                            <span>{textPostSizeValue}px</span>
                          </div>
                          <input 
                            type="range" 
                            min="14" 
                            max="72" 
                            value={textPostSizeValue} 
                            onChange={(e) => setTextPostSizeValue(parseInt(e.target.value))} 
                            className="w-full accent-primary h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer" 
                          />
                        </div>
                      )}

                      {/* FILTERS PANEL */}
                      {videoEditTab === 'filters' && (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                          {[
                            { id: 'none', name: 'Normal' },
                            { id: 'grayscale', name: 'Grayscale' },
                            { id: 'sepia', name: 'Sepia' },
                            { id: 'blur', name: 'Soft Blur' },
                            { id: 'noir', name: 'Noir Bold' },
                            { id: 'vintage', name: 'Vintage' },
                            { id: 'sunset', name: 'Sunset Glow' },
                            { id: 'cold', name: 'Cyberpunk' },
                            { id: 'chrome', name: 'Chrome' }
                          ].map(f => (
                            <button 
                              key={f.id} 
                              onClick={() => setFilter(f.id)} 
                              style={{ 
                                filter: f.id === 'grayscale' ? 'grayscale(100%)' : f.id === 'sepia' ? 'sepia(100%)' : f.id === 'blur' ? 'blur(2px)' : f.id === 'noir' ? 'grayscale(100%) contrast(140%) brightness(90%)' : f.id === 'vintage' ? 'sepia(80%) hue-rotate(-10deg) saturate(120%)' : f.id === 'sunset' ? 'saturate(150%) hue-rotate(15deg) sepia(20%)' : f.id === 'cold' ? 'hue-rotate(180deg) saturate(110%) contrast(110%)' : f.id === 'chrome' ? 'contrast(150%) saturate(140%)' : 'none' 
                              }}
                              className={`relative shrink-0 w-20 h-16 rounded-xl border-2 overflow-hidden flex items-center justify-center font-bold text-[10px] transition-all bg-secondary text-foreground ${filter === f.id ? 'border-primary ring-2 ring-primary/20 scale-95' : 'border-border'}`}
                            >
                              <span className="relative z-10 drop-shadow-sm text-center">{f.name}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* ADJUST SHADING PANEL */}
                      {videoEditTab === 'adjust' && (
                        <div className="space-y-2 px-2 py-1">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-bold text-muted-foreground">
                              <span>Brightness</span>
                              <span>{brightness}%</span>
                            </div>
                            <input 
                              type="range" 
                              min="50" 
                              max="150" 
                              value={brightness} 
                              onChange={(e) => setBrightness(parseInt(e.target.value))} 
                              className="w-full accent-primary h-1 bg-border rounded-lg appearance-none cursor-pointer" 
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-bold text-muted-foreground">
                              <span>Contrast</span>
                              <span>{contrast}%</span>
                            </div>
                            <input 
                              type="range" 
                              min="50" 
                              max="150" 
                              value={contrast} 
                              onChange={(e) => setContrast(parseInt(e.target.value))} 
                              className="w-full accent-primary h-1 bg-border rounded-lg appearance-none cursor-pointer" 
                            />
                          </div>
                        </div>
                      )}

                      {/* TEXT LAYER PANEL */}
                      {videoEditTab === 'text' && (
                        <div className="space-y-3 px-2 py-1">
                          <div className="flex items-center gap-2">
                            <input 
                              type="text" 
                              value={textOverlay} 
                              onChange={(e) => setTextOverlay(e.target.value)} 
                              placeholder="Type overlay text (e.g. ME OUTDOORS! 🏔️)..." 
                              className="flex-1 bg-background text-foreground border border-border rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-primary"
                            />
                            {textOverlay && (
                              <button onClick={() => setTextOverlay('')} className="text-xs text-destructive font-bold hover:underline">Clear</button>
                            )}
                          </div>
                          
                          {textOverlay && (
                            <div className="grid grid-cols-2 gap-3 pt-1">
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-muted-foreground block">Text Color</span>
                                <div className="flex gap-1.5 items-center">
                                  {['#ffffff', '#000000', '#facc15', '#f87171', '#4ade80', '#60a5fa'].map(c => (
                                    <button 
                                      key={c} 
                                      onClick={() => setTextOverlayColor(c)} 
                                      style={{ backgroundColor: c }} 
                                      className={`w-5 h-5 rounded-full border shadow-sm transition-transform ${textOverlayColor === c ? 'scale-125 border-primary border-2' : 'border-border'}`}
                                    />
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-muted-foreground block">Vertical Position ({textOverlayPos}%)</span>
                                <input 
                                  type="range" 
                                  min="10" 
                                  max="90" 
                                  value={textOverlayPos} 
                                  onChange={(e) => setTextOverlayPos(parseInt(e.target.value))} 
                                  className="w-full accent-primary h-1 bg-border rounded-lg appearance-none cursor-pointer" 
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* AUDIO TRACK PANEL */}
                      {videoEditTab === 'audio' && (
                        <div className="space-y-2 px-2 py-1">
                          <span className="text-[11px] font-bold text-muted-foreground block">Curated Music Library Soundtrack</span>
                          <div className="flex gap-2 overflow-x-auto no-scrollbar">
                            {[
                              { id: 'none', label: 'No Track', desc: 'Use original sound' },
                              { id: 'Lofi Sunsets 🏖️ - ChillHop Store', label: 'Lofi Sunsets', desc: 'Relaxed lazy beats' },
                              { id: 'Tech Synergy ⚡ - ProdByAIST', label: 'Tech Synergy', desc: 'Futuristic ambient electro' },
                              { id: 'Neon Horizon 🌌 - Waveforms', label: 'Neon Horizon', desc: 'Retrowave space out vibe' },
                              { id: 'Gym Beast Mode 🔥 - PowerGains', label: 'Gym Beast', desc: 'Aggressive motivational trap' }
                            ].map(track => (
                              <button 
                                key={track.id} 
                                onClick={() => {
                                  setAudioTrack(track.id);
                                  showToast(`Selected "${track.label}"`);
                                }} 
                                className={`shrink-0 flex flex-col p-2 rounded-xl border text-left transition-all ${audioTrack === track.id ? 'bg-primary/10 border-primary' : 'bg-background hover:bg-secondary/40 border-border'}`}
                              >
                                <span className="text-xs font-black truncate max-w-[120px]">{track.label}</span>
                                <span className="text-[9px] text-muted-foreground block line-clamp-1 max-w-[120px]">{track.desc}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* TRIM PANEL */}
                      {videoEditTab === 'trim' && (
                        <div className="space-y-1.5 px-2 py-1">
                          <div className="flex justify-between items-center text-xs font-bold text-muted-foreground">
                            <span>Trim Start ({trimStart}%)</span>
                            <span>Trim End ({trimEnd}%)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold">0%</span>
                            <div className="flex-1 h-6 bg-secondary/85 rounded-md relative flex items-center">
                              <div className="absolute inset-y-0 left-0 bg-primary/20 rounded-l-md" style={{ width: `${trimStart}%` }}></div>
                              <div className="absolute inset-y-0 right-0 bg-primary/20 rounded-r-md" style={{ width: `${100 - trimEnd}%` }}></div>
                              <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                value={trimStart} 
                                onChange={(e) => setTrimStart(Math.min(parseInt(e.target.value), trimEnd - 10))} 
                                className="absolute inset-x-0 w-full opacity-0 cursor-pointer h-full z-10" 
                              />
                              <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                value={trimEnd} 
                                onChange={(e) => setTrimEnd(Math.max(parseInt(e.target.value), trimStart + 10))} 
                                className="absolute inset-x-0 w-full opacity-0 cursor-pointer h-full z-10" 
                              />
                              <div className="absolute h-full border-l-2 border-r-2 border-primary" style={{ left: `${trimStart}%`, right: `${100 - trimEnd}%` }}></div>
                            </div>
                            <span className="text-[10px] font-bold">100%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-1 w-full flex flex-col md:overflow-hidden min-h-[320px] md:min-h-0 md:h-full bg-card">
                  <div className="p-4 flex items-center gap-3 shrink-0 border-b border-border/40">
                     <Avatar user={currentUser} size="sm" />
                     <span className="font-bold text-[14px] text-foreground">{currentUser.username}</span>
                  </div>
                  <textarea 
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Write a caption..." 
                    className="w-full p-4 text-[15px] resize-none outline-none bg-transparent placeholder:text-muted-foreground placeholder:font-medium min-h-[140px] md:min-h-0 md:flex-1 overflow-y-auto no-scrollbar"
                  ></textarea>
                  <div className="border-t border-border/80 p-3 flex items-center text-muted-foreground gap-1.5 relative shrink-0 bg-card">
                     {showHashtagList && (
                       <div className="absolute bottom-full left-0 mb-2 w-full glass-bg dark:bg-zinc-900/90 backdrop-blur-xl border border-white/50 dark:border-zinc-800/50 rounded-xl shadow-xl overflow-hidden z-50">
                         <div className="px-3 py-2 border-b border-white/20 dark:border-zinc-800/50 flex items-center justify-between glass-bg dark:bg-secondary/20">
                           <span className="text-xs font-bold text-foreground">Select Hashtags</span>
                           <button onClick={() => setShowHashtagList(false)} className="text-xs font-bold text-primary hover:underline">Done</button>
                         </div>
                         <div className="p-3 flex flex-wrap gap-2 max-h-32 overflow-y-auto no-scrollbar">
                           {suggestedHashtags.map(tag => {
                             const isSelected = caption.includes(tag);
                             return (
                               <button 
                                 key={tag} 
                                 onClick={() => {
                                   if (isSelected) {
                                     setCaption(prev => prev.replace(new RegExp(tag + '\\s*', 'g'), '').trim());
                                   } else {
                                     setCaption(prev => (prev.trim() + ' ' + tag).trim() + ' ');
                                   }
                                 }} 
                                 className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-white/40 dark:bg-secondary hover:bg-white/60 dark:hover:bg-secondary/80 text-foreground border border-white/20'}`}
                               >
                                 {tag}
                               </button>
                             );
                           })}
                         </div>
                       </div>
                     )}
                     {showMentionList && (
                       <div className="absolute bottom-full left-0 mb-2 w-full bg-white/95 dark:bg-zinc-900/90 backdrop-blur-xl border border-white/50 dark:border-zinc-800/50 rounded-xl shadow-xl overflow-hidden z-50 flex flex-col">
                         <div className="px-3 py-2 border-b border-white/20 dark:border-zinc-800/50 flex items-center justify-between bg-white/10 dark:bg-secondary/20 shrink-0">
                           <span className="text-xs font-bold text-foreground">Mention Creators</span>
                           <button onClick={() => { setShowMentionList(false); setMentionSearch(''); }} className="text-xs font-bold text-primary hover:underline">Done</button>
                         </div>
                         <div className="p-2 border-b border-border shrink-0">
                           <input 
                             type="text"
                             value={mentionSearch}
                             onChange={(e) => setMentionSearch(e.target.value)}
                             placeholder="Search creators..."
                             className="w-full text-xs bg-secondary border border-border rounded-lg px-2.5 py-1.5 outline-none font-medium focus:border-primary placeholder:text-muted-foreground"
                           />
                         </div>
                         <div className="p-1 flex flex-col gap-1 max-h-44 overflow-y-auto no-scrollbar">
                           {(() => {
                             const dbUsers = db.users;
                             const filteredDbUsers = dbUsers.filter(u => 
                               u.username.toLowerCase().includes(mentionSearch.toLowerCase()) || 
                               (u.displayName && u.displayName.toLowerCase().includes(mentionSearch.toLowerCase()))
                             );
                             
                             const hasExactMatch = dbUsers.some(u => u.username.toLowerCase() === mentionSearch.toLowerCase().replace('@', ''));
                             const showCustomAdd = mentionSearch.trim().length > 0 && !hasExactMatch;

                             return (
                               <>
                                 {filteredDbUsers.map(u => {
                                   const handle = '@' + u.username;
                                   const isSelected = caption.includes(handle);
                                   return (
                                     <button 
                                       key={u.id}
                                       onClick={() => {
                                         if (isSelected) {
                                           setCaption(prev => prev.replace(new RegExp(handle + '\\s*', 'g'), '').trim());
                                         } else {
                                           setCaption(prev => (prev.trim() + ' ' + handle).trim() + ' ');
                                         }
                                       }}
                                       className={`flex items-center gap-2.5 w-full p-2 rounded-lg text-left transition-colors ${isSelected ? 'bg-primary/10 hover:bg-primary/20' : 'hover:bg-secondary'}`}
                                     >
                                       <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-border">
                                         <img src={u.avatarUrl || undefined} alt={u.username} className="w-full h-full object-cover" onError={handleAvatarError} />
                                       </div>
                                       <div className="flex-1 min-w-0">
                                         <div className="text-xs font-bold text-foreground truncate flex items-center gap-1">
                                           {u.username}
                                           {u.isVerified && <span className="text-blue-500">✓</span>}
                                         </div>
                                         <div className="text-[10px] text-muted-foreground truncate">{u.displayName}</div>
                                       </div>
                                       {isSelected && (
                                         <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-black">✓</div>
                                       )}
                                     </button>
                                   );
                                 })}
                                 
                                 {showCustomAdd && (
                                   <button 
                                     onClick={() => {
                                       const handle = '@' + mentionSearch.replace('@', '').trim();
                                       setCaption(prev => (prev.trim() + ' ' + handle).trim() + ' ');
                                       setMentionSearch('');
                                     }}
                                     className="flex items-center gap-2.5 w-full p-2 rounded-lg text-left hover:bg-secondary border border-dashed border-border"
                                   >
                                     <div className="w-7 h-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">@</div>
                                     <div className="flex-1 min-w-0">
                                       <div className="text-xs font-bold text-primary">Mention custom user</div>
                                       <div className="text-[10px] text-muted-foreground truncate">@{mentionSearch.replace('@', '').trim()}</div>
                                     </div>
                                   </button>
                                 )}
                                 
                                 {filteredDbUsers.length === 0 && !showCustomAdd && (
                                   <div className="p-4 text-center text-xs text-muted-foreground font-semibold">
                                     No creators found. Type to mention.
                                   </div>
                                 )}
                               </>
                              );
                           })()}
                         </div>
                       </div>
                     )}
                     <button onClick={() => { setCaption(prev => prev + '😊 '); }} className="p-2 hover:bg-secondary rounded-lg transition-colors"><span className="text-xl">😊</span></button>
                     <button onClick={() => { 
                       setShowHashtagList(!showHashtagList);
                       setShowMentionList(false);
                     }} className={`px-3 py-1.5 rounded-lg transition-colors font-semibold text-lg ${showHashtagList ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary text-foreground'}`}>#</button>
                     <button onClick={() => { 
                       setShowMentionList(!showMentionList);
                       setShowHashtagList(false);
                     }} className={`px-3 py-1.5 rounded-lg transition-colors font-semibold text-lg ${showMentionList ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary text-foreground'}`}>@</button>
                                                                 <div className="flex-1 text-right">
                        <span className="text-xs font-medium">{caption.length}/2200</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {createStep === 'share' && (
              <div className="p-8 flex flex-col items-center justify-center min-h-[500px] text-center">
                 <motion.div 
                   initial={{ scale: 0 }}
                   animate={{ scale: 1 }}
                   transition={{ type: "spring", stiffness: 200, damping: 15 }}
                 >
                   <CheckCircle2 className="w-24 h-24 text-green-500 mb-6 mx-auto" />
                 </motion.div>
                 <h2 className="text-2xl font-black mb-2">Your post has been shared.</h2>
                 <p className="text-muted-foreground font-medium">It may take a few moments to appear in your feed.</p>
              </div>
            )}
</CreateModal>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-[72px] lg:w-[244px] h-full border-r border-border bg-background pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] px-3 lg:px-4 shrink-0 transition-all relative z-[150] shadow-2xl overflow-y-auto no-scrollbar">
        {/* Logo */}
        <div className="mb-10 px-2 flex items-center justify-center lg:justify-start">
          <div className="lg:hidden flex">
            <span className="font-black text-xl italic font-serif vibe-gradient-text">I</span>
          </div>
          <div className="hidden lg:flex">
             <AppLogo showText={true} />
          </div>
        </div>

        {/* Desktop Nav Items */}
        <nav className="flex-1 space-y-2 pb-6 overflow-y-auto no-scrollbar">
          <div className="px-3 mb-2 hidden lg:block">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Social</p>
          </div>
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'notifications') db.setHasUnreadNotifications(false);
                  if (item.id === 'messages') db.setUnreadMessagesCount(0);
                  setCurrentTab(item.id as Tab);
                }}
                className={`flex items-center gap-4 w-full p-2 hover:text-foreground transition-colors group ${isActive ? 'text-foreground font-bold' : 'text-muted-foreground font-medium'}`}
              >
                <div className="relative">
                  <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-secondary text-foreground' : 'bg-muted group-hover:bg-foreground group-hover:text-background'}`}>
                    <Icon className={`w-5 h-5 transition-transform group-hover:scale-105 stroke-[2px]`} />
                  </div>
                  {item.id === 'notifications' && db.hasUnreadNotifications && (
                    <div className="absolute top-1 right-1 w-2.5 h-2.5 border-2 border-background bg-red-500 rounded-full"></div>
                  )}
                  {item.id === 'messages' && db.unreadMessagesCount > 0 && (
                    <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-1 rounded-full border-2 border-background">{db.unreadMessagesCount}</div>
                  )}
                </div>
                <span className="hidden lg:block text-[15px]">{item.label}</span>
              </button>
            );
          })}
          
          <button
            onClick={() => { setShowCreateMenu(true); setCreateType('post'); setCreateStep('upload'); }}
            className={`flex items-center gap-4 w-full p-2 hover:text-foreground transition-colors group text-muted-foreground font-medium`}
          >
            <div className={`p-2 rounded-xl transition-colors bg-muted group-hover:bg-foreground group-hover:text-background`}>
              <PlusSquare className={`w-5 h-5 transition-transform group-hover:scale-105 stroke-[2px]`} />
            </div>
            <span className="hidden lg:block text-[15px]">Creator</span>
          </button>

          <button
            onClick={() => setCurrentTab('profile')}
            className={`flex items-center gap-4 w-full p-2 hover:text-foreground transition-colors group ${currentTab === 'profile' ? 'text-foreground font-bold' : 'text-muted-foreground font-medium'}`}
          >
            <div className={`w-9 h-9 rounded-xl overflow-hidden border-2 transition-colors ${currentTab === 'profile' ? 'border-primary' : 'border-transparent'}`}>
              <img src={currentUser.avatarUrl || undefined} alt="profile" className="w-full h-full object-cover" onError={handleAvatarError} />
            </div>
            <span className="hidden lg:block text-[15px]">Profile</span>
          </button>

          <div className="pt-6 pb-2 px-3 hidden lg:block">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider flex items-center gap-2">Apps & Hub</p>
          </div>

          {appNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id as Tab)}
                className={`flex items-center gap-4 w-full p-2 hover:text-foreground transition-colors group ${isActive ? 'text-foreground font-bold' : 'text-muted-foreground font-medium'}`}
              >
                <div className="relative">
                  <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-primary/20 text-primary' : 'bg-muted group-hover:bg-primary group-hover:text-primary-foreground'}`}>
                    <Icon className={`w-5 h-5 transition-transform group-hover:scale-105 stroke-[2px]`} />
                  </div>
                </div>
                <span className="hidden lg:block text-[15px]">{item.label}</span>
              </button>
            );
          })}

          <button onClick={() => setShowMarketplace(true)} className="flex items-center gap-4 w-full p-2 hover:text-foreground text-muted-foreground font-medium transition-colors group">
            <div className={`p-2 rounded-xl transition-colors ${showMarketplace ? 'bg-primary/20 text-primary' : 'bg-muted group-hover:bg-primary group-hover:text-primary-foreground'}`}>
              <Store className="w-5 h-5 stroke-[2px]" />
            </div>
            <span className="hidden lg:block text-[15px]">Marketplace</span>
          </button>
        </nav>

        {/* Bottom Menu Button */}
        <div className="mt-auto space-y-2 pt-4 border-t border-border">
          <button onClick={() => {
            db.updateSettings({ theme: db.settings.theme === 'dark' ? 'light' : 'dark' });
          }} className="flex items-center gap-4 w-full p-2 hover:text-foreground text-muted-foreground font-medium transition-colors group">
            <div className="p-2 rounded-xl bg-muted group-hover:bg-foreground group-hover:text-background transition-colors">
              <Menu className="w-5 h-5 stroke-[2px]" />
            </div>
            <span className="hidden lg:block text-[15px]">Toggle Theme</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative z-10 overflow-x-hidden overflow-y-hidden min-h-0">
        
        {/* Mobile Top Header */}
        {currentTab !== 'messages' && (
          <div className={`mobile-top-nav md:hidden sticky top-0 left-0 w-full pt-safe z-[150] border-b flex flex-col shrink-0 ${currentTab === 'reels' ? 'bg-black text-white border-white/10' : 'bg-background border-border shadow-md'}`}>
             <div className="h-[60px] flex items-center justify-between px-4 w-full">
               <button onClick={() => setCurrentTab('home')}>
                 <AppLogo className="scale-75 origin-left" />
               </button>
               <div className={`flex items-center gap-4 ${currentTab === 'reels' ? 'text-white' : 'text-foreground'}`}>
                  <button onClick={() => setCurrentTab('notifications')} className="relative p-1">
                    <Bell className={`w-6 h-6 stroke-[1.5px] ${currentTab === 'notifications' ? 'stroke-[2.5px]' : ''}`} />
                    <div className="absolute top-1 right-1 w-2.5 h-2.5 border-2 border-background bg-red-500 rounded-full"></div>
                  </button>
                  <button onClick={() => setCurrentTab('messages')} className="relative p-1 mt-1">
                     <MessageCircle className="w-6 h-6 stroke-[1.5px]" />
                     <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-1 rounded-full border-2 border-background">3</div>
                  </button>
                  <button onClick={() => setShowMobileMenu(true)} className="p-1">
                     <Menu className="w-6 h-6 stroke-[1.5px]" />
                  </button>
               </div>
             </div>
          </div>
        )}

        <main className={`flex-1 flex flex-col relative w-full pt-[env(safe-area-inset-top)] bg-transparent ${currentTab === 'messages' ? 'overflow-hidden h-full pb-0' : currentTab === 'reels' ? 'overflow-y-auto overflow-x-hidden no-scrollbar pb-0 bg-black' : 'overflow-y-auto overflow-x-hidden no-scrollbar pb-[calc(50px_+_env(safe-area-inset-bottom))] md:pb-[max(1.5rem,env(safe-area-inset-bottom))]'}`}>
          <div className={`w-full flex-1 flex flex-col bg-transparent ${currentTab === 'messages' ? 'h-full justify-stretch items-stretch overflow-hidden' : 'items-center'}`}>
               {children}
          </div>
        </main>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {showMobileMenu && (
          <div id="mobile-menu-modal" className="md:hidden fixed inset-0 z-[200] flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowMobileMenu(false)}
              className="absolute inset-0 bg-background/60 backdrop-blur-sm"
            ></motion.div>
            
            <motion.div 
              initial={{ x: '100%' }} 
              animate={{ x: 0 }} 
              exit={{ x: '100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-[300px] h-full bg-card shadow-2xl border-l border-border pt-safe pb-safe flex flex-col"
            >
               <div className="px-6 pb-6 border-b border-border mb-4 flex items-center justify-between">
                  <h3 className="font-bold text-xl">Menu</h3>
                  <button onClick={() => setShowMobileMenu(false)} className="text-muted-foreground hover:text-foreground font-bold"><X className="w-6 h-6" /></button>
               </div>
               
               <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-6">
                 {mainNavItems.map((item) => {
                   const Icon = item.icon;
                   const isActive = currentTab === item.id;
                   return (
                     <button
                       key={item.id}
                       onClick={() => {
                         if (item.id === 'notifications') db.setHasUnreadNotifications(false);
                         if (item.id === 'messages') db.setUnreadMessagesCount(0);
                         setCurrentTab(item.id as Tab);
                         setShowMobileMenu(false);
                       }}
                       className={`flex items-center gap-4 w-full p-4 rounded-xl hover:bg-secondary font-bold transition-colors relative ${isActive ? 'bg-secondary text-primary' : 'text-foreground'}`}
                     >
                       <Icon className="w-6 h-6" /> 
                       {item.label}
                       {item.id === 'notifications' && db.hasUnreadNotifications && (
                         <div className="absolute left-[34px] top-4 w-2.5 h-2.5 border-2 border-background bg-red-500 rounded-full"></div>
                       )}
                       {item.id === 'messages' && db.unreadMessagesCount > 0 && (
                         <div className="absolute left-10 top-3 bg-red-500 text-white text-[10px] font-bold px-1 rounded-full border-2 border-background">{db.unreadMessagesCount}</div>
                       )}
                     </button>
                   );
                 })}
                 
                 <button onClick={() => { setShowMobileMenu(false); setShowCreateMenu(true); setCreateType('post'); setCreateStep('upload'); }} className="flex items-center gap-4 w-full p-4 rounded-xl hover:bg-secondary font-bold transition-colors text-foreground">
                   <PlusSquare className="w-6 h-6 text-foreground" /> Creator
                 </button>
                 
                 <button onClick={() => { setShowMobileMenu(false); setCurrentTab('profile'); }} className="flex items-center gap-4 w-full p-4 rounded-xl hover:bg-secondary font-bold transition-colors text-foreground">
                   <div className={`w-6 h-6 rounded-full overflow-hidden border ${currentTab === 'profile' ? 'border-primary' : 'border-transparent'}`}>
                     <img src={currentUser.avatarUrl || undefined} alt="profile" className="w-full h-full object-cover" onError={handleAvatarError} />
                   </div> Profile
                 </button>

                 <div className="pt-6 pb-2 px-2">
                    <p className="text-[11px] font-black uppercase text-muted-foreground tracking-wider">Apps & Hub</p>
                 </div>

                 {appNavItems.map((item) => {
                   const Icon = item.icon;
                   const isActive = currentTab === item.id;
                   return (
                     <button
                       key={item.id}
                       onClick={() => {
                         setCurrentTab(item.id as Tab);
                         setShowMobileMenu(false);
                       }}
                       className={`flex items-center gap-4 w-full p-4 rounded-xl hover:bg-primary/10 font-bold transition-colors relative ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-primary'}`}
                     >
                       <Icon className="w-6 h-6" /> 
                       {item.label}
                     </button>
                   );
                 })}

                 <button onClick={() => { setShowMobileMenu(false); setShowMarketplace(true); }} className="flex items-center gap-4 w-full p-4 rounded-xl hover:bg-primary/10 font-bold transition-colors text-muted-foreground hover:text-primary">
                   <Store className="w-6 h-6" /> Marketplace
                 </button>
                 
                 <div className="border-t border-border pt-2 mt-4">
                     <button onClick={() => {
                       db.updateSettings({ theme: db.settings.theme === 'dark' ? 'light' : 'dark' });
                       setShowMobileMenu(false);
                     }} className="flex items-center gap-4 w-full p-4 rounded-xl hover:bg-secondary font-bold transition-colors text-foreground">
                       <Menu className="w-6 h-6 text-foreground" /> Toggle Theme
                     </button>
                 </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation */}
      {currentTab !== 'messages' && currentTab !== 'reels' && (
        <div className="mobile-bottom-nav md:hidden fixed bottom-0 left-0 w-full min-h-[50px] pt-1 pb-safe bg-background border-border border-t flex items-center justify-around z-[150] px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <button onClick={() => setCurrentTab('home')} className="p-2">
            <Home className={`w-6 h-6 ${currentTab === 'home' ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`} />
          </button>
          <button onClick={() => setCurrentTab('search')} className="p-2">
            <Search className={`w-6 h-6 ${currentTab === 'search' ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`} />
          </button>
          <button onClick={() => { setShowCreateMenu(true); setCreateType('post'); setCreateStep('upload'); }} className="p-2">
            <PlusSquare className={`w-6 h-6 stroke-[1.5px]`} />
          </button>
          <button onClick={() => setCurrentTab('reels')} className="p-2">
            <PlaySquare className="w-6 h-6 stroke-[1.5px]" />
          </button>
          <button onClick={() => setCurrentTab('profile')} className="p-2">
            <div className={`w-7 h-7 rounded-full overflow-hidden ${currentTab === 'profile' ? 'border-foreground border-2' : 'border border-border'}`}>
              <img src={currentUser.avatarUrl || undefined} alt="profile" className="w-full h-full object-cover" onError={handleAvatarError} />
            </div>
          </button>
        </div>
      )}
      <AnimatePresence>
        {isCrossPostModalOpen && (
          <div className="fixed inset-0 bg-background z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0" onClick={() => setIsCrossPostModalOpen(false)}></div>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card w-full max-w-[400px] rounded-[24px] overflow-hidden shadow-2xl border border-border flex flex-col relative z-10"
            >
              <div className="p-6 border-b border-border flex justify-between items-center bg-secondary/30">
                <h3 className="font-bold text-xl">Cross-Post Setup</h3>
                <button onClick={() => setIsCrossPostModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1 bg-background rounded-full"><Plus className="w-5 h-5 rotate-45" /></button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                 {[
                   { id: 'twitter', label: 'Twitter (X)' },
                   { id: 'facebook', label: 'Facebook Page' },
                   { id: 'tumblr', label: 'Tumblr' }
                 ].map(platform => (
                   <div key={platform.id} className="flex justify-between items-center py-2">
                     <span className="font-medium">{platform.label}</span>
                     <button 
                       onClick={() => setCrossPostOptions(prev => ({ ...prev, [platform.id]: !(prev as any)[platform.id] }))}
                       className={`w-12 h-6 rounded-full transition-colors relative ${crossPostOptions[platform.id as keyof typeof crossPostOptions] ? 'bg-primary' : 'bg-secondary'}`}
                     >
                       <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${crossPostOptions[platform.id as keyof typeof crossPostOptions] ? 'left-6' : 'left-0.5'}`} />
                     </button>
                   </div>
                 ))}
                 <button onClick={() => setIsCrossPostModalOpen(false)} className="mt-4 w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90">
                   Save Settings
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <MarketplaceModal 
        showMarketplace={showMarketplace}
        setShowMarketplace={setShowMarketplace}
        activeMktTab={activeMktTab}
        setActiveMktTab={setActiveMktTab}
        handleBuy={handleBuy}
        purchasedItems={purchasedItems}
      />
    </div>
  );
}
