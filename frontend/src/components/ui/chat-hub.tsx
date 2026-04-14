// 🛡️ HAEMI ATTACHMENT PIPELINE LOCK
// DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL
// SINGLE SOURCE: message_attachments ONLY
// FALLBACKS FORBIDDEN
// TYPESCRIPT STRICT MODE ENFORCED

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Button } from './button';
import { MessageCircle, Send, Paperclip, X, ChevronLeft, Search, Check, CheckCheck, ShieldCheck, MessageSquare, Plus, Minus, Maximize2, Download, Reply, Loader2, UserPlus, FileText, File, FileSpreadsheet, ImageOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat, type Conversation, type Message } from '../../hooks/use-chat';
import { useAuth } from '@/hooks/use-auth';
import { useOverlay } from '@/hooks/use-overlay';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import api from '../../services/api';
import type { DoctorProfile } from '../../services/doctor.service';
import { MedicalLoader } from './medical-loader';
import { PremiumLoader } from './premium-loader';
import doctor01 from '../../assets/images/doctors/doctor_01.jpg';
import doctor02 from '../../assets/images/doctors/doctor_02.png';
import doctor03 from '../../assets/images/doctors/doctor_03.png';
import { useLocation } from 'react-router-dom';
import { useClickOutside } from '../../hooks/use-click-outside';
import { secureDownload } from '../../services/file.service';
import { getInitials as resolveInitials } from '@/utils/avatar.resolver';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';

// Override helper to get images
const getDoctorImage = (name: string) => {
    if (!name) return undefined;
    if (name.includes('Dr. Thabo') || name.includes('Kgosi')) return doctor01;
    if (name.includes('Dr. Lorato') || name.includes('Molefe')) return doctor02;
    if (name.includes('Dr. Neo') || name.includes('Mousi')) return doctor03;
    // Fallback deterministic mapping for demo
    if (name.length % 2 === 0) return doctor01;
    return doctor02;
};

// --- Premium Avatar Component ---
const Avatar: React.FC<{ name: string; initials?: string; image?: string; profileImage?: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string }> = ({ name, initials, image, profileImage, size = 'md', className = "" }) => {
    const sizeMap = {
        xs: 'avatar-xs',
        sm: 'avatar-sm',
        md: 'avatar-md',
        lg: 'avatar-lg',
        xl: 'avatar-xl'
    };

    const getInitials = (n: string) => resolveInitials(n) || '?';

    // Standardized ID-based Resolution
    const avatarUrl = profileImage ? (profileImage.startsWith('http') ? profileImage : `/api/files/profile/${profileImage}`) : image;

    return (
        <div className={`relative shrink-0 ${className}`}>
            <div className={`${sizeMap[size]} rounded-full overflow-hidden premium-avatar-fallback flex items-center justify-center shadow-sm text-white font-bold tracking-wider relative`}>
                {avatarUrl ? (
                    <AuthenticatedImage
                        src={avatarUrl}
                        alt={name}
                        className="h-full w-full"
                        aspectRatio="square"
                        errorFallback={initials || getInitials(name)}
                        loadingFallback={<PremiumLoader size="xs" />}
                    />
                ) : (
                    initials || getInitials(name)
                )}
            </div>
        </div>
    );
};

// --- Reaction Icon Helper (Updated to Teams-style Emojis) ---
const ReactionIcon: React.FC<{ type: string; className?: string }> = ({ type, className = "text-lg" }) => {
    // Map both old IDs (fallback) and new IDs to Emojis
    switch (type) {
        case 'like':
        case 'thumbs_up': return <span className={className}>👍</span>;
        case 'love': return <span className={className}>❤️</span>;
        case 'laugh':
        case 'appreciation': return <span className={className}>😂</span>; // Map appreciation to laugh for now or 👏 if preferred
        case 'wow':
        case 'noted': return <span className={className}>😲</span>;
        case 'sad':
        case 'acknowledgement': return <span className={className}>😢</span>;
        case 'angry':
        case 'agreement': return <span className={className}>😡</span>;
        default: return <span className={className}>👍</span>;
    }
};

import { ChatContextMenu } from './chat-context-menu';
import { AuthenticatedImage } from './authenticated-image';

import type { ChatParticipant, PresenceRecord, UserId, MessageId, AttachmentDTO } from '@/types/chat';

// --- INSTITUTIONAL MEMOIZATION: ATOMIC COMPONENTS ---

