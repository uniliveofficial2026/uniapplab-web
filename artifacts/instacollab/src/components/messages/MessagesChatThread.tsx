import React from 'react';
import { Heart, MoreHorizontal, Music, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import type { MessageReplyRef, Post, Reel, User } from '../../types';
import { useDB } from '../../lib/useDB';
import { handleAvatarError, handleMediaError } from '../../lib/utils';
import { safeMediaUrl } from '../../lib/safe';
import { formatProfileHandle, getProfileDisplayName } from '../../lib/profileDisplay';
import { PLAYBACK_SCOPE } from '../../lib/playbackScope';
import { ChatInlineVideo } from './ChatInlineVideo';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { MusicDiscPlayer } from './MusicDiscPlayer';
import { MessageFileCard } from './MessageFileCard';
import { MessageLocationCard } from './MessageLocationCard';
import { isDocumentAttachment, parseLegacyFileMessageText } from './messages/chatFileUtils';
import { getMessageLocation } from './messages/chatLocationUtils';
import { SharedLinkCard } from './SharedLinkCard';
import { isShareLinkMessage } from '../../lib/shareLinks';
import {
  MessageMediaPlaylistProvider,
  type MessagePlaylistTrack,
} from './MessageMediaPlaylist';
import type { MessageMediaAttachment } from './messages/types';
import { toFullscreenMediaItems } from './messages/messageMediaUtils';
import {
  formatMessageDateTime,
  getDaySeparatorLabel,
} from './messages/messageTime';
import {
  getEffectivePeerReadAt,
  isIncomingMessageReadForDisplay,
  isOutgoingMessageSeen,
} from './messages/chatReadReceipts';
import type { MessagesChatThreadProps } from './messages/chatThreadProps';

export function MessagesChatThread(props: MessagesChatThreadProps) {
  const db = useDB();
  const {
    selectedUser,
    activeCustomWallpaper,
    videoWallpaperSequence,
    playNextVideoWallpaper,
    getWallpaperStyle,
    visibleMessageEntries,
    chatSearchQuery,
    isPeerTyping,
    messagesEndRef,
    chatScrollRef,
    chatScrollRoot,
    onChatScroll,
    messageElementRefs,
    highlightedMessageId,
    selectedMessageKeys,
    openMessageMenuKey,
    setOpenMessageMenuKey,
    messageMenuDirection,
    setMessageMenuDirection,
    openReactionPickerKey,
    setOpenReactionPickerKey,
    reactionPickerDirection,
    setReactionPickerDirection,
    selectedChatId,
    chatPeerReadAt,
    incomingReadLabelWatermark,
    bothParticipantsInChat,
    inlineVideoRefs,
    onViewProfile,
    getMessageReactionKey,
    getMessageSelectionKey,
    toggleMessageSelection,
    decideMessageMenuDirection,
    decideReactionPickerDirection,
    jumpToOriginalMessage,
    setFullscreenMedia,
    handleSharedItemClick,
    extractMessageSegments,
    tryOpenMediaFullscreen,
    handleAttachmentTokenClick,
    toggleMessageReaction,
    handleReplyMessage,
    handleForwardMessage,
    handleCopyMessage,
    handleTogglePinMessage,
    handleDeleteForMe,
    handleDeleteForEveryone,
    handleEditMessage,
    handleSelectAllMessages,
    onToggleIncomingReadStatus,
    onOpenFilePreview,
    onDownloadFile,
    onOpenLocationMap,
  } = props;

  const openReplyAttachmentMedia = (media: MessageMediaAttachment[]) => {
    const fileItem = media.find((item) => isDocumentAttachment(item) && item.url);
    if (fileItem) {
      onOpenFilePreview(fileItem);
      return true;
    }
    const visualItems = toFullscreenMediaItems(media);
    if (visualItems.length > 0) {
      setFullscreenMedia({ items: visualItems, mediaIndex: 0 });
      return true;
    }
    return false;
  };

  return (
<div className="flex-1 relative overflow-hidden">
     {activeCustomWallpaper?.kind === 'video' && (
       <div className="absolute inset-0 z-0 overflow-hidden">
         <video
           data-playback-scope={PLAYBACK_SCOPE.AMBIENT}
           src={activeCustomWallpaper.value}
           className="w-full h-full object-cover"
           autoPlay
           loop={videoWallpaperSequence.length <= 1}
           muted
           playsInline
           preload="auto"
           onEnded={() => {
             if (videoWallpaperSequence.length > 1) {
               playNextVideoWallpaper();
             }
           }}
           onError={() => {
             if (videoWallpaperSequence.length > 1) {
               playNextVideoWallpaper();
             }
           }}
         />
       </div>
     )}
     <div className="absolute inset-0 z-[1] pointer-events-none" style={getWallpaperStyle()}></div>
<div
     ref={chatScrollRef}
     onScroll={onChatScroll}
     className="relative z-[2] h-full overflow-y-auto p-4 sm:p-6 flex flex-col gap-5 w-full"
   >
      <div className="flex flex-col items-center justify-center py-6 sm:py-10 opacity-80">
          <div className={`w-24 h-24 sm:w-28 sm:h-28 overflow-hidden mb-4 border-2 border-border shadow-sm ${'isGroup' in selectedUser ? 'rounded-2xl' : 'rounded-full'}`}>
              <img src={selectedUser.avatarUrl || undefined} alt="user" className="w-full h-full object-cover" onError={handleAvatarError} />
          </div>
          <h2 className="text-[20px] sm:text-[22px] font-black text-center">{getProfileDisplayName(selectedUser)}</h2>
          <span className="text-muted-foreground text-[13px] sm:text-[14px] font-medium text-center px-4">
            {formatProfileHandle(selectedUser) || getProfileDisplayName(selectedUser)} · InstaCollab End-to-End Encrypted
          </span>
          {!('isGroup' in selectedUser) && <button onClick={onViewProfile} className="mt-4 sm:mt-5 px-6 py-2 bg-secondary hover:bg-foreground hover:text-background rounded-full text-[14px] font-bold transition-all shadow-sm">View Profile</button>}
      </div>
      
      <AnimatePresence>
      {visibleMessageEntries.map(({ msg, index: idx }, visibleIdx) => (
        <React.Fragment key={msg.id || `${msg.timestamp || 'no-ts'}-${idx}`}>
          {(() => {
            const separatorLabel = getDaySeparatorLabel(msg.timestamp);
            const previousSeparatorLabel = visibleIdx > 0 ? getDaySeparatorLabel(visibleMessageEntries[visibleIdx - 1]?.msg?.timestamp) : null;
            const shouldShowSeparator = separatorLabel && separatorLabel !== previousSeparatorLabel;

            return shouldShowSeparator ? (
              <div className="w-full flex items-center justify-center mt-1 mb-2">
                <span className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wide bg-secondary text-muted-foreground border border-border/70">
                  {separatorLabel}
                </span>
              </div>
            ) : null;
          })()}
          <motion.div 
           ref={(element: HTMLDivElement | null) => {
             if (typeof msg?.id !== 'string') return;
             if (element) {
               messageElementRefs.current[msg.id] = element;
             } else {
               delete messageElementRefs.current[msg.id];
             }
           }}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
           className={`flex gap-2 sm:gap-3 justify-start items-end mt-2 ${msg.isAuthor ? 'flex-row-reverse' : ''} ${highlightedMessageId === msg.id ? 'ring-2 ring-primary/60 rounded-2xl' : ''}`}
          >
            {!msg.isAuthor && (
              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-border shadow-sm">
                <img src={selectedUser.avatarUrl || undefined} alt="user" className="w-full h-full object-cover" onError={handleAvatarError} />
              </div>
            )}
           <div
             data-message-bubble-shell="true"
             className={`relative flex flex-col ${msg.isAuthor ? 'items-end' : 'items-start'} max-w-[80%] sm:max-w-[70%]`}
           >
           <div
             onClick={(e) => {
               e.stopPropagation();
               const target = e.target as HTMLElement | null;
               if (target?.closest('[data-message-interactive="true"]')) {
                 return;
               }
               const messageKey = getMessageReactionKey(msg, idx);
               if (selectedMessageKeys.length > 0) {
                 toggleMessageSelection(msg, idx);
                 setOpenMessageMenuKey(null);
                 return;
               }
               const targetEl = e.currentTarget;
               if (!(targetEl instanceof HTMLElement)) return;
               const nextDirection = decideMessageMenuDirection(targetEl);
               setMessageMenuDirection(nextDirection);
               setOpenReactionPickerKey(null);
               setOpenMessageMenuKey((prev) => prev === messageKey ? null : messageKey);
             }}
             className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-[20px] w-full shadow-md backdrop-blur-sm ${
               selectedMessageKeys.includes(getMessageSelectionKey(msg, idx)) ? 'ring-2 ring-primary/50' : ''
             } ${msg.isAuthor ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-secondary/70 text-foreground rounded-bl-sm border border-border/50'}`}
           >
              {typeof msg.replyTo?.text === 'string' && msg.replyTo.text.length > 0 && (
                <div className={`mb-2 px-2 py-1 rounded-lg text-[11px] font-semibold border ${msg.isAuthor ? 'bg-primary-foreground/10 text-primary-foreground/90 border-primary-foreground/25' : 'bg-background/70 text-muted-foreground border-border/70'}`}>
                  Reply to: {msg.replyTo.text}
                </div>
              )}
              {msg.isPinned === true && (
                <div className={`mb-2 inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold border ${msg.isAuthor ? 'bg-primary-foreground/10 text-primary-foreground/90 border-primary-foreground/25' : 'bg-background/70 text-muted-foreground border-border/70'}`}>
                  Pinned
                </div>
              )}
              {Array.isArray(msg.replyToMany) && msg.replyToMany.length > 0 && (
                <div className={`mb-2 rounded-2xl border p-2.5 ${msg.isAuthor ? 'bg-primary-foreground/10 border-primary-foreground/25' : 'bg-background/70 border-border/70'}`}>
                  <div className={`text-[11px] font-bold uppercase tracking-wide mb-2 ${msg.isAuthor ? 'text-primary-foreground/85' : 'text-muted-foreground'}`}>
                    Replying To Messages
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {(msg.replyToMany as MessageReplyRef[]).map((item, replyIdx: number) => (
                      <button
                        key={`reply-bundle-${replyIdx}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                         if (typeof item?.sourceMessageId === 'string') {
                           jumpToOriginalMessage(item.sourceMessageId);
                           return;
                         }
                          const rawMedia = Array.isArray(item?.media)
                            ? (item.media as MessageMediaAttachment[])
                            : [];
                          if (rawMedia.length > 0 && openReplyAttachmentMedia(rawMedia)) {
                            return;
                          }
                          if (item?.hasShareLink && typeof item?.text === 'string') {
                            handleSharedItemClick(item.text);
                          }
                        }}
                        className={`rounded-lg px-2.5 py-2 text-[12px] border w-full text-left ${msg.isAuthor ? 'bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground' : 'bg-card border-border/70 text-foreground'} ${(item?.hasMedia || item?.hasShareLink) ? 'hover:opacity-85 transition-opacity cursor-pointer' : 'cursor-default'}`}
                      >
                        <div className="font-semibold leading-snug break-words">
                          {replyIdx + 1}. {(typeof item?.text === 'string' ? item.text : null) || 'Message'}
                        </div>
                        {item?.hasMedia &&
                        Array.isArray(item.media) &&
                        (item.media as MessageMediaAttachment[]).some((m) => m?.isFile) ? (
                          <div className={`mt-1 text-[10px] font-bold ${msg.isAuthor ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                            Tap to open file
                          </div>
                        ) : item?.hasMedia ? (
                          <div className={`mt-1 text-[10px] font-bold ${msg.isAuthor ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                            Includes media
                          </div>
                        ) : item?.hasShareLink ? (
                          <div className={`mt-1 text-[10px] font-bold ${msg.isAuthor ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                            Tap to open shared content
                          </div>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              )}
               {Array.isArray(msg.forwardedBundle) && msg.forwardedBundle.length > 0 ? (
                 <div className={`rounded-2xl border p-2.5 ${msg.isAuthor ? 'bg-primary-foreground/10 border-primary-foreground/25' : 'bg-background/70 border-border/70'}`}>
                   <div className={`text-[11px] font-bold uppercase tracking-wide mb-2 ${msg.isAuthor ? 'text-primary-foreground/85' : 'text-muted-foreground'}`}>
                     Forwarded Messages
                   </div>
                   <div className="flex flex-col gap-1.5">
                     {(msg.forwardedBundle as MessageReplyRef[]).map((item, bundleIdx: number) => (
                       <button
                         key={`forwarded-item-${bundleIdx}`}
                         type="button"
                         onClick={(e) => {
                           e.stopPropagation();
                           if (typeof item?.sourceMessageId === 'string') {
                             jumpToOriginalMessage(item.sourceMessageId);
                             return;
                           }
                           const rawMedia = Array.isArray(item?.media)
                             ? (item.media as MessageMediaAttachment[])
                             : [];
                           if (rawMedia.length > 0 && openReplyAttachmentMedia(rawMedia)) {
                             return;
                           }
                           if (item?.hasShareLink && typeof item?.text === 'string') {
                             handleSharedItemClick(item.text);
                           }
                         }}
                         className={`rounded-lg px-2.5 py-2 text-[12px] border w-full text-left ${msg.isAuthor ? 'bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground' : 'bg-card border-border/70 text-foreground'} ${(item?.hasMedia || item?.hasShareLink) ? 'hover:opacity-85 transition-opacity cursor-pointer' : 'cursor-default'}`}
                       >
                         <div className="font-semibold leading-snug break-words">
                           {bundleIdx + 1}. {(typeof item?.text === 'string' ? item.text : null) || 'Message'}
                         </div>
                         {item?.hasMedia &&
                         Array.isArray(item.media) &&
                         (item.media as MessageMediaAttachment[]).some((m) => m?.isFile) ? (
                           <div className={`mt-1 text-[10px] font-bold ${msg.isAuthor ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                             Tap to open file
                           </div>
                         ) : item?.hasMedia ? (
                           <div className={`mt-1 text-[10px] font-bold ${msg.isAuthor ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                             Includes media
                           </div>
                         ) : item?.hasShareLink ? (
                           <div className={`mt-1 text-[10px] font-bold ${msg.isAuthor ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                             Tap to open shared content
                           </div>
                         ) : null}
                       </button>
                     ))}
                   </div>
                 </div>
               ) : getMessageLocation(msg) ? (
                 <MessageLocationCard
                   location={getMessageLocation(msg)!}
                   isAuthor={!!msg.isAuthor}
                   onViewInApp={onOpenLocationMap}
                 />
               ) : isShareLinkMessage(msg.text) ? (
                 <SharedLinkCard
                   text={String(msg.text)}
                   isAuthor={!!msg.isAuthor}
                   senderUserId={typeof msg.from === 'string' ? msg.from : undefined}
                   onOpen={(mediaIndex) => {
                     if (typeof msg.text === 'string') handleSharedItemClick(msg.text, mediaIndex);
                   }}
                 />
             ) : msg.text?.trim() ? (
               (() => {
                 const legacyFileName = parseLegacyFileMessageText(msg.text);
                 const hasFileMedia =
                   Array.isArray(msg.media) &&
                   (msg.media as MessageMediaAttachment[]).some((item) => !!item?.isFile);
                 if (legacyFileName && !hasFileMedia) {
                   return (
                     <MessageFileCard
                       media={{ name: legacyFileName }}
                       isAuthor={!!msg.isAuthor}
                       legacyNameOnly
                       onDownload={onDownloadFile}
                     />
                   );
                 }
                 const { messageBody } = extractMessageSegments(msg.text);
                 if (!messageBody) return null;
                 return (
                   <span className="text-[14px] sm:text-[15px] leading-relaxed font-medium break-words">
                     {messageBody}
                   </span>
                 );
               })()
             ) : null}
              {msg.media && msg.media.length > 0 && (() => {
                const messageMedia = (Array.isArray(msg.media) ? msg.media : []) as MessageMediaAttachment[];
                const indexedMedia = messageMedia.map((media, mediaIndex) => ({ media, mediaIndex }));
                const fullscreenItems = toFullscreenMediaItems(messageMedia);
                const fileMedia = indexedMedia.filter(({ media }: { media: MessageMediaAttachment }) => !!media?.isFile);
                const audioMedia = indexedMedia.filter(
                  ({ media }: { media: MessageMediaAttachment }) => !!media?.isAudio && !media?.isFile
                );
                const visualMedia = indexedMedia.filter(
                  ({ media }: { media: MessageMediaAttachment }) => !media?.isAudio && !media?.isFile
                );
                const previewVisualMedia = visualMedia.slice(0, 4);
                const hiddenVisualCount = Math.max(0, visualMedia.length - previewVisualMedia.length);
                const playlistKey = msg.id || `msg-${idx}`;
                const playlistTracks: MessagePlaylistTrack[] = indexedMedia
                  .filter(
                    ({ media }: { media: MessageMediaAttachment }) =>
                      !!media?.url && (!!media.isAudio || !!media.isVideo)
                  )
                  .map(({ media, mediaIndex }: { media: MessageMediaAttachment; mediaIndex: number }) => ({
                    id: `${playlistKey}-${mediaIndex}`,
                    kind: media.isVideo
                      ? 'video'
                      : media.name
                        ? 'music'
                        : 'voice',
                    url: media.url!,
                    name: media.name,
                    videoRefKey: media.isVideo ? `msg-${idx}-${mediaIndex}` : undefined,
                  }));
                const usePlaylist = playlistTracks.length > 1;
                const trackIdFor = (mediaIndex: number) =>
                  usePlaylist ? `${playlistKey}-${mediaIndex}` : undefined;

                return (
                  <MessageMediaPlaylistProvider
                    tracks={playlistTracks}
                    inlineVideoRefs={inlineVideoRefs}
                  >
                  <div
                    data-message-interactive="true"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="mt-2 flex flex-col gap-2 w-full"
                  >
                    {fileMedia.map(({ media, mediaIndex }: { media: MessageMediaAttachment; mediaIndex: number }) => (
                      <MessageFileCard
                        key={`file-${mediaIndex}`}
                        media={media}
                        isAuthor={!!msg.isAuthor}
                        onPreview={onOpenFilePreview}
                        onDownload={onDownloadFile}
                      />
                    ))}

                    {visualMedia.length > 0 && (
                      <div className={`${visualMedia.length === 1 ? 'max-w-[220px]' : 'w-full'} grid ${visualMedia.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-1.5`}>
                        {previewVisualMedia.map(({ media, mediaIndex }: { media: MessageMediaAttachment; mediaIndex: number }, previewIndex: number) => {
                          const showOverlayCount = hiddenVisualCount > 0 && previewIndex === previewVisualMedia.length - 1;
                          return (
                            <button
                              key={`visual-${mediaIndex}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                tryOpenMediaFullscreen(
                                  fullscreenItems,
                                  mediaIndex,
                                  `msg-${idx}-${mediaIndex}`
                                );
                              }}
                              className="relative aspect-square rounded-lg overflow-hidden border border-[rgba(255,255,255,0.1)] shadow-sm"
                            >
                              {media.isVideo ? (
                                <ChatInlineVideo
                                  src={media?.url || ''}
                                  className="w-full h-full"
                                  scrollRoot={chatScrollRoot}
                                  visibilityAutoplay={false}
                                  playlistTrackId={trackIdFor(mediaIndex)}
                                  onError={handleMediaError}
                                  onRegisterRef={(el) => {
                                    const key = `msg-${idx}-${mediaIndex}`;
                                    if (el) inlineVideoRefs.current.set(key, el);
                                    else inlineVideoRefs.current.delete(key);
                                  }}
                                />
                              ) : (
                                <img src={safeMediaUrl(media?.url) || undefined} className="w-full h-full object-cover" onError={handleMediaError} />
                              )}
                              {showOverlayCount && (
                                <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-lg font-bold">
                                  +{hiddenVisualCount}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {audioMedia.map(({ media, mediaIndex }: { media: MessageMediaAttachment; mediaIndex: number }) => {
                      if (!media.url) return null;
                      return (
                      <div
                        key={`audio-${mediaIndex}`}
                        data-message-interactive="true"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="py-1"
                      >
                        {media.name ? (
                          <MusicDiscPlayer
                            url={media.url}
                            name={media.name}
                            color={msg.isAuthor ? 'primary' : 'secondary'}
                            playlistTrackId={trackIdFor(mediaIndex)}
                          />
                        ) : (
                          <VoiceMessagePlayer
                            url={media.url}
                            color={msg.isAuthor ? 'primary' : 'secondary'}
                            playlistTrackId={trackIdFor(mediaIndex)}
                          />
                        )}
                      </div>
                      );
                    })}
                  </div>
                  </MessageMediaPlaylistProvider>
                );
              })()}
              {(() => {
                if (!msg.text?.trim()) return null;
                const { attachments } = extractMessageSegments(msg.text);
                if (attachments.length === 0) return null;

                return (
                  <div className={`mt-2 flex flex-wrap gap-1.5 ${msg.isAuthor ? 'justify-end' : 'justify-start'}`}>
                    {attachments.map((token, tokenIndex) => (
                      <button
                        key={`attachment-${msg.timestamp || idx}-${token}-${tokenIndex}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAttachmentTokenClick(token);
                        }}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-opacity hover:opacity-85 ${msg.isAuthor ? 'bg-primary-foreground/15 text-primary-foreground border-primary-foreground/30' : 'bg-zinc-100 text-primary border-primary/30 dark:bg-zinc-800/90 dark:text-primary dark:border-primary/45'}`}
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                );
              })()}
            {(() => {
              const peerReadAt = getEffectivePeerReadAt(
                selectedChatId,
                chatPeerReadAt,
                selectedChatId ? db.getChatPeerReadAt(selectedChatId) : 0
              );
              const isReadState = msg.isAuthor
                ? isOutgoingMessageSeen(msg.timestamp, peerReadAt, bothParticipantsInChat)
                : isIncomingMessageReadForDisplay(
                    msg.timestamp,
                    incomingReadLabelWatermark,
                    bothParticipantsInChat
                  );
              const statusLabel = msg.isAuthor
                ? (isReadState ? 'Seen' : 'Unseen')
                : (isReadState ? 'Read' : 'Unread');
              return (
                <div className={`mt-1.5 flex items-center justify-end gap-1.5 text-[10px] font-semibold tabular-nums ${msg.isAuthor ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  <span>{formatMessageDateTime(msg.timestamp)}</span>
                  {msg.isAuthor ? (
                    <span className={isReadState ? 'text-blue-400' : 'text-zinc-400 dark:text-zinc-500'}>{statusLabel}</span>
                  ) : (
                    <button
                      type="button"
                      data-message-interactive="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleIncomingReadStatus(msg);
                      }}
                      className={`rounded px-0.5 -mx-0.5 hover:opacity-80 ${isReadState ? 'text-blue-400' : 'text-zinc-400 dark:text-zinc-500'}`}
                      aria-label={isReadState ? 'Mark as unread' : 'Mark as read'}
                    >
                      {statusLabel}
                    </button>
                  )}
                </div>
              );
            })()}
            </div>
           {(() => {
             const messageKey = getMessageReactionKey(msg, idx);
             if (openMessageMenuKey !== messageKey) return null;
             return (
               <div
                 data-message-menu-panel="true"
                 className={`absolute ${msg.isAuthor ? 'right-0' : 'left-0'} ${messageMenuDirection === 'down' ? 'top-full mt-1' : 'bottom-full mb-1'} z-30 min-w-[180px] rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-xl p-1`}
               >
                 <button
                   type="button"
                   onClick={(e) => {
                     e.stopPropagation();
                     toggleMessageSelection(msg, idx);
                     setOpenMessageMenuKey(null);
                   }}
                   className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
                 >
                   Select message
                 </button>
                 <button
                   type="button"
                   onClick={(e) => {
                     e.stopPropagation();
                     handleSelectAllMessages();
                   }}
                   className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
                 >
                   Select all messages
                 </button>
                 <button
                   type="button"
                   onClick={(e) => {
                     e.stopPropagation();
                     handleReplyMessage(msg, idx);
                   }}
                   className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
                 >
                   Reply
                 </button>
                 <button
                   type="button"
                   onClick={(e) => {
                     e.stopPropagation();
                     handleForwardMessage(msg);
                   }}
                   className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
                 >
                   Forward
                 </button>
                 <button
                   type="button"
                   onClick={(e) => {
                     e.stopPropagation();
                     handleCopyMessage(msg);
                   }}
                   className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
                 >
                   Copy
                 </button>
                 <button
                   type="button"
                   onClick={(e) => {
                     e.stopPropagation();
                     handleTogglePinMessage(msg, idx);
                   }}
                   className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
                 >
                   {msg.isPinned ? 'Unpin' : 'Pin'}
                 </button>
                 <button
                   type="button"
                   onClick={(e) => {
                     e.stopPropagation();
                     handleDeleteForMe(idx);
                   }}
                   className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
                 >
                   Delete for me
                 </button>
                 {msg.isAuthor && !msg.isDeleted && (
                   <button
                     type="button"
                     onClick={(e) => {
                       e.stopPropagation();
                       handleDeleteForEveryone(msg, idx);
                     }}
                     className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
                   >
                     Delete for everyone
                   </button>
                 )}
                 {msg.isAuthor && !msg.isDeleted && (
                   <button
                     type="button"
                     onClick={(e) => {
                       e.stopPropagation();
                       handleEditMessage(msg, idx);
                     }}
                     className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
                   >
                     Edit
                   </button>
                 )}
               </div>
             );
           })()}
           {(() => {
             const messageKey = getMessageReactionKey(msg, idx);
             const rawReactionState = msg.reactionState && typeof msg.reactionState === 'object'
               ? msg.reactionState
               : { selected: null, counts: {} };
             const countsObj = rawReactionState.counts && typeof rawReactionState.counts === 'object'
               ? rawReactionState.counts as Record<string, unknown>
               : {};
             const reactionEntries = Object.entries(countsObj)
               .map(([emoji, count]) => [emoji, typeof count === 'number' ? count : 0] as const)
               .filter(([, count]) => count > 0);
             const heartSelected = rawReactionState.selected === '❤️';

             if (msg.isDeleted) return null;
             return (
               <div className={`mt-1 flex flex-col gap-1 w-full ${msg.isAuthor ? 'items-end' : 'items-start'}`}>
                 <div className={`flex items-center gap-1 flex-nowrap ${msg.isAuthor ? 'justify-end flex-row-reverse' : 'justify-start'}`}>
                   <div className={`relative flex items-center gap-1 ${msg.isAuthor ? '' : 'flex-row-reverse'}`}>
                     <button
                       type="button"
                       onClick={(e) => {
                         e.stopPropagation();
                         toggleMessageReaction(idx, '❤️');
                       }}
                       className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${heartSelected ? 'bg-red-500/15 border-red-400/40 text-red-500' : 'bg-background/70 border-border text-muted-foreground hover:text-red-500 hover:border-red-400/40'}`}
                       title="Quick heart reaction"
                     >
                       <Heart className={`w-3.5 h-3.5 ${heartSelected ? 'fill-current' : ''}`} />
                     </button>
                     <button
                       type="button"
                       onClick={(e) => {
                         e.stopPropagation();
                         const nextDirection = decideReactionPickerDirection(e.currentTarget);
                         setReactionPickerDirection(nextDirection);
                         setOpenReactionPickerKey((prev) => prev === messageKey ? null : messageKey);
                       }}
                       data-reaction-more-button="true"
                       className="w-6 h-6 rounded-full border bg-background/70 border-border text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                       title="More reactions"
                     >
                       <MoreHorizontal className="w-3.5 h-3.5" />
                     </button>
                     {openReactionPickerKey === messageKey && (
                       <div data-reaction-picker="true" className={`absolute ${msg.isAuthor ? 'right-0' : 'left-0'} ${reactionPickerDirection === 'down' ? 'top-full mt-1' : 'bottom-full mb-1'} z-30 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-xl`}>
                         <EmojiPicker
                           width={260}
                           height={320}
                           previewConfig={{ showPreview: false }}
                           onEmojiClick={(emoji) => {
                             toggleMessageReaction(idx, emoji.emoji);
                             setOpenReactionPickerKey(null);
                           }}
                           theme={Theme.AUTO}
                         />
                       </div>
                     )}
                   </div>
                   {reactionEntries.length > 0 && (
                     <div className="flex items-center gap-1 flex-wrap">
                       {reactionEntries.map(([emoji, count]) => (
                         <button
                           key={`${messageKey}-${emoji}`}
                           type="button"
                           onClick={(e) => {
                             e.stopPropagation();
                             toggleMessageReaction(idx, emoji);
                           }}
                           className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-opacity hover:opacity-85 ${msg.isAuthor ? 'bg-primary-foreground/15 text-primary-foreground border-primary-foreground/30' : 'bg-white text-foreground border-border dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700'}`}
                         >
                           {emoji} {count}
                         </button>
                       ))}
                     </div>
                   )}
                 </div>
               </div>
             );
           })()}
           </div>
          </motion.div>
        </React.Fragment>
      ))}
      {chatSearchQuery.trim() && visibleMessageEntries.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-6">
          No messages found.
        </div>
      )}
     {isPeerTyping && (
        <motion.div 
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="flex gap-2 justify-start items-end mt-2"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-border shadow-sm">
            <img src={selectedUser.avatarUrl || undefined} alt="user" className="w-full h-full object-cover" onError={handleAvatarError} />
          </div>
          <div className="px-5 py-3 rounded-[20px] shadow-sm bg-secondary/70 rounded-bl-sm border border-border/50 flex items-center justify-center gap-1.5 h-11">
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </motion.div>
      )}
      </AnimatePresence>
      <div ref={messagesEndRef} className="h-2 w-full shrink-0" />
  </div>
 </div>
  );
}
