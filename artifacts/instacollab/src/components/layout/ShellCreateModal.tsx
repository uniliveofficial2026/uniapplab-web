import { motion, AnimatePresence } from 'motion/react';
import React, { useEffect, useRef, useState } from 'react';
import { Wand2, ArrowLeft, CheckCircle2, X, Circle } from 'lucide-react';
import { ShareIcon } from '../common/ShareIcon';
import { User } from '../../types';
import { useToast } from '../../lib/ToastContext';
import {
  fileToBase64,
  THEME_ADAPTIVE_TEXT_CLASS,
  THEME_OVERLAY_COLOR,
  normalizeEditorTextColorForSave,
  normalizeOverlayColorForSave,
} from '../../lib/utils';
import { type CustomAudioSelection } from '../common/AudioTrackPicker';
import {
  captureVideoPosterFrame,
  extractAudioCoverFromFile,
  type MediaListItem,
} from '../../lib/mediaCoverArt';
import type { EditorToolTabId } from '../../lib/editorTools';
import {
  DEFAULT_MEDIA_EDITOR_ADJUSTMENTS,
  DEFAULT_TEXT_EDITOR_EXTRAS,
  DEFAULT_VIDEO_EDITOR_ADJUSTMENTS,
  type MediaEditorAdjustments,
  type TextEditorExtras,
  type VideoEditorAdjustments,
} from '../../lib/editorAdjustments';
import { StoryCreatorFlow } from '../stories/StoryCreatorFlow';
import { dispatchOpenStoryCreate } from '../../lib/storyCreateEvents';
import { useDB } from '../../lib/useDB';
import { ShellCreatePostEditor } from './ShellCreatePostEditor';
import { ShellCreateCrossPostModal } from './ShellCreateCrossPostModal';

export type CreateLaunch = {
  type: 'post' | 'reel' | 'text' | 'story';
  step?: 'upload' | 'edit' | 'share';
};

export interface ShellCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: User;
  launch?: CreateLaunch | null;
}