// 🧬 CONVERSATION ITEM: Prevents entire contact list re-render on presence update
const ConversationItem = React.memo(({
    conv,
    other,
    presence,
    onClick,
    getFormattedTime
}: {
    conv: Conversation;
    other: ChatParticipant & { isGroup?: boolean };
    presence: Record<string, PresenceRecord>;
    onClick: () => void;
    getFormattedTime: (d: string) => string;
}) => {
    const userPresence = presence[String(other.id)];
    const isOnline = !other.isGroup && !!userPresence?.isOnline;

    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-3 p-3 rounded-[var(--card-radius)] hover:bg-accent/50 dark:hover:bg-accent/20 hover:shadow-sm border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all text-left group"
        >
            <div className="relative shrink-0">
                {other.isGroup ? (
                    <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-teal-600 dark:text-teal-400 border border-slate-200 dark:border-slate-800">
                        <UserPlus className="h-5 w-5" />
                    </div>
                ) : (
                    <>
                        <Avatar
                            name={other.name}
                            initials={other.initials}
                            profileImage={other.profileImage ?? undefined}
                            size="md"
                        />
                        {isOnline && (
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 group-hover:scale-110 transition-transform haemi-status-pulse" />
                        )}
                    </>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors">
                        {other.name}
                    </h4>
                    <span className="text-[10px] font-medium text-slate-400 shrink-0">
                        {getFormattedTime(conv.lastMessageAt)}
                    </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                    <p className="text-xs text-slate-500 truncate dark:text-slate-400">
                        {conv.lastMessage || 'Start a conversation'}
                    </p>
                    {((conv.unreadCount as number) || 0) > 0 && (
                        <span className="conv-unread-pill animate-badge-pop">
                            {conv.unreadCount}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
});

// 🧬 MESSAGE ITEM: Crucial for Virtuoso performance in long histories
const MessageItem = React.memo(({
    msg,
    index,
    onContextMenu,
    onDownload,
    onLightbox,
    onScrollToReply,
    downloadingId,
    getFormattedTime
}: {
    msg: Message;
    index: number;
    onContextMenu: (e: React.MouseEvent, msgId: MessageId, isMe: boolean) => void;
    onDownload: (url: string, name: string, id: MessageId) => void;
    onLightbox: (src: string, alt: string) => void;
    onScrollToReply: (replyToId: MessageId) => void;
    downloadingId: string | null;
    getFormattedTime: (d: string) => string;
}) => (
    <div className="px-4 py-2">
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={msg.id || index}
            id={`msg-${msg.id}`}
            className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'} group`}
        >
            <div
                onContextMenu={(e) => onContextMenu(e, msg.id, !!msg.isMe)}
                className={`max-w-[85%] p-3 rounded-[var(--card-radius)] shadow-sm text-sm relative cursor-context-menu group ${msg.isMe
                    ? 'bg-teal-600 text-white rounded-tr-none'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-none'
                    }`}
            >
                {/* Reply Preview */}
                {msg.replyTo && (
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            onScrollToReply(msg.replyToId!);
                        }}
                        className={`mb-2 p-2 rounded-xl border-l-[3px] text-[11px] cursor-pointer transition-all hover:bg-black/5 dark:hover:bg-white/5 ${msg.isMe
                            ? 'bg-black/10 border-white/40 text-teal-50'
                            : 'bg-slate-50 dark:bg-slate-900/50 border-teal-500 text-slate-600 dark:text-slate-400'
                            }`}
                    >
                        <div className="flex items-center justify-between mb-0.5">
                            <p className={`font-bold ${msg.isMe ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`}>
                                {msg.replyTo.senderName}
                            </p>
                            <Reply className="h-2.5 w-2.5 opacity-60" />
                        </div>
                        <p className="line-clamp-2 opacity-80 italic">
                            {msg.replyTo.content}
                        </p>
                    </div>
                )}

                {/* Institutional Multi-Attachment Pipeline (P3: Grid Layout) */}
                {msg.attachments && msg.attachments.length > 0 && (
                    <div className={`mb-2 -mx-1 -mt-1 grid gap-1 ${msg.attachments.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {msg.attachments.map((att, i) => (
                            <div key={i} className="relative overflow-hidden rounded-[8px] bg-black/5 dark:bg-white/5 border border-white/10">
                                {att.type.startsWith('image/') ? (
                                        <div
                                            className={`chat-thumbnail-container ${msg.status === 'sending' ? 'cursor-wait opacity-70' : ''}`}
                                            onClick={() => {
                                                if (msg.status === 'sending') return;
                                                if (att.id && att.name) {
                                                    onLightbox(att.url.startsWith('blob:') || att.url.startsWith('data:') ? att.url : `/api/files/message/${att.id}`, att.name);
                                                }
                                            }}
                                        >
                                            <AuthenticatedImage
                                                src={att.url.startsWith('blob:') || att.url.startsWith('data:') ? att.url : `/api/files/message/${att.id}`}
                                                alt={att.name || 'Attachment'}
                                                className="chat-thumbnail-image"
                                                loadingFallback={<PremiumLoader size="sm" />}
                                            />
                                            <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
                                                {msg.status === 'sending' ? (
                                                    <Loader2 className="h-6 w-6 text-white animate-spin drop-shadow-md" />
                                                ) : (
                                                    <Maximize2 className="text-white opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 drop-shadow-md" />
                                                )}
                                            </div>
                                        </div>
                                ) : (
                                    <button
                                        onClick={() => {
                                            if (msg.status === 'sending') return;
                                            if (att.id && att.name) {
                                                onDownload(att.url.startsWith('blob:') ? att.url : `/api/files/message/${att.id}`, att.name, msg.id);
                                            }
                                        }}
                                        disabled={downloadingId === msg.id || msg.status === 'sending'}
                                        className={`w-full group/file flex items-center gap-[0.75rem] p-[0.75rem] rounded-[var(--card-radius)] border transition-all duration-200 ${
                                            msg.status === 'sending' 
                                                ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-900 border-dashed'
                                                : msg.isMe 
                                                    ? 'bg-white/10 border-white/10 hover:bg-white/20' 
                                                    : 'bg-secondary/50 dark:bg-white/5 border-border/50 hover:border-primary/30'
                                        }`}
                                    >
                                        <div className={`p-[0.5rem] rounded-md transition-colors ${
                                            msg.status === 'sending' ? 'bg-slate-200 dark:bg-slate-800' :
                                            msg.isMe ? 'bg-white/10' : 'bg-primary/10 text-primary'
                                        }`}>
                                            {msg.status === 'sending' ? (
                                                <Loader2 className="h-[1.25rem] w-[1.25rem] animate-spin" />
                                            ) : (() => {
                                                const ext = att.name.split('.').pop()?.toLowerCase();
                                                if (ext === 'pdf') return <FileText className="h-[1.25rem] w-[1.25rem]" />;
                                                if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return <FileSpreadsheet className="h-[1.25rem] w-[1.25rem]" />;
                                                return <File className="h-[1.25rem] w-[1.25rem]" />;
                                            })()}
                                        </div>
                                        
                                        <div className="flex-1 min-w-0 text-left">
                                            <div className={`text-[0.875rem] font-medium truncate ${
                                                msg.isMe ? 'text-white' : 'text-foreground'
                                            }`}>
                                                {(att.name || 'attachment').replace(/\\/g, '/').split('/').pop()}
                                            </div>
                                            <div className={`text-[0.625rem] font-bold uppercase tracking-wider opacity-60 ${
                                                msg.isMe ? 'text-white/70' : 'text-muted-foreground'
                                            }`}>
                                                {att.name.split('.').pop()?.toUpperCase() || 'FILE'}
                                            </div>
                                        </div>

                                        <div className={`flex-shrink-0 transition-opacity ${
                                            downloadingId === msg.id ? 'opacity-100' : 'opacity-40 group-hover/file:opacity-100'
                                        }`}>
                                            {downloadingId === msg.id ? (
                                                <Loader2 className="h-[1rem] w-[1rem] animate-spin" />
                                            ) : (
                                                <Download className={`h-[1rem] w-[1rem] ${msg.isMe ? 'text-white' : 'text-primary'}`} />
                                            )}
                                        </div>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <p className="whitespace-pre-wrap break-words leading-relaxed font-medium">
                    {msg.content}
                </p>

                {/* Reactions */}
                {msg.reactions && msg.reactions.length > 0 && (
                    <div
                        className={`absolute -bottom-3 ${msg.isMe ? '-right-1' : '-left-1'} flex items-center bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-full px-1.5 py-0.5 shadow-md border border-slate-200/50 dark:border-slate-700/50 z-[20] transition-all hover:scale-105 cursor-pointer group/reaction`}
                    >
                        <div className="flex -space-x-1">
                            {Array.from(new Set((msg.reactions || []).map(r => r.type))).slice(0, 4).map((type, i) => (
                                <div key={type} className="relative z-10" style={{ zIndex: 10 - i }}>
                                    <ReactionIcon type={type} className="text-sm leading-none filter drop-shadow-sm" />
                                </div>
                            ))}
                        </div>
                        {(msg.reactions || []).length > 1 && (
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 ml-1">
                                {(msg.reactions || []).length}
                            </span>
                        )}
                    </div>
                )}

                <div className={`flex items-center justify-end gap-1.5 mt-2 text-[10px] ${msg.isMe ? 'text-white/95' : 'text-slate-400'}`}>
                    <span className="font-semibold">{getFormattedTime(msg.createdAt)}</span>
                    {msg.isMe && (
                        <div className={`message-status-ticks ${msg.isRead ? 'read' : ''}`}>
                            {msg.isRead ? (
                                <CheckCheck className="h-3.5 w-3.5" strokeWidth={3} />
                            ) : (
                                <Check className="h-3.5 w-3.5 opacity-70" strokeWidth={3} />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    </div>
));

import { useToast } from '@/hooks/use-toast';

// --- Main Chat Hub ---
export const ChatHub: React.FC = () => {
    const { error: toastError, warning: toastWarning } = useToast();
    const { user } = useAuth();
    const { activeOverlay, setOverlay, closeOverlay } = useOverlay();
    const location = useLocation(); // Hook for route changes

    // 🧬 INSTITUTIONAL VISIBILITY: Sync with Global Overlay Policy
    const isOpen = activeOverlay === 'chat';

    // Close on click outside using robust capture-phase hook
    const containerRef = useClickOutside<HTMLDivElement>(() => {
        if (isOpen) {
            logger.debug('[ChatHub] Click-outside detected, closing overlay');
            closeOverlay();
        }
    });

    const {
        conversations,
        activeConversation,
        messages,
        presence,
        fetchConversations,
        selectConversation,
        sendMessage,
        startNewConversation,
        uploadAttachment,
        deleteMessage,
        reactToMessage,
        markAsRead,
        markMessageAsRead,
        loading: isLoadingMessages
    } = useChat();

    // IntersectionObserver for Read Receipts replaced by Virtuoso rangeChanged in Phase 3

    const [isMinimized, setIsMinimized] = useState(false);
    const [view, setView] = useState<'contacts' | 'conversation' | 'new-chat'>('contacts');
    const [newMessage, setNewMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [doctors, setDoctors] = useState<DoctorProfile[]>([]); // List of doctors for new chat
    const [doctorSearch, setDoctorSearch] = useState('');
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{
        isOpen: boolean;
        x: number;
        y: number;
        messageId: MessageId;
        isMe: boolean;
        parentWidth: number;
        parentHeight: number;
    }>({
        isOpen: false,
        x: 0,
        y: 0,
        messageId: '' as MessageId,
        isMe: false,
        parentWidth: 0,
        parentHeight: 0
    });

    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const chatWindowRef = useRef<HTMLDivElement>(null);

    const handleDownload = async (url: string, fileName: string, loadingId: string) => {
        if (!url || !fileName) {
            logger.warn('[ChatHub] Blocked incomplete download request', { url, fileName });
            return;
        }

        const correlationId = Math.random().toString(36).substring(7);

        try {
            setDownloadingId(loadingId);

            // P0 FRONTEND HARDENING: Secure asset resolution via verified pipeline
            // Synchronized with FileService v6.0 (Zero-Drift Standard)
            await secureDownload({ url, fileName });
            logger.info('[ChatHub] Institutional download successful.', { fileName, loadingId, correlationId });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            
            // Meta-Grade Response Mapping
            if (msg === 'FILE_TYPE_RESTRICTED') {
                toastWarning('Institutional Security: This file type is restricted for clinical safety.');
            } else if (msg === 'ASSET_MISSING') {
                toastError('Clinical Integrity: Asset missing on storage media. This may occur for legacy/demo records.');
            } else if (msg === 'INTEGRITY_FAILURE' || msg === 'SERVER_INTEGRITY_FAILURE') {
                toastError('Security Gate: Verified file integrity failed (Ghost Asset Blocked). Please contact support.');
            } else {
                toastError(`Communication Failure: System-level gate rejected request (${msg}).`);
            }

            logger.error('[ChatHub] Secure download failed', {
                fileName,
                loadingId,
                error: msg,
                correlationId
            });
        } finally {
            setDownloadingId(null);
        }
    };


    // Handlers for Context Menu
    const handleDeleteMessage = (messageId: MessageId, forEveryone: boolean) => {
        deleteMessage(messageId, forEveryone);
        setContextMenu(prev => ({ ...prev, isOpen: false }));
    };

    const handleReaction = (messageId: MessageId, reactionType: string) => {
        reactToMessage(messageId, reactionType);
        setContextMenu(prev => ({ ...prev, isOpen: false }));
    };

    // Initial Load ΓÇö fetch immediately when user/token is ready
    useEffect(() => {
        if (user?.id) {
            fetchConversations();
        }
    }, [user?.id, fetchConversations]);

    // Re-fetch when the window is explicitly opened to ensure sync
    useEffect(() => {
        if (isOpen) {
            // Re-sync unread state when opening
            if (activeConversation) {
                markAsRead(activeConversation.id);
            }
        }
    }, [isOpen, activeConversation, markAsRead]);

    // P1 Fix: Periodic polling to keep the unread badge fresh even if
    // sockets are dropped or browser tab was inactive.
    useEffect(() => {
        if (!user?.id) return;
        // ENTERPRISE GUARDIAN: Reduced polling to once every 5 minutes (safety net only)
        const intervalTime = 300000;

        const interval = setInterval(() => {
            fetchConversations();
        }, intervalTime);
        return () => clearInterval(interval);
    }, [user?.id, fetchConversations]);

    // Load Doctors when entering 'new-chat' view
    useEffect(() => {
        if (view === 'new-chat') {
            const loadDoctors = async () => {
                try {
                    const res = await api.get<DoctorProfile[] | { data: DoctorProfile[] }>('/doctor');

                    // P0: Strict Type Narrowing (Zero 'as unknown' fallback)
                    let doctorData: DoctorProfile[] = [];

                    if (Array.isArray(res.data)) {
                        doctorData = res.data;
                    } else if (res.data && typeof res.data === 'object' && 'data' in res.data) {
                        const potentialData = res.data.data;
                        if (Array.isArray(potentialData)) {
                            doctorData = potentialData;
                        }
                    }

                    setDoctors(doctorData);
                } catch (err: unknown) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    logger.error('[ChatHub.loadDoctors] Failed to retrieve medical specialists:', { error: errorMessage });
                    setDoctors([]); // Fail-safe: empty array
                }
            };
            loadDoctors();
        }
    }, [view]);

    // Auto-scroll handled by Virtuoso followOutput in Phase 3

    // Auto-close on route change
    useEffect(() => {
        if (isOpen) closeOverlay();
    }, [location.pathname, isOpen, closeOverlay]);

    const toggleChat = () => {
        if (isOpen) {
            closeOverlay();
        } else {
            logger.debug('[ChatHub] Activating overlay: chat');
            setOverlay('chat');
            setIsMinimized(false);
        }
    };

    const handleSelectConversation = (conversation: Conversation) => {
        selectConversation(conversation);
        setView('conversation');
    };

    const handleStartNewChat = async (doctor: DoctorProfile) => {
        // optimistically check if conversation exists
        const existing = conversations.find((c: Conversation) =>
            c.participants && Array.isArray(c.participants) &&
            c.participants.some(p => p.id === doctor.id)
        );
        if (existing) {
            handleSelectConversation(existing);
        } else {
            // P0: WhatsApp-Grade Lazy Creation
            // We pass the doctor metadata to create a local virtual conversation
            await startNewConversation(doctor.id, {
                name: doctor.name,
                specialization: doctor.specialization,
                profileImage: doctor.profileImage || undefined
            });
            setView('conversation');
        }
    };


    const handleSendMessage = () => {
        if (!newMessage.trim() || !activeConversation) return;
        sendMessage(newMessage, activeConversation.id, [], replyingTo?.id);
        setNewMessage('');
        setReplyingTo(null);
        // Keep focus
        setTimeout(() => inputRef.current?.focus(), 10);
    };

    const getOtherParticipant = useCallback((conversation: Conversation) => {
        const currentId = String(user?.id || '');
        const participants = Array.isArray(conversation.participants) ? conversation.participants : [];
        const isGroup = participants.length > 2;

        // 1. If conversation has an explicit name, prioritize it for groups
        if (conversation.name) {
            return {
                id: `group-${conversation.id}` as UserId,
                name: conversation.name,
                role: 'Case Group',
                initials: resolveInitials(conversation.name),
                profileImage: undefined,
                isGroup: true
            };
        }

        // 2. If it's a group but has no name, concatenate participant names
        if (isGroup) {
            const others = participants.filter(p => String(p.id) !== currentId);
            const groupName = others.map(p => p.name.split(' ')[0]).join(', ');
            return {
                id: `group-${conversation.id}` as UserId,
                name: groupName || 'Medical Team',
                role: 'Case Group',
                initials: 'GP',
                profileImage: undefined,
                isGroup: true
            };
        }

        // 3. Fallback to 1:1 logic
        const other = participants.find(p => String(p.id) !== currentId);

        if (!other) {
            // P0: Soft-Failure Strategy - Try to use conversation name before reverting to global fallback
            const fallbackName = conversation.name && conversation.name !== 'Direct Chat' ? conversation.name : 'Medical Team';
            
            logger.debug('[ChatHub] Institutional participant drift detected, applying fallback', { 
                conversationId: conversation.id,
                fallbackName 
            });

            return {
                id: 'unknown' as UserId,
                name: fallbackName,
                role: 'Health Professional',
                initials: resolveInitials(fallbackName),
                profileImage: undefined,
                isGroup: false
            };
        }

        const displayName = other.name && other.name !== 'Unknown' ? other.name : 'Health Professional';

        return {
            ...other,
            name: displayName,
            profileImage: String(other.id), // Ensure it maps to the profile image API trigger
            initials: resolveInitials(displayName),
            isGroup: false
        };
    }, [user?.id]);

    const filteredConversations = useMemo(() => {
        return conversations.filter(c => {
            // P0 FIX: Institutional Visibility Softening
            // Show all valid conversations regardless of lastMessage text (Google/Meta standard)
            // This prevents new or strictly encrypted threads from "vanishing" during sync.
            const hasActivity = true; // We now trust the conversations state provided by ChatProvider
            if (!hasActivity) return false;

            const other = getOtherParticipant(c);
            const matchesSearch = other.name.toLowerCase().includes(searchTerm.toLowerCase());

            return matchesSearch;
        });
    }, [conversations, searchTerm, getOtherParticipant]);


    const filteredDoctors = useMemo(() => doctors.filter(d => {
        const name = d.name || '';
        return name.toLowerCase().includes(doctorSearch.toLowerCase()) ||
            d.specialization?.toLowerCase().includes(doctorSearch.toLowerCase());
    }), [doctors, doctorSearch]);

    const getFormattedTime = (dateString: string) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            if (isToday(date)) return format(date, 'h:mm a');
            if (isYesterday(date)) return 'Yesterday';
            if (isThisWeek(date)) return format(date, 'EEEE');
            return format(date, 'dd/MM/yyyy');
        } catch {
            return '';
        }
    };



    // Close on click outside using robust capture-phase hook



    // --- Render Minimized State ---
    if (!isOpen && !isMinimized) {
        return (
            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="fixed bottom-6 right-6 z-[60]"
            >
                {/* Pulse Effect */}
                <span className="absolute inline-flex h-full w-full rounded-full animate-ping bg-teal-400 opacity-20 duration-1000"></span>

                <Button
                    onClick={toggleChat}
                    className="relative h-16 w-16 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 shadow-2xl shadow-teal-500/40 p-0 flex items-center justify-center group border border-white/20 dark:border-white/10 overflow-hidden"
                    aria-label="Open chat"
                >
                    {/* Inner Glow */}
                    <div className="absolute inset-0 bg-white/20 blur-xl group-hover:bg-white/30 transition-all duration-500" />

                    <MessageCircle className="relative h-8 w-8 text-white drop-shadow-md group-hover:scale-110 transition-transform duration-300" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                </Button>

                {(() => {
                    const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
                    if (totalUnread > 0) {
                        return (
                            <span className="chat-unread-badge animate-badge-pop">
                                {totalUnread > 9 ? '9+' : totalUnread}
                            </span>
                        );
                    }
                    return null;
                })()}
            </motion.div>
        );
    }

    if (isMinimized) {
        return (
            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="fixed bottom-6 right-6 z-[60]"
            >
                <Button
                    onClick={() => setIsMinimized(false)}
                    className="h-16 w-16 rounded-full bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/50 p-0 flex items-center justify-center group border border-slate-200 dark:border-slate-700 overflow-hidden"
                >
                    {activeConversation ? (
                        <Avatar
                            name={getOtherParticipant(activeConversation).name}
                            initials={getOtherParticipant(activeConversation).initials}
                            profileImage={getOtherParticipant(activeConversation).profileImage}
                            size="md"
                            className="h-full w-full rounded-none opacity-90 group-hover:opacity-100 transition-opacity"
                        />
                    ) : (
                        <MessageCircle className="h-8 w-8 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform duration-300" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    )}
                </Button>

                {(() => {
                    const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
                    if (totalUnread > 0) {
                        return (
                            <span className="chat-unread-badge animate-badge-pop">
                                {totalUnread > 9 ? '9+' : totalUnread}
                            </span>
                        );
                    }
                    return null;
                })()}
            </motion.div>
        );
    }

    // --- Render Main Window ---
    return (
        <div ref={containerRef} className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-4 pointer-events-none font-sans">
            <style>
                {`
                    .chat-scrollbar::-webkit-scrollbar { width: 4px; }
                    .chat-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .chat-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                    .dark .chat-scrollbar::-webkit-scrollbar-thumb { background: #475569; }

                    .chat-unread-badge {
                        position: absolute;
                        top: 0px;
                        right: 0px;
                        height: 24px;
                        min-width: 24px;
                        padding: 0 6px;
                        background-color: #DC2626; /* Error/Alert Color from guide */
                        border-radius: 9999px;
                        border: 2px solid white;
                        color: white;
                        font-size: 10px;
                        font-weight: bold;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                        z-index: 10;
                    }

                    .dark .chat-unread-badge {
                        border-color: #1a1c23;
                    }

                    .conv-unread-pill {
                        height: 18px;
                        min-width: 18px;
                        padding: 0 6px;
                        border-radius: 9999px;
                        background-color: #1BA7A6; /* Primary-600 from guide */
                        color: white;
                        font-size: 9px;
                        font-weight: 700;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.1);
                    }

                    .animate-badge-pop {
                        animation: badge-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                    }

                    @keyframes badge-pop {
                        0% { transform: scale(0); opacity: 0; }
                        70% { transform: scale(1.1); opacity: 1; }
                        100% { transform: scale(1); }
                    }

                    .message-status-ticks {
                        display: flex;
                        align-items: center;
                        color: rgba(255, 255, 255, 0.85);
                    }

                    .message-status-ticks.read {
                        color: #A7E6DB; /* Primary-300 for soft but distinct read state on dark/teal bg */
                    }
                    
                    .dark .message-status-ticks.read {
                        color: #3FC2B5; /* Primary-500 for high-visibility read state in dark mode */
                    }
                `}
            </style>
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key="chat-window"
                    drag
                    dragMomentum={false}
                    initial={{ y: 20, opacity: 0, scale: 0.95 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 20, opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="pointer-events-auto bg-white dark:bg-[#1a1c23] rounded-[var(--card-radius)] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-white/10 w-full sm:w-[420px] max-w-[calc(100vw-32px)] h-[650px] max-h-[80vh] flex flex-col overflow-hidden ring-1 ring-black/5 relative"
                    ref={chatWindowRef}
                >
                    {/* --- Helper: Header --- */}
                    <div className="shrink-0 bg-[#026355] dark:bg-[#1a1c23]/95 backdrop-blur z-20">
                        <div className="px-5 py-4 flex items-center justify-between border-b border-white/10 dark:border-white/5">
                            <div className="flex items-center gap-3">
                                {view !== 'contacts' && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-full text-white/80 hover:bg-white/10 dark:hover:bg-slate-800 transition-colors shrink-0"
                                        onClick={() => setView('contacts')}
                                    >
                                        <ChevronLeft className="h-5 w-5 text-white" />
                                    </Button>
                                )}
                                {view === 'conversation' && activeConversation ? (() => {
                                    const other = getOtherParticipant(activeConversation);
                                    const userPresence = presence[other.id as UserId];
                                    const isOnline = !other.isGroup && !!userPresence?.isOnline;
                                    const last_activity = !other.isGroup && userPresence?.last_activity ? getFormattedTime(userPresence.last_activity) : 'Unknown';

                                    return (
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="relative shrink-0">
                                                {other.isGroup ? (
                                                    <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-teal-600 dark:text-teal-400 border border-slate-200 dark:border-slate-700">
                                                        <UserPlus className="h-4 w-4" />
                                                    </div>
                                                ) : (
                                                    <div className="relative">
                                                        <Avatar
                                                            name={other.name}
                                                            initials={other.initials}
                                                            profileImage={other.profileImage}
                                                            size="sm"
                                                        />
                                                        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white dark:border-[#1a1c23] rounded-full transition-colors duration-300 ${isOnline ? 'bg-emerald-500 haemi-status-pulse' : 'bg-slate-400'}`}></span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col truncate">
                                                <h3 className="text-sm font-bold text-white truncate leading-tight">
                                                    {other.name}
                                                </h3>
                                                <span className="text-[11px] text-teal-100/80 dark:text-slate-400 font-medium truncate leading-tight capitalize">
                                                    {other.isGroup ? 'Multi-Professional Case Group' : (isOnline ? 'Online' : `Last seen at ${last_activity}`)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })() : view === 'new-chat' ? (
                                    <h3 className="text-lg font-bold text-white tracking-tight">New Message</h3>
                                ) : (
                                    <div className="flex flex-col">
                                        <h3 className="text-lg font-bold text-white tracking-tight leading-none">Messages</h3>
                                        <span className="text-[11px] text-teal-100/80 dark:text-slate-400 font-medium mt-1">
                                            {filteredConversations.length} {filteredConversations.length === 1 ? 'conversation' : 'conversations'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full text-white/60 hover:bg-white/10 dark:hover:bg-white/5 transition-colors"
                                    onClick={() => setIsMinimized(true)}
                                >
                                    <Minus className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full text-white/60 hover:text-white hover:bg-white/10 dark:hover:bg-rose-500/10 transition-colors"
                                    onClick={toggleChat}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Encryption Banner */}
                        <div className="py-2 bg-slate-100/80 dark:bg-black/40 border-b border-slate-200/50 dark:border-white/5 flex items-center justify-center gap-2 backdrop-blur-md">
                            <ShieldCheck className="h-3 w-3 text-slate-900/60 dark:text-slate-400" />
                            <span className="text-[10px] font-bold text-slate-900 dark:text-slate-300 uppercase tracking-widest text-center">
                                End-to-end Encrypted
                            </span>
                        </div>
                    </div>

                    {/* --- Content Area --- */}
                    <div className="flex-1 overflow-hidden relative bg-slate-50 dark:bg-slate-950">
                        <AnimatePresence mode="wait" initial={false}>

                            {/* VIEW: CONTACTS LIST */}
                            {view === 'contacts' && (
                                <motion.div
                                    key="contacts"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.15 }}
                                    className="h-full flex flex-col"
                                >
                                    <div className="p-3">
                                        <div className="relative group">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
                                            <input
                                                type="text"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                placeholder="Search messages..."
                                                className="w-full h-10 pl-10 pr-4 rounded-[var(--card-radius)] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-sm transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto chat-scrollbar px-2 space-y-1">
                                        {filteredConversations.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-48 text-center px-6 opacity-60 mt-10">
                                                <div className="h-12 w-12 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-3">
                                                    <MessageSquare className="h-6 w-6 text-slate-400" />
                                                </div>
                                                <p className="text-sm font-medium text-slate-00 dark:text-white">No messages yet</p>
                                                <p className="text-xs text-slate-500 mt-1">Start a consultation or chat with a doctor.</p>
                                            </div>
                                        ) : (
                                            filteredConversations.map(conv => (
                                                <ConversationItem
                                                    key={conv.id}
                                                    conv={conv}
                                                    other={getOtherParticipant(conv)}
                                                    presence={presence}
                                                    onClick={() => handleSelectConversation(conv)}
                                                    getFormattedTime={getFormattedTime}
                                                />
                                            ))
                                        )}
                                    </div>

                                    {/* FAB: New Chat */}
                                    <div className="absolute bottom-4 right-4">
                                        <Button
                                            onClick={() => setView('new-chat')}
                                            className="h-12 w-12 rounded-full bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-600/30 flex items-center justify-center text-white p-0"
                                        >
                                            <Plus className="h-6 w-6" />
                                        </Button>
                                    </div>
                                </motion.div>
                            )}

                            {/* VIEW: NEW CHAT (Doctor Directory) */}
                            {view === 'new-chat' && (
                                <motion.div
                                    key="new-chat"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.15 }}
                                    className="h-full flex flex-col bg-slate-50 dark:bg-slate-950"
                                >
                                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 z-10">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <input
                                                type="text"
                                                autoFocus
                                                value={doctorSearch}
                                                onChange={(e) => setDoctorSearch(e.target.value)}
                                                placeholder="Search doctors by name or specialty..."
                                                className="w-full h-10 pl-10 pr-4 rounded-[var(--card-radius)] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-teal-500 text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto chat-scrollbar p-2">
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 py-2">Available Specialists</div>
                                        {filteredDoctors.length === 0 ? (
                                            <div className="p-6 text-center text-slate-500 text-sm">
                                                No doctors found.
                                            </div>
                                        ) : (
                                            filteredDoctors.map((doc: DoctorProfile) => (
                                                <button
                                                    key={doc.id}
                                                    onClick={() => handleStartNewChat(doc)}
                                                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 dark:hover:bg-accent/20 hover:shadow-sm border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all text-left group"
                                                >
                                                    <Avatar name={doc.name} image={getDoctorImage(doc.name)} size="md" />
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                                                            {doc.name}
                                                        </h4>
                                                        <p className="text-xs text-teal-600 dark:text-teal-400 font-medium">
                                                            {doc.specialization || 'General Practitioner'}
                                                        </p>
                                                    </div>
                                                    <UserPlus className="h-4 w-4 text-slate-300 hover:text-teal-500" />
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </motion.div>
                            )}


                            {/* VIEW: CONVERSATION */}
                            {view === 'conversation' && (
                                <motion.div
                                    key="conversation"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.15 }}
                                    className="h-full flex flex-col relative"
                                >
                                    {/* Messages list - Phase 3 UI Virtualization */}
                                    <div className="flex-1 overflow-hidden z-0 bg-slate-50 dark:bg-slate-950">
                                        {isLoadingMessages ? (
                                            <div className="h-full flex items-center justify-center">
                                                <MedicalLoader message="Retrieving messages..." />
                                            </div>
                                        ) : messages.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full opacity-40 text-center px-8">
                                                <MessageSquare className="h-12 w-12 mb-4" />
                                                <p className="text-sm font-medium">No messages yet. Send a greeting to start the conversation.</p>
                                            </div>
                                        ) : (
                                            <Virtuoso
                                                ref={virtuosoRef}
                                                data={messages}
                                                followOutput="auto"
                                                atBottomThreshold={100}
                                                initialTopMostItemIndex={messages.length - 1}
                                                className="chat-scrollbar"
                                                style={{ height: '100%' }}
                                                increaseViewportBy={200}
                                                rangeChanged={(range) => {
                                                    const visibleItems = messages.slice(range.startIndex, range.endIndex + 1);
                                                    let shouldMarkRead = false;
                                                    visibleItems.forEach(msg => {
                                                        if (!msg.isMe && !msg.isRead) {
                                                            markMessageAsRead(msg.id);
                                                            shouldMarkRead = true;
                                                        }
                                                    });
                                                    if (shouldMarkRead && activeConversation) {
                                                        markAsRead(activeConversation.id);
                                                    }
                                                }}
                                                itemContent={(index, msg) => (
                                                    <MessageItem
                                                        msg={msg}
                                                        index={index}
                                                        onContextMenu={(e, msgId: MessageId, isMe) => {
                                                            e.preventDefault();
                                                            if (chatWindowRef.current) {
                                                                const rect = chatWindowRef.current.getBoundingClientRect();
                                                                setContextMenu({
                                                                    isOpen: true,
                                                                    x: e.clientX - rect.left,
                                                                    y: e.clientY - rect.top,
                                                                    messageId: msgId,
                                                                    isMe: isMe,
                                                                    parentWidth: rect.width,
                                                                    parentHeight: rect.height
                                                                });
                                                            }
                                                        }}
                                                        onDownload={handleDownload}
                                                        onLightbox={(src, alt) => setLightboxImage({ src, alt })}
                                                        onScrollToReply={(replyToId) => {
                                                            const targetIdx = messages.findIndex(m => m.id === replyToId);
                                                            if (targetIdx !== -1) {
                                                                virtuosoRef.current?.scrollToIndex({
                                                                    index: targetIdx,
                                                                    align: 'center',
                                                                    behavior: 'smooth'
                                                                });
                                                            }
                                                        }}
                                                        downloadingId={downloadingId}
                                                        getFormattedTime={getFormattedTime}
                                                    />
                                                )}
                                            />
                                        )}
                                    </div>

                                    {/* Input Area - Sticky Bottom with Reply Preview */}
                                    <div className="chat-footer p-3 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 shrink-0 z-10 w-full relative">
                                        <AnimatePresence>
                                            {replyingTo && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                                    className="mb-3 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur rounded-[var(--card-radius)] border-l-4 border-teal-500 overflow-hidden shadow-sm"
                                                >
                                                    <div className="p-3 flex items-start gap-3 relative">
                                                        <div className="flex-1 min-w-0 pr-6">
                                                            <p className="text-[11px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                                                <Reply className="h-3 w-3" />
                                                                Replying to {replyingTo.senderName}
                                                            </p>
                                                            <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                                                                {replyingTo.content}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => setReplyingTo(null)}
                                                            className="absolute top-2 right-2 h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                                                        >
                                                            <X className="h-3.5 w-3.5 text-slate-500" />
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <div className="chat-footer-row flex items-end gap-2">
                                            <input
                                                type="file"
                                                id="chat-attach-input"
                                                className="hidden"
                                                multiple
                                                onChange={async (e) => {
                                                    const files = Array.from(e.target.files || []);
                                                    // D3 REMEDIATION: Pre-flight 5-file institutional limit guard.
                                                    // Backend enforces this (HTTP 400) but the UX guard prevents
                                                    // wasted upload round-trips and gives the user instant feedback.
                                                    if (files.length > 5) {
                                                        toast.error(
                                                            `Attachment limit: ${files.length} files selected`,
                                                            { description: 'Maximum 5 attachments per message. Please deselect some files and try again.' }
                                                        );
                                                        e.target.value = '';
                                                        return;
                                                    }
                                                    if (files.length > 0 && activeConversation) {
                                                        const target = e.target;
                                                        const uploadPromises = files.map(file => uploadAttachment(file));
                                                        const results = await Promise.all(uploadPromises);

                                                        target.value = '';

                                                        const validAttachments = results
                                                            .filter((res): res is AttachmentDTO => !!res && !!res.url)
                                                            .map(res => ({
                                                                id: String(res.tempId || res.url),
                                                                url: res.url,
                                                                type: res.type,
                                                                name: (res.originalName || res.name || 'attachment').replace(/\\\\/g, '/').split('/').pop() || 'attachment',
                                                                size: res.size || 0
                                                            }));

                                                        if (validAttachments.length > 0) {
                                                            sendMessage('', activeConversation.id, validAttachments);
                                                        }
                                                    }
                                                }}
                                            />
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="chat-attachment-button h-10 w-10 shrink-0 rounded-full text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-800 transition-colors"
                                                onClick={() => document.getElementById('chat-attach-input')?.click()}
                                            >
                                                <Paperclip className="h-5 w-5 rotate-45" />
                                            </Button>

                                            <input
                                                ref={inputRef}
                                                className="chat-input flex-1 bg-slate-50 dark:bg-slate-900 rounded-[var(--card-radius)] border border-slate-200 dark:border-slate-800 px-6 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 text-sm outline-none transition-all focus:border-teal-600 dark:focus:border-teal-500 focus:ring-1 focus:ring-teal-600/20"
                                                placeholder="Type a message..."
                                                value={newMessage}
                                                onChange={(e) => setNewMessage(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                                            />

                                            <Button
                                                size="icon"
                                                onClick={handleSendMessage}
                                                disabled={!newMessage.trim()}
                                                className={`chat-send-button h-10 w-10 shrink-0 rounded-[var(--card-radius)] shadow-md transition-all ${newMessage.trim()
                                                    ? 'bg-teal-600 hover:bg-teal-700 text-white scale-100'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-300 scale-95'
                                                    }`}
                                            >
                                                <Send className="h-5 w-5 ml-0.5" strokeLinecap="round" strokeLinejoin="round" />
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Context Menu - Moved inside to adhere to parent widget bounds */}
                    {contextMenu.isOpen && (
                        <ChatContextMenu
                            x={contextMenu.x}
                            y={contextMenu.y}
                            isMe={contextMenu.isMe}
                            parentWidth={contextMenu.parentWidth}
                            parentHeight={contextMenu.parentHeight}
                            onClose={() => setContextMenu({ ...contextMenu, isOpen: false })}
                            onDeleteForMe={() => handleDeleteMessage(contextMenu.messageId, false)}
                            onDeleteForEveryone={() => handleDeleteMessage(contextMenu.messageId, true)}
                            onReact={(reactionType) => handleReaction(contextMenu.messageId, reactionType)}
                            onReply={() => {
                                const msg = (messages || []).find(m => m.id === contextMenu.messageId);
                                if (msg) {
                                    setReplyingTo(msg);
                                    setTimeout(() => inputRef.current?.focus(), 10);
                                }
                            }}
                            onCopy={() => {
                                const msg = (messages || []).find(m => m.id === contextMenu.messageId);
                                if (msg) copyToClipboard(msg.content);
                            }}
                        />
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Image Lightbox (WhatsApp Grade) */}
            <AnimatePresence>
                {lightboxImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-12 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md"
                        onClick={() => setLightboxImage(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 bg-gradient-to-b from-slate-200/80 to-transparent dark:from-black/60">
                                <div className="flex flex-col">
                                    <h3 className="text-slate-900 dark:text-white font-bold text-lg leading-tight uppercase tracking-wide">
                                        {lightboxImage.alt}
                                    </h3>
                                    <span className="text-slate-600 dark:text-white/60 text-xs font-medium italic">
                                        Haemi Life Secure Medical Asset
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setLightboxImage(null)}
                                        className="h-10 w-10 flex items-center justify-center rounded-full bg-slate-200/50 hover:bg-slate-300/50 dark:bg-white/10 dark:hover:bg-white/20 transition-colors text-slate-800 dark:text-white border border-slate-300 dark:border-white/20 shadow-sm"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="relative group w-full h-full flex items-center justify-center p-4">
                                <AuthenticatedImage
                                    src={lightboxImage.src}
                                    alt={lightboxImage.alt}
                                    className="max-w-full max-h-full object-contain rounded-[var(--card-radius)] shadow-2xl shadow-teal-500/10 border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-transparent"
                                    loadingFallback={<PremiumLoader size="md" />}
                                    errorFallback={
                                        // D4 REMEDIATION: Lightbox error state instead of blank modal.
                                        // Shown when the authenticated blob fetch fails (401, 404, network blip).
                                        <div className="flex flex-col items-center justify-center gap-4 p-10 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                                            <ImageOff className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                                            <p className="text-base font-semibold text-slate-700 dark:text-slate-300">Image Unavailable</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-xs">
                                                This medical asset could not be retrieved.<br />
                                                It may have been deleted or your access was revoked.
                                            </p>
                                        </div>
                                    }
                                />
                            </div>

                            <div className="absolute bottom-8 flex gap-3">
                                <Button
                                    onClick={() => lightboxImage && handleDownload(lightboxImage.src, lightboxImage.alt, 'lightbox')}
                                    disabled={downloadingId === 'lightbox'}
                                    className="bg-[#148C8B] hover:bg-[#0E6B74] dark:bg-teal-600 dark:hover:bg-teal-700 text-white font-bold px-6 h-11 rounded-[var(--card-radius)] shadow-lg shadow-teal-900/20 dark:shadow-teal-900/40 border-0 flex items-center gap-2"
                                >
                                    {downloadingId === 'lightbox' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                    Save to Device
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setLightboxImage(null)}
                                    className="bg-white/80 dark:bg-white/5 border-slate-200 dark:border-white/20 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 font-bold px-6 h-11 rounded-[var(--card-radius)] shadow-sm"
                                >
                                    Close
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
