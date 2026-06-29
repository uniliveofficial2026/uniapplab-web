import React from 'react';
import { FileText, Image, MapPin, Mic, Music, Plus, Send, Smile, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { safeMediaUrl } from '../../lib/safe';
import { handleMediaError } from '../../lib/utils';
import { formatChatFileSize } from './messages/chatFileUtils';
import { ChatInlineVideo } from './ChatInlineVideo';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { Waveform } from './Waveform';
import type { MessagesComposeBarProps } from './messages/composeBarProps';

export function MessagesComposeBar(props: MessagesComposeBarProps) {
  const {
    chatMedia,
    setChatMedia,
    selectedMessageKeys,
    setSelectedMessageKeys,
    currentMessages,
    replyToMessage,
    setReplyToMessage,
    replyToMessages,
    setReplyToMessages,
    editingMessageIndex,
    setEditingMessageIndex,
    showAttachmentMenu,
    setShowAttachmentMenu,
    messageText,
    setMessageText,
    onComposeTypingChange,
    showEmojiPicker,
    setShowEmojiPicker,
    isRecording,
    recordedVoice,
    isListening,
    tokenSuggestion,
    activeSuggestions,
    activeTokenIndex,
    setActiveTokenIndex,
    messageInputRef,
    inlineVideoRefs,
    onSendMessage,
    onToggleSelectAllMessages,
    onSelectionCopy,
    onSelectionPin,
    onSelectionReply,
    onSelectionForward,
    onSelectionDeleteForMe,
    onSelectionDeleteForEveryone,
    onMediaUpload,
    onFileUploadMenu,
    onMusicUpload,
    onLocationShare,
    onOpenFilePreview,
    tryOpenMediaFullscreen,
    setFullscreenMedia,
    clearRecording,
    showToast,
    handleMicDown,
    handleMicUp,
    updateTokenSuggestion,
    insertTokenSuggestion,
    setTokenSuggestion,
  } = props;

  return (
    <div className="p-4 sm:p-6 pt-2 shrink-0 bg-background w-full z-20">
    <div className="flex flex-col gap-2">
       {chatMedia.length > 0 && (
          <div className="flex gap-2 overflow-x-auto py-2">
            {chatMedia.map((media, idx) => (
              <div
                key={idx}
                className="relative inline-block border border-border rounded-lg max-w-[100px] h-20 group shrink-0 overflow-hidden"
              >
                {media.isVideo ? (
                  <ChatInlineVideo
                    src={media.url}
                    className="w-full h-full relative"
                    videoClassName="w-full h-full object-cover bg-black/10"
                    poster="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150"
                    onError={handleMediaError}
                    visibilityAutoplay={false}
                    onRegisterRef={(el) => {
                      const key = `compose-${idx}`;
                      if (el) inlineVideoRefs.current.set(key, el);
                      else inlineVideoRefs.current.delete(key);
                    }}
                    overlay={
                      <button type="button" onClick={() => tryOpenMediaFullscreen(chatMedia, idx, `compose-${idx}`)} className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-white/50 backdrop-blur-md flex items-center justify-center shadow-lg">
                          <div className="text-white translate-x-[1px] text-sm drop-shadow-md">▶</div>
                        </div>
                      </button>
                    }
                  />
                ) : media.isFile ? (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenFilePreview({
                        url: media.url,
                        name: media.name,
                        isFile: true,
                        mimeType: media.mimeType,
                        size: media.size,
                      })
                    }
                    className="w-full h-full bg-secondary flex flex-col items-center justify-center p-2 gap-1 hover:bg-secondary/80 transition-colors"
                  >
                    <FileText className="w-7 h-7 text-orange-600 dark:text-orange-300 shrink-0" />
                    <span className="text-[9px] font-bold text-center leading-tight line-clamp-2 px-1">
                      {media.name || 'File'}
                    </span>
                    {media.size ? (
                      <span className="text-[8px] text-muted-foreground tabular-nums">
                        {formatChatFileSize(media.size)}
                      </span>
                    ) : null}
                    <span className="text-[8px] font-semibold text-primary">View</span>
                  </button>
                ) : media.isAudio ? (
                   <div className="w-full h-full bg-secondary flex items-center justify-center p-2">
                     <div className="w-full h-full rounded-lg bg-primary/20 flex items-center justify-center relative overflow-hidden group-hover:scale-110 transition-transform">
                        <Music className="w-8 h-8 text-primary animate-pulse" />
                     </div>
                   </div>
                 ) : (
                  <img
                    src={safeMediaUrl(media.url) || undefined}
                    className="w-full h-full object-cover cursor-pointer"
                    onError={handleMediaError}
                    onClick={() => setFullscreenMedia({ items: chatMedia, mediaIndex: idx })}
                  />
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setChatMedia((prev) =>
                      prev.filter((_, i) => i !== idx),
                    );
                  }}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-sm hover:bg-black/80 transition-colors z-20"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
       )}
       {selectedMessageKeys.length > 0 && (
         <div data-selector-panel="true" className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-2">
           <div className="flex items-center justify-between">
             <span className="text-[12px] font-semibold text-muted-foreground">
               {selectedMessageKeys.length} message{selectedMessageKeys.length > 1 ? 's' : ''} selected
             </span>
             <button
               type="button"
               onClick={() => setSelectedMessageKeys([])}
               className="text-[12px] font-semibold text-primary hover:opacity-80 transition-opacity"
             >
               Clear
             </button>
           </div>
           <div className="flex flex-wrap gap-1.5">
             <button type="button" onClick={onToggleSelectAllMessages} className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-border bg-background hover:bg-secondary transition-colors">
               {selectedMessageKeys.length >= currentMessages.length && currentMessages.length > 0 ? 'Deselect all' : 'Select all'}
             </button>
             <button type="button" onClick={onSelectionCopy} className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-border bg-background hover:bg-secondary transition-colors">
               Copy
             </button>
             <button type="button" onClick={onSelectionPin} className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-border bg-background hover:bg-secondary transition-colors">
               Pin
             </button>
             <button type="button" onClick={onSelectionReply} className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-border bg-background hover:bg-secondary transition-colors">
               Reply
             </button>
             <button type="button" onClick={onSelectionForward} className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-border bg-background hover:bg-secondary transition-colors">
               Forward
             </button>
             <button type="button" onClick={onSelectionDeleteForMe} className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-border bg-background hover:bg-secondary transition-colors">
               Delete for me
             </button>
             <button type="button" onClick={onSelectionDeleteForEveryone} className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-border bg-background hover:bg-secondary transition-colors">
               Delete for everyone
             </button>
           </div>
         </div>
       )}
       {replyToMessage && (
         <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/60 px-3 py-2 text-[12px]">
           <span className="truncate font-medium text-muted-foreground">
             Replying to: {replyToMessage.text}
           </span>
           <button
             type="button"
             onClick={() => setReplyToMessage(null)}
             className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
           >
             <X className="w-4 h-4" />
           </button>
         </div>
       )}
       {replyToMessages.length > 0 && (
         <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/60 px-3 py-2 text-[12px]">
           <span className="truncate font-medium text-muted-foreground">
             Replying to {replyToMessages.length} selected messages
           </span>
           <button
             type="button"
             onClick={() => setReplyToMessages([])}
             className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
           >
             <X className="w-4 h-4" />
           </button>
         </div>
       )}
       {editingMessageIndex !== null && (
         <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-[12px]">
           <span className="truncate font-semibold text-primary">
             Editing message
           </span>
           <button
             type="button"
             onClick={() => {
               setEditingMessageIndex(null);
               setMessageText('');
             }}
             className="ml-2 text-primary/80 hover:text-primary transition-colors"
           >
             Cancel
           </button>
         </div>
       )}
       <form onSubmit={onSendMessage} className="flex items-center border border-border/60 rounded-full px-4 py-2.5 sm:px-5 sm:py-3.5 gap-2 sm:gap-4 bg-background/80 backdrop-blur-md focus-within:bg-card focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/20 transition-all shadow-[0_-4px_20_rgba(0,0,0,0.03)] relative">
            <div className="relative shrink-0">
              <button 
                type="button"
                onClick={() => {
                  setShowEmojiPicker(false);
                  setShowAttachmentMenu(!showAttachmentMenu);
                }}
                data-attachment-menu-button="true"
                className={`cursor-pointer text-foreground hover:scale-110 transition-transform w-8 h-8 flex items-center justify-center shrink-0 bg-secondary/50 rounded-full hover:bg-secondary ${showAttachmentMenu ? 'bg-primary text-primary-foreground' : ''}`}
              >
                <Plus className={`w-5 h-5 sm:w-5 sm:h-5 transition-transform ${showAttachmentMenu ? 'rotate-45' : ''}`} />
              </button>
              
              <AnimatePresence>
                {showAttachmentMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowAttachmentMenu(false)}></div>
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.5, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.5, y: 20 }}
                      data-attachment-menu-panel="true"
                      className="absolute bottom-full left-0 mb-4 w-52 bg-white/75 dark:bg-zinc-900/75 backdrop-blur-xl border border-black/10 dark:border-white/15 rounded-3xl shadow-2xl overflow-hidden z-20"
                    >
                      <div className="p-2 flex flex-col gap-1">
                        <button 
                          type="button" 
                          onClick={() => { document.getElementById('chat-media-photo')?.click(); setShowAttachmentMenu(false); }}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-secondary rounded-2xl transition-colors text-sm font-bold w-full text-left"
                        >
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <Image className="w-4 h-4 text-blue-600" />
                          </div>
                          Photo & Video
                        </button>
                        <button 
                          type="button" 
                          onClick={() => { document.getElementById('chat-media-file')?.click(); setShowAttachmentMenu(false); }}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-secondary rounded-2xl transition-colors text-sm font-bold w-full text-left"
                        >
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                            <FileText className="w-4 h-4 text-orange-600" />
                          </div>
                          Document/File
                        </button>
                        <button 
                          type="button" 
                          onClick={() => { document.getElementById('chat-media-music')?.click(); setShowAttachmentMenu(false); }}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-secondary rounded-2xl transition-colors text-sm font-bold w-full text-left"
                        >
                          <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center">
                            <Music className="w-4 h-4 text-pink-600" />
                          </div>
                          Music/Audio
                        </button>
                        <button 
                          type="button" 
                          onClick={onLocationShare}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-secondary rounded-2xl transition-colors text-sm font-bold w-full text-left"
                        >
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-green-600" />
                          </div>
                          Location
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="w-px h-5 bg-border shrink-0 mx-1"></div>
             {isRecording ? (
               <div className="flex-1 flex items-center gap-3 px-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-semibold text-red-500">Recording...</span>
                  <div className="flex-1 overflow-hidden">
                    <Waveform isPlaying={true} color="bg-red-500" />
                  </div>
               </div>
             ) : recordedVoice ? (
               <div className="flex items-center gap-2 bg-secondary rounded-full px-3 py-1 flex-1">
                  <VoiceMessagePlayer
                    url={recordedVoice}
                    color="secondary"
                    onReRecord={() => {
                      clearRecording();
                      showToast('Voice cleared. Record again.');
                    }}
                  />
                  <div className="ml-auto">
                    <button type="button" onClick={clearRecording} className="text-muted-foreground hover:text-foreground transition-colors p-1"><X className="w-4 h-4" /></button>
                  </div>
               </div>
            ) : (
              <div className="flex-1 min-w-0 relative">
                {tokenSuggestion && activeSuggestions.length > 0 && (
                  <div className="absolute bottom-full mb-2 left-0 right-0 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl overflow-hidden">
                    {activeSuggestions.map((suggestion, suggestionIndex) => {
                      const preview = tokenSuggestion.type === 'mention' ? `@${suggestion}` : `#${suggestion}`;
                      return (
                        <button
                          key={`${tokenSuggestion.type}-${suggestion}-${suggestionIndex}`}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            insertTokenSuggestion(suggestion);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors text-foreground ${suggestionIndex === activeTokenIndex ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/80'}`}
                        >
                          {preview}
                        </button>
                      );
                    })}
                  </div>
                )}
                <input
                  ref={messageInputRef}
                  type="text"
                  value={messageText}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setMessageText(nextValue);
                    onComposeTypingChange?.(nextValue.trim().length > 0);
                    updateTokenSuggestion(nextValue, e.target.selectionStart ?? nextValue.length);
                  }}
                  onClick={(e) => {
                    const input = e.currentTarget;
                    updateTokenSuggestion(input.value, input.selectionStart ?? input.value.length);
                  }}
                  onKeyDown={(e) => {
                    if (!tokenSuggestion || activeSuggestions.length === 0) return;
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setActiveTokenIndex((prev) => (prev + 1) % activeSuggestions.length);
                      return;
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActiveTokenIndex((prev) => (prev - 1 + activeSuggestions.length) % activeSuggestions.length);
                      return;
                    }
                    if (e.key === 'Enter' || e.key === 'Tab') {
                      e.preventDefault();
                      insertTokenSuggestion(activeSuggestions[activeTokenIndex] || activeSuggestions[0]);
                      return;
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setTokenSuggestion(null);
                      setActiveTokenIndex(0);
                    }
                  }}
                  onBlur={() => {
                    onComposeTypingChange?.(false);
                    window.setTimeout(() => {
                      setTokenSuggestion(null);
                      setActiveTokenIndex(0);
                    }, 120);
                  }}
                  placeholder={isListening ? "Listening..." : editingMessageIndex !== null ? "Edit message..." : "Type a message..."}
                  className="w-full bg-transparent border-none outline-none text-[14px] sm:text-[15px] font-medium min-w-0 placeholder:text-muted-foreground/70"
                />
              </div>
            )}
           <div className="flex items-center shrink-0">
             <div className="relative">
               <button
                 type="button"
                 onClick={() => {
                   setShowAttachmentMenu(false);
                   setShowEmojiPicker(!showEmojiPicker);
                 }}
                data-main-emoji-button="true"
                 className={`text-foreground hover:scale-110 transition-transform flex items-center justify-center w-8 h-8 rounded-full hover:bg-secondary shrink-0 cursor-pointer ${
                   showEmojiPicker ? 'bg-primary text-primary-foreground' : ''
                 }`}
               >
                 <Smile className="w-5 h-5" />
               </button>

               {showEmojiPicker && (
                 <>
                   {/* Mobile Backdrop & Full Bottom Panel */}
                   <div
                     className="fixed inset-0 bg-background z-[150] md:hidden block pointer-events-auto"
                     onClick={() => setShowEmojiPicker(false)}
                   />
                  <div data-main-emoji-panel="true" className="fixed bottom-0 left-0 right-0 h-[60vh] bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-t-[32px] border-t border-border z-[160] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300 md:hidden block pointer-events-auto emoji-glass-sheet">
                     <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/10 shrink-0">
                       <span className="font-bold text-base">Select Emojis</span>
                       <button
                         type="button"
                         onClick={() => setShowEmojiPicker(false)}
                         className="px-4 py-1.5 bg-primary text-primary-foreground font-bold rounded-full text-sm hover:opacity-90 transition-opacity"
                       >
                         Done
                       </button>
                     </div>
                     <div className="flex-1 w-full overflow-hidden">
                       <EmojiPicker
                         onEmojiClick={(emoji) => {
                           setMessageText((prev) => prev + emoji.emoji);
                         }}
                         width="100%"
                         height="100%"
                         previewConfig={{ showPreview: false }}
                         theme={Theme.AUTO}
                       />
                     </div>
                   </div>

                   {/* Desktop Popover */}
                  <div data-main-emoji-panel="true" className="absolute bottom-full right-0 mb-2 z-[60] hidden md:block animate-in fade-in duration-200 pointer-events-auto emoji-glass-popover">
                     <EmojiPicker
                       onEmojiClick={(emoji) => {
                         setMessageText((prev) => prev + emoji.emoji);
                       }}
                       previewConfig={{ showPreview: false }}
                       theme={Theme.AUTO}
                     />
                   </div>
                 </>
               )}
</div>

             <input type="file" id="chat-media-photo" className="hidden" accept="image/*,video/*" multiple onChange={onMediaUpload} />
             <input
               type="file"
               id="chat-media-file"
               className="hidden"
               accept="*/*"
               onChange={onFileUploadMenu}
             />
             <input type="file" id="chat-media-music" className="hidden" accept="audio/*" multiple onChange={onMusicUpload} />
             <button
               type="button"
              onMouseDown={handleMicDown}
              onMouseUp={handleMicUp}
              onMouseLeave={handleMicUp}
              onTouchStart={handleMicDown}
              onTouchEnd={handleMicUp}
              onTouchCancel={handleMicUp}
               className={`text-foreground hover:scale-110 transition-transform flex items-center justify-center w-8 h-8 rounded-full hover:bg-secondary shrink-0 cursor-pointer ${
                 isRecording ? 'bg-red-500 text-white animate-pulse' : isListening ? 'bg-primary text-primary-foreground animate-pulse' : ''
               }`}
             >
               <Mic className="w-5 h-5" />
             </button>
             {messageText.trim() || chatMedia.length > 0 || recordedVoice ? (
               <button type="submit" className="text-primary font-bold hover:scale-110 transition-transform flex items-center justify-center bg-primary text-primary-foreground p-2 rounded-full shrink-0 shadow-md ml-2">
                 <Send className="w-4 h-4 sm:w-4 sm:h-4 text-primary-foreground" />
               </button>
             ) : null}
           </div>
       </form>
    </div>
 </div>
  );
}