export function ShellCreateModal({ open, onOpenChange, currentUser, launch }: ShellCreateModalProps) {
  const db = useDB();
  const { showToast } = useToast();

  const [createStep, setCreateStep] = useState<'upload' | 'edit' | 'share'>('upload');
  const [createType, setCreateType] = useState<'post' | 'reel' | 'text' | 'story'>('post');
  const [storyCreatorStep, setStoryCreatorStep] = useState<'select' | 'edit' | 'preview'>('select');
  const storyCreatorBackRef = useRef<() => void>(() => {});
  const storyCreatorShareRef = useRef<() => void>(() => {});

  const createTypeTabClass = (active: boolean) =>
    active
      ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30'
      : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/80';

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedIsVideo, setUploadedIsVideo] = useState(false);
  const [uploadedMediaList, setUploadedMediaList] = useState<MediaListItem[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState<number>(0);
  const [caption, setCaption] = useState('');
  const [postLocation, setPostLocation] = useState('');
  const [showHashtagList, setShowHashtagList] = useState(false);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');

  const [videoEditTab, setVideoEditTab] = useState<EditorToolTabId>('none');
  const [textPostFont, setTextPostFont] = useState('font-sans');
  const [textPostBg, setTextPostBg] = useState('bg-gradient-to-br from-indigo-500 to-purple-600');
  const [textPostColor, setTextPostColor] = useState(THEME_ADAPTIVE_TEXT_CLASS);
  const [textPostAlignment, setTextPostAlignment] = useState('text-center');
  const [textPostSizeValue, setTextPostSizeValue] = useState(48);
  const textPostSize = `text-[${textPostSizeValue}px]`;

  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [textOverlay, setTextOverlay] = useState('');
  const [textOverlayColor, setTextOverlayColor] = useState(THEME_OVERLAY_COLOR);
  const [textOverlaySize, setTextOverlaySize] = useState(24);
  const [textOverlayPos, setTextOverlayPos] = useState(50);
  const [audioTrack, setAudioTrack] = useState('none');
  const [backgroundAudio, setBackgroundAudio] = useState<CustomAudioSelection>(null);

  const suggestedHashtags = ['#fyp', '#viral', '#trending', '#explore', '#photography', '#art', '#daily'];
  const [filter, setFilter] = useState('none');
  const [mediaAdjust, setMediaAdjust] = useState<MediaEditorAdjustments>(DEFAULT_MEDIA_EDITOR_ADJUSTMENTS);
  const [videoAdjust, setVideoAdjust] = useState<VideoEditorAdjustments>(DEFAULT_VIDEO_EDITOR_ADJUSTMENTS);
  const [textExtras, setTextExtras] = useState<TextEditorExtras>(DEFAULT_TEXT_EDITOR_EXTRAS);
  const [sticker, setSticker] = useState('');
  const [stickerPos, setStickerPos] = useState(72);
  const [isCrossPostModalOpen, setIsCrossPostModalOpen] = useState(false);
  const [crossPostOptions, setCrossPostOptions] = useState({
    twitter: false,
    facebook: false,
    tumblr: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevOpenRef = useRef(false);

  const openCreator = (type: 'post' | 'reel' | 'text' | 'story' = 'post') => {
    onOpenChange(true);
    const switchingType = createType !== type;
    setCreateType(type);

    if (type === 'story') {
      if (switchingType) {
        setStoryCreatorStep('select');
      }
      setCreateStep('upload');
      return;
    }

    setStoryCreatorStep('select');
    setCreateStep('upload');
    if (type !== 'text') {
      setUploadedMediaList([]);
      setUploadedImage(null);
      setUploadedIsVideo(false);
      setActiveMediaIndex(0);
    }
  };

  const applyLaunch = (type: CreateLaunch['type'], step: 'upload' | 'edit' | 'share' = 'upload') => {
    setCreateType(type);
    if (type === 'story') {
      setStoryCreatorStep('select');
      setCreateStep('upload');
      return;
    }
    setStoryCreatorStep('select');
    setCreateStep(step);
    if (type !== 'text') {
      setUploadedMediaList([]);
      setUploadedImage(null);
      setUploadedIsVideo(false);
      setActiveMediaIndex(0);
    } else if (step === 'edit') {
      setUploadedMediaList([]);
      setUploadedImage(null);
      setUploadedIsVideo(false);
      setActiveMediaIndex(0);
    }
  };

  useEffect(() => {
    if (open && !prevOpenRef.current && launch) {
      applyLaunch(launch.type, launch.step ?? 'upload');
    }
    prevOpenRef.current = open;
  }, [open, launch]);

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
        let coverUrl: string | undefined;
        if (type === 'audio') {
          coverUrl = await extractAudioCoverFromFile(file);
        } else if (type === 'video') {
          coverUrl = await captureVideoPosterFrame(base64);
        }
        newList.push({ url: base64, type, name: file.name, coverUrl });
      }
      if (newList.length > 0) {
        setUploadedMediaList(newList);
        const first = newList[0];
        if (first) {
          setUploadedImage(first.url);
          setUploadedIsVideo(first.type === 'video');
        }
        setActiveMediaIndex(uploadedMediaList.length);
        setCreateStep('edit');
      }
    } catch {
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
    onOpenChange(false);
    setTimeout(() => {
      setCreateStep('upload');
      setCreateType('post');
      setStoryCreatorStep('select');
      setUploadedImage(null);
      setUploadedIsVideo(false);
      setUploadedMediaList([]);
      setActiveMediaIndex(0);
      setCaption('');
      setPostLocation('');
      setFilter('none');
      setMediaAdjust({ ...DEFAULT_MEDIA_EDITOR_ADJUSTMENTS });
      setVideoAdjust({ ...DEFAULT_VIDEO_EDITOR_ADJUSTMENTS });
      setTextExtras({ ...DEFAULT_TEXT_EDITOR_EXTRAS });
      setSticker('');
      setStickerPos(72);
      setBrightness(100);
      setContrast(100);
      setTextOverlay('');
      setTextOverlayColor(THEME_OVERLAY_COLOR);
      setTextOverlaySize(24);
      setTextOverlayPos(50);
      setAudioTrack('none');
      setBackgroundAudio(null);
      setVideoEditTab('none');
    }, 300);
  };

  const resolvePublishedAudioUrl = (
    fallbackIsAudio: boolean,
    fallbackUrl: string
  ): string | undefined => {
    if (backgroundAudio?.url) return backgroundAudio.url;
    if (audioTrack !== 'none') return audioTrack;
    if (fallbackIsAudio && fallbackUrl) return fallbackUrl;
    return undefined;
  };

  const resolvePublishedAudioCoverUrl = (
    fallbackItem: MediaListItem | { url: string; type: 'image' | 'video' | 'audio'; name?: string; coverUrl?: string }
  ): string | undefined => {
    if (backgroundAudio?.coverUrl) return backgroundAudio.coverUrl;
    return fallbackItem?.coverUrl;
  };

  const handleShare = () => {
    setCreateStep('share');
    const newId = `new_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const mediaArray = uploadedMediaList.map((m) => ({
      url: m.url,
      type: m.type,
      name: m.name || '',
      coverUrl: m.coverUrl,
    }));

    const fallbackItem = uploadedMediaList[activeMediaIndex] || uploadedMediaList[0] || { url: uploadedImage, type: uploadedIsVideo ? 'video' : 'image' };
    const fallbackUrl = fallbackItem?.url || uploadedImage || '';
    const fallbackIsVideo = fallbackItem?.type === 'video';
    const fallbackIsAudio = fallbackItem?.type === 'audio';
    const publishedAudioCoverUrl = resolvePublishedAudioCoverUrl(fallbackItem);

    if (createType === 'reel') {
      db.addReel({
        id: newId,
        user: currentUser,
        likes: 0,
        comments: 0,
        shares: 0,
        caption: caption,
        audioUrl:
          resolvePublishedAudioUrl(fallbackIsAudio, fallbackUrl) ??
          'Original Audio - ' + currentUser.username,
        audioCoverUrl: publishedAudioCoverUrl,
        videoUrl: fallbackUrl,
        createdAt: new Date().toISOString(),
        filter,
        brightness,
        contrast,
        textOverlay,
        textOverlayColor: normalizeOverlayColorForSave(textOverlayColor),
        textOverlaySize,
        textOverlayPos,
        mediaList: mediaArray,
        font: textPostFont,
        color: normalizeEditorTextColorForSave(textPostColor),
        alignment: textPostAlignment,
        size: textPostSize,
        bg: textPostBg,
      });
    } else {
      db.addPost({
        id: newId,
        user: currentUser,
        imageUrl: !fallbackIsVideo ? fallbackUrl : '',
        videoUrl: fallbackIsVideo ? fallbackUrl : '',
        audioUrl: resolvePublishedAudioUrl(fallbackIsAudio, fallbackUrl),
        audioCoverUrl: publishedAudioCoverUrl,
        likes: 0,
        comments: 0,
        caption: caption,
        location: postLocation.trim() || undefined,
        createdAt: new Date().toISOString(),
        isLiked: false,
        isSaved: false,
        filter,
        brightness,
        contrast,
        textOverlay,
        textOverlayColor: normalizeOverlayColorForSave(textOverlayColor),
        textOverlaySize,
        textOverlayPos,
        mediaList: mediaArray,
        font: textPostFont,
        color: normalizeEditorTextColorForSave(textPostColor),
        alignment: textPostAlignment,
        size: textPostSize,
        bg: textPostBg,
      });
    }
    setTimeout(() => {
      resetCreatePost();
    }, 2000);
  };

  return (
    <>
    <AnimatePresence>
    {open && (
      <div 
        id="create-modal" 
        className="fixed inset-y-0 right-0 left-0 md:left-[72px] lg:left-[244px] z-50 flex items-center justify-center bg-background"
        onClick={resetCreatePost}
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={`bg-background w-full max-h-[90vh] overflow-y-auto rounded-3xl border border-border shadow-2xl flex flex-col transition-all duration-300 ${
            createType === 'story'
              ? storyCreatorStep !== 'select'
                ? 'max-w-4xl max-h-[92vh]'
                : 'max-w-lg'
              : createStep === 'edit'
                ? 'max-w-4xl'
                : 'max-w-lg'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-12 shrink-0 border-b border-border flex items-center justify-between px-4 sticky top-0 bg-background z-10">
            <div className="w-8 flex items-center">
               {(createStep === 'edit' && createType !== 'story') ||
               (createType === 'story' && storyCreatorStep !== 'select') ? (
                <button
                  type="button"
                  onClick={() => {
                    if (createType === 'story') {
                      storyCreatorBackRef.current();
                      return;
                    }
                    if (createType === 'text') setCreateType('post');
                    setCreateStep('upload');
                  }}
                >
                  <ArrowLeft className="w-6 h-6 hover:text-muted-foreground transition-colors" />
                </button>
              ) : null}
            </div>
          <h2 className="font-bold flex items-center gap-4">
              {createStep !== 'share' && (
                <div
                  className="flex gap-1 bg-secondary/70 p-1.5 rounded-full shadow-inner border border-border/50"
                  role="tablist"
                  aria-label="Create content type"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={createType === 'post'}
                    onClick={() => {
                      if (createType === 'story') setStoryCreatorStep('select');
                      setCreateType('post');
                      if (createStep === 'edit') setCreateStep('upload');
                    }}
                    className={`px-3.5 py-2 rounded-full text-[11px] font-bold transition-all ${createTypeTabClass(createType === 'post')}`}
                  >
                    Photo/Video
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={createType === 'reel'}
                    onClick={() => {
                      if (createType === 'story') setStoryCreatorStep('select');
                      setCreateType('reel');
                      if (createStep === 'edit') setCreateStep('upload');
                    }}
                    className={`px-3.5 py-2 rounded-full text-[11px] font-bold transition-all ${createTypeTabClass(createType === 'reel')}`}
                  >
                    Reel
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={createType === 'text'}
                    onClick={() => {
                      if (createType === 'story') setStoryCreatorStep('select');
                      setCreateType('text');
                      setUploadedMediaList([]);
                      setUploadedImage(null);
                      setUploadedIsVideo(false);
                      setActiveMediaIndex(0);
                      setCreateStep('edit');
                    }}
                    className={`px-3.5 py-2 rounded-full text-[11px] font-bold transition-all ${createTypeTabClass(createType === 'text')}`}
                  >
                    Text
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={createType === 'story'}
                    onClick={() => {
                      if (createType === 'story') return;
                      openCreator('story');
                    }}
                    className={`px-3.5 py-2 rounded-full text-[11px] font-bold transition-all inline-flex items-center gap-1 ${createTypeTabClass(createType === 'story')}`}
                  >
                    <Circle className="w-3 h-3" strokeWidth={2.5} />
                    Story
                  </button>
                </div>
              )}
              {createStep === 'share' && 'Shared!'}
            </h2>
            <div className="w-8 flex justify-end">
              {(createType !== 'story' && createStep === 'edit') ||
              (createType === 'story' && storyCreatorStep !== 'select') ? (
                <button
                  type="button"
                  onClick={() => {
                    if (createType === 'story') {
                      storyCreatorShareRef.current();
                      return;
                    }
                    handleShare();
                  }}
                  className="text-primary font-bold hover:text-primary/80 transition-colors"
                >
                  Share
                </button>
              ) : (
                <button onClick={resetCreatePost} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-6 h-6" /></button>
              )}
            </div>
          </div>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*,video/*,audio/*" 
            multiple
            className="hidden" 
          />
          
          {createType === 'story' && (
            <StoryCreatorFlow
              userId={currentUser.id}
              username={currentUser.username}
              avatarUrl={currentUser.avatarUrl}
              layout="embedded"
              showCloseButton={false}
              onClose={resetCreatePost}
              onStepChange={setStoryCreatorStep}
              registerBackHandler={(fn) => {
                storyCreatorBackRef.current = fn;
              }}
              registerShareHandler={(fn) => {
                storyCreatorShareRef.current = fn;
              }}
              onShared={(segmentIndex) => {
                resetCreatePost();
                dispatchOpenStoryCreate({ viewSegmentIndex: segmentIndex });
              }}
            />
          )}

          {createType !== 'story' && createStep === 'upload' && (
            <div 
              className="p-8 flex flex-col items-center justify-center min-h-[500px]"
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
              <button onClick={triggerFileUpload} className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors active:scale-95">
                Select from computer
              </button>

               <div className="flex items-center gap-6 mt-10 pt-10 border-t border-border w-full text-sm font-semibold text-muted-foreground justify-center">
                <span onClick={() => { 
                  setFilter(prev => prev === 'none' ? 'sepia' : prev === 'sepia' ? 'grayscale' : prev === 'grayscale' ? 'blur' : 'none'); 
                  showToast('Filter applied'); 
                }} className="flex items-center gap-2 hover:text-foreground cursor-pointer transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary"><Wand2 className="w-4 h-4" /> Apply AI Filters</span>
                <span onClick={() => setIsCrossPostModalOpen(true)} className="flex items-center gap-2 hover:text-foreground cursor-pointer transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary"><ShareIcon size="xs" tone="inherit" className="text-current" /> Cross-post Setup</span>
              </div>
            </div>
          )}

          {createType !== 'story' && createStep === 'edit' && (
            <ShellCreatePostEditor
              createType={createType}
              currentUser={currentUser}
              users={db.users}
              uploadedMediaList={uploadedMediaList}
              onUploadedMediaListChange={setUploadedMediaList}
              activeMediaIndex={activeMediaIndex}
              onActiveMediaIndexChange={setActiveMediaIndex}
              uploadedIsVideo={uploadedIsVideo}
              caption={caption}
              onCaptionChange={setCaption}
              location={postLocation}
              onLocationChange={setPostLocation}
              showHashtagList={showHashtagList}
              onShowHashtagListChange={setShowHashtagList}
              showMentionList={showMentionList}
              onShowMentionListChange={setShowMentionList}
              mentionSearch={mentionSearch}
              onMentionSearchChange={setMentionSearch}
              videoEditTab={videoEditTab}
              onVideoEditTabChange={setVideoEditTab}
              textPostFont={textPostFont}
              onTextPostFontChange={setTextPostFont}
              textPostBg={textPostBg}
              onTextPostBgChange={setTextPostBg}
              textPostColor={textPostColor}
              onTextPostColorChange={setTextPostColor}
              textPostAlignment={textPostAlignment}
              onTextPostAlignmentChange={setTextPostAlignment}
              textPostSizeValue={textPostSizeValue}
              onTextPostSizeValueChange={setTextPostSizeValue}
              textPostSize={textPostSize}
              trimStart={trimStart}
              onTrimStartChange={setTrimStart}
              trimEnd={trimEnd}
              onTrimEndChange={setTrimEnd}
              brightness={brightness}
              onBrightnessChange={setBrightness}
              contrast={contrast}
              onContrastChange={setContrast}
              textOverlay={textOverlay}
              onTextOverlayChange={setTextOverlay}
              textOverlaySize={textOverlaySize}
              textOverlayPos={textOverlayPos}
              onTextOverlayPosChange={setTextOverlayPos}
              audioTrack={audioTrack}
              onAudioTrackChange={setAudioTrack}
              backgroundAudio={backgroundAudio}
              onBackgroundAudioChange={setBackgroundAudio}
              filter={filter}
              onFilterChange={setFilter}
              mediaAdjust={mediaAdjust}
              onMediaAdjustChange={(patch) => {
                setMediaAdjust((prev) => ({ ...prev, ...patch }));
                if (patch.brightness !== undefined) setBrightness(patch.brightness);
                if (patch.contrast !== undefined) setContrast(patch.contrast);
              }}
              videoAdjust={videoAdjust}
              onVideoAdjustChange={(patch) => setVideoAdjust((prev) => ({ ...prev, ...patch }))}
              textExtras={textExtras}
              onTextExtrasChange={(patch) => setTextExtras((prev) => ({ ...prev, ...patch }))}
              sticker={sticker}
              onStickerChange={setSticker}
              stickerPos={stickerPos}
              onStickerPosChange={setStickerPos}
              suggestedHashtags={suggestedHashtags}
              onResetCreatePost={resetCreatePost}
              onTriggerFileUpload={triggerFileUpload}
            />
          )}

          {createType !== 'story' && createStep === 'share' && (
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
        </motion.div>
      </div>
    )}
    </AnimatePresence>
      <ShellCreateCrossPostModal
        open={isCrossPostModalOpen}
        onOpenChange={setIsCrossPostModalOpen}
        crossPostOptions={crossPostOptions}
        onCrossPostOptionsChange={setCrossPostOptions}
      />
    </>
  );
}
