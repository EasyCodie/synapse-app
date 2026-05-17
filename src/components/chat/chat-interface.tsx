"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import {
  Loader2,
  BookOpen,
  Bot,
  User,
  Search,
  Layers,
  CheckSquare,
  Calendar,
  FileText,
  Trash2,
  Sparkles,
  ArrowUp,
  ExternalLink,
  Plus,
  MoreVertical,
  Pencil,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  Paperclip,
  X,
  AlertCircle,
  ListTodo,
  GraduationCap,
  ClipboardCheck,
  BarChart3,
  StickyNote,
} from "lucide-react";
import { normalizeMarkdownMath } from "@/lib/markdown-math";
import { cn } from "@/lib/utils";

const MARKDOWN_REMARK_PLUGINS = [remarkMath];
const MARKDOWN_REHYPE_PLUGINS: [[typeof rehypeKatex, { strict: "warn" }]] = [
  [rehypeKatex, { strict: "warn" }],
];

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ChatSource {
  index: number;
  title: string;
  source_type: string;
  source_id: string;
  similarity?: number;
}

interface ChatAttachment {
  localId: string;
  resourceId?: string;
  title: string;
  fileSize: number;
  status: "uploading" | "ready" | "error";
  error?: string;
}

interface ToolCall {
  name: string;
  args: unknown;
  result_summary: string;
}

interface ChatMessage {
  id?: string;
  conversation_id?: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  tool_calls?: ToolCall[];
  created_at?: string;
}

interface ChatConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

interface ActiveTool {
  name: string;
  status: "running" | "done";
}

// ─── Conversation Starters ──────────────────────────────────────────────────────

const CONVERSATION_STARTERS = [
  {
    icon: Layers,
    label: "Create flashcards",
    message: "Create flashcards from my most recent upload",
  },
  {
    icon: BookOpen,
    label: "Study recommendations",
    message: "What topics should I review based on my resources?",
  },
  {
    icon: FileText,
    label: "Summarize latest upload",
    message: "Summarize my latest upload",
  },
  {
    icon: Calendar,
    label: "Upcoming deadlines",
    message: "What are my upcoming deadlines this week?",
  },
];

// ─── Tool Display Names ─────────────────────────────────────────────────────────

const TOOL_DISPLAY: Record<string, { icon: typeof Search; label: string }> = {
  search_resources: { icon: Search, label: "Searching resources" },
  list_resources: { icon: BookOpen, label: "Listing resources" },
  create_flashcards: { icon: Layers, label: "Creating flashcards" },
  delete_flashcards: { icon: Trash2, label: "Deleting flashcards" },
  create_task: { icon: CheckSquare, label: "Creating task" },
  update_task: { icon: Pencil, label: "Updating task" },
  delete_task: { icon: Trash2, label: "Deleting task" },
  list_tasks: { icon: ListTodo, label: "Listing tasks" },
  get_upcoming_deadlines: { icon: Calendar, label: "Checking deadlines" },
  summarize_resource: { icon: FileText, label: "Reading resource" },
  get_my_subjects: { icon: GraduationCap, label: "Checking subjects" },
  get_ia_status: { icon: BarChart3, label: "Checking IA status" },
  get_syllabus_progress: { icon: ClipboardCheck, label: "Checking syllabus" },
  list_notes: { icon: StickyNote, label: "Listing notes" },
};

function createLocalConversationTitle(message: string) {
  const compact = message.replace(/\s+/g, " ").trim();
  if (!compact) return "New chat";
  return compact.split(" ").slice(0, 8).join(" ").slice(0, 80);
}

const CHAT_ATTACHMENT_ACCEPT =
  ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";
const CHAT_ATTACHMENT_ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const CHAT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
const CHAT_ATTACHMENT_MAX_COUNT = 5;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Animation Variants ─────────────────────────────────────────────────────────

const messageVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  },
};

const starterVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.1 + i * 0.05, duration: 0.25 },
  }),
};

const toolIndicatorVariants = {
  hidden: { opacity: 0, x: -8, height: 0 },
  visible: { opacity: 1, x: 0, height: "auto", transition: { duration: 0.2 } },
  exit: { opacity: 0, x: 8, height: 0, transition: { duration: 0.15 } },
};

// ─── Main Component ─────────────────────────────────────────────────────────────

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [openConversationMenu, setOpenConversationMenu] = useState<string | null>(null);
  const [sidebarPinned, setSidebarPinned] = useState(true);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [activeTools, setActiveTools] = useState<ActiveTool[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const historyLoadStartedRef = useRef(false);

  const loadConversation = useCallback(async (conversationId: string) => {
    setHistoryLoaded(false);
    setStreamingText("");
    setActiveTools([]);
    setActiveConversationId(conversationId);

    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`);
      if (!res.ok) {
        setMessages([]);
        return;
      }

      const { messages: loadedMessages } = (await res.json()) as {
        messages?: ChatMessage[];
      };
      setMessages(loadedMessages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setHistoryLoaded(true);
    }
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations");
      if (!res.ok) return [];

      const { conversations: loadedConversations } = (await res.json()) as {
        conversations?: ChatConversation[];
      };
      const nextConversations = loadedConversations ?? [];
      setConversations(nextConversations);
      return nextConversations;
    } catch {
      return [];
    }
  }, []);

  // Load chat history on mount
  useEffect(() => {
    if (historyLoadStartedRef.current) return;
    historyLoadStartedRef.current = true;

    async function loadHistory() {
      try {
        const loadedConversations = await refreshConversations();
        const firstConversation = loadedConversations[0];

        if (firstConversation) {
          await loadConversation(firstConversation.id);
          return;
        }

        const historyRes = await fetch("/api/chat/history");
        if (historyRes.ok) {
          const { conversation, messages: history } = (await historyRes.json()) as {
            conversation?: ChatConversation | null;
            messages?: ChatMessage[];
          };

          if (conversation) {
            setConversations([conversation]);
            setActiveConversationId(conversation.id);
          }

          setMessages(history ?? []);
        }
      } catch {
        // History load is best-effort
      } finally {
        setHistoryLoaded(true);
      }
    }
    loadHistory();
  }, [loadConversation, refreshConversations]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, activeTools]);

  const handleAttachmentUpload = useCallback(async (file: File) => {
    setAttachmentError(null);

    if (attachments.filter((attachment) => attachment.status !== "error").length >= CHAT_ATTACHMENT_MAX_COUNT) {
      setAttachmentError(`You can attach up to ${CHAT_ATTACHMENT_MAX_COUNT} files.`);
      return;
    }

    if (!CHAT_ATTACHMENT_ALLOWED_TYPES.has(file.type)) {
      setAttachmentError("Attach PDF, DOCX, or TXT files only.");
      return;
    }

    if (file.size > CHAT_ATTACHMENT_MAX_BYTES) {
      setAttachmentError("File too large. Chat attachments are limited to 10MB.");
      return;
    }

    const localId = `${file.name}-${file.size}-${Date.now()}`;
    const uploadingAttachment: ChatAttachment = {
      localId,
      title: file.name,
      fileSize: file.size,
      status: "uploading",
    };

    setAttachments((prev) => [...prev, uploadingAttachment]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name);

      const res = await fetch("/api/chat/attachments", {
        method: "POST",
        body: formData,
      });

      const payload = (await res.json()) as {
        resource?: { id?: string; title?: string; file_size?: number };
        error?: string;
      };

      if (!res.ok || !payload.resource?.id) {
        throw new Error(payload.error || "Upload failed");
      }

      setAttachments((prev) =>
        prev.map((attachment) =>
          attachment.localId === localId
            ? {
                ...attachment,
                resourceId: payload.resource!.id,
                title: payload.resource!.title || attachment.title,
                fileSize: payload.resource!.file_size ?? attachment.fileSize,
                status: "ready",
              }
            : attachment
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setAttachments((prev) =>
        prev.map((attachment) =>
          attachment.localId === localId
            ? { ...attachment, status: "error", error: message }
            : attachment
        )
      );
      setAttachmentError(message);
    }
  }, [attachments]);

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    files.forEach((file) => void handleAttachmentUpload(file));
  }

  function removeAttachment(localId: string) {
    setAttachments((prev) => prev.filter((attachment) => attachment.localId !== localId));
    setAttachmentError(null);
  }

  // Send message handler
  const handleSend = useCallback(
    async (messageOverride?: string) => {
      const readyAttachments = attachments.filter(
        (attachment) => attachment.status === "ready" && attachment.resourceId
      );
      const hasUploadingAttachments = attachments.some(
        (attachment) => attachment.status === "uploading"
      );
      const trimmed = (messageOverride ?? input).trim();
      const messageToSend = trimmed || (readyAttachments.length > 0 ? "Please summarize the attached resource(s)." : "");
      if (!messageToSend || loading || hasUploadingAttachments) return;

      const userMessage: ChatMessage = {
        role: "user",
        content: messageToSend,
        sources: readyAttachments.map((attachment, index) => ({
          index: index + 1,
          title: attachment.title,
          source_type: "attachment_resource",
          source_id: attachment.resourceId!,
        })),
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setAttachments((prev) => prev.filter((attachment) => attachment.status === "error"));
      setAttachmentError(null);
      setLoading(true);
      setStreamingText("");
      setActiveTools([]);

      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageToSend,
            conversation_id: activeConversationId ?? undefined,
            attachment_resource_ids: readyAttachments.map(
              (attachment) => attachment.resourceId
            ),
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: err.error || "Something went wrong. Please try again.",
            },
          ]);
          setLoading(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);

            try {
              const parsed = JSON.parse(data) as {
                type: string;
                text?: string;
                name?: string;
                args?: unknown;
                success?: boolean;
                error?: string;
                id?: string;
                title?: string;
                sources?: ChatSource[];
              };

              switch (parsed.type) {
                case "conversation":
                  if (parsed.id) {
                    setActiveConversationId(parsed.id);
                    setConversations((prev) => {
                      const now = new Date().toISOString();
                      const existing = prev.find((conversation) => conversation.id === parsed.id);
                      const updated: ChatConversation = {
                        id: parsed.id!,
                        title: parsed.title || existing?.title || createLocalConversationTitle(messageToSend),
                        created_at: existing?.created_at ?? now,
                        updated_at: now,
                        last_message_at: now,
                      };

                      return [
                        updated,
                        ...prev.filter((conversation) => conversation.id !== parsed.id),
                      ];
                    });
                  }
                  break;

                case "text":
                  if (parsed.text) {
                    fullText += parsed.text;
                    setStreamingText(fullText);
                  }
                  break;

                case "tool_start":
                  if (parsed.name) {
                    setActiveTools((prev) => [
                      ...prev,
                      { name: parsed.name!, status: "running" },
                    ]);
                  }
                  break;

                case "tool_result":
                  if (parsed.name) {
                    setActiveTools((prev) =>
                      prev.map((t) =>
                        t.name === parsed.name ? { ...t, status: "done" } : t
                      )
                    );
                  }
                  break;

                case "error":
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: "assistant",
                      content: parsed.error || "An error occurred.",
                    },
                  ]);
                  break;

                case "done":
                  if (fullText) {
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: "assistant",
                        content: fullText,
                        sources: parsed.sources?.length ? parsed.sources : undefined,
                      },
                    ]);
                  }
                  setStreamingText("");
                  setActiveTools([]);
                  void refreshConversations();
                  break;
              }
            } catch {
              // Skip malformed lines
            }
          }
        }

        // Handle case where stream ends without explicit "done"
        if (fullText && streamingText) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: fullText },
          ]);
          setStreamingText("");
          setActiveTools([]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Network error. Please check your connection.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [activeConversationId, attachments, input, loading, refreshConversations, streamingText]
  );

  // Clear conversation
  async function handleClear() {
    try {
      const suffix = activeConversationId
        ? `?conversation_id=${encodeURIComponent(activeConversationId)}`
        : "";
      await fetch(`/api/chat/history${suffix}`, { method: "DELETE" });
      setMessages([]);
      void refreshConversations();
    } catch {
      // Best effort
    }
  }

  function handleNewChat() {
    setActiveConversationId(null);
    setMessages([]);
    setInput("");
    setAttachments([]);
    setAttachmentError(null);
    setStreamingText("");
    setActiveTools([]);
    setHistoryLoaded(true);
    setOpenConversationMenu(null);
    inputRef.current?.focus();
  }

  async function handleRenameConversation(conversation: ChatConversation) {
    const title = window.prompt("Rename chat", conversation.title)?.trim();
    if (!title) return;

    const res = await fetch(`/api/chat/conversations/${conversation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    if (!res.ok) return;

    const { conversation: updatedConversation } = (await res.json()) as {
      conversation: ChatConversation;
    };
    setConversations((prev) =>
      prev.map((item) =>
        item.id === updatedConversation.id ? updatedConversation : item
      )
    );
    setOpenConversationMenu(null);
  }

  async function handleDeleteConversation(conversationId: string) {
    if (!window.confirm("Delete this chat history?")) return;

    const res = await fetch(`/api/chat/conversations/${conversationId}`, {
      method: "DELETE",
    });

    if (!res.ok) return;

    const remainingConversations = conversations.filter(
      (conversation) => conversation.id !== conversationId
    );
    setConversations(remainingConversations);
    setOpenConversationMenu(null);

    if (activeConversationId !== conversationId) return;

    const nextConversation = remainingConversations[0];
    if (nextConversation) {
      await loadConversation(nextConversation.id);
    } else {
      handleNewChat();
    }
  }

  // Key handler
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isEmpty = messages.length === 0 && !streamingText;
  const sidebarVisible = sidebarPinned || sidebarHovered;
  const hasUploadingAttachments = attachments.some(
    (attachment) => attachment.status === "uploading"
  );
  const hasReadyAttachments = attachments.some(
    (attachment) => attachment.status === "ready" && attachment.resourceId
  );
  const canSend = Boolean(input.trim() || hasReadyAttachments) && !loading && !hasUploadingAttachments;

  const handleSidebarMouseEnter = useCallback(() => {
    setSidebarHovered(true);
  }, []);

  const handleSidebarMouseLeave = useCallback(() => {
    setSidebarHovered(false);
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Sidebar trigger strip — visible only when sidebar is collapsed */}
      {!sidebarPinned && (
        <div
          className="hidden md:flex shrink-0 w-11 flex-col items-center pt-3 border-r border-hairline bg-surface-1/50 z-10"
          onMouseEnter={handleSidebarMouseEnter}
          onMouseLeave={handleSidebarMouseLeave}
        >
          <motion.button
            onClick={() => setSidebarPinned(true)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-tertiary hover:text-ink-subtle hover:bg-surface-2 transition-colors duration-200"
            aria-label="Expand chat history"
            title="Expand chat history"
          >
            <PanelLeft className="h-4 w-4" />
          </motion.button>
        </div>
      )}

      {/* Sidebar — pinned (inline) or hovered (overlay) */}
      <AnimatePresence>
        {sidebarVisible && (
          <ChatRecentsSidebar
            conversations={conversations}
            activeConversationId={activeConversationId}
            openConversationMenu={openConversationMenu}
            isPinned={sidebarPinned}
            onNewChat={handleNewChat}
            onSelectConversation={loadConversation}
            onToggleMenu={(conversationId) =>
              setOpenConversationMenu((current) =>
                current === conversationId ? null : conversationId
              )
            }
            onRenameConversation={handleRenameConversation}
            onDeleteConversation={handleDeleteConversation}
            onCollapse={() => {
              setSidebarPinned(false);
              setSidebarHovered(false);
            }}
            onMouseEnter={handleSidebarMouseEnter}
            onMouseLeave={handleSidebarMouseLeave}
          />
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col h-full bg-canvas">
      {/* Header — only shown when conversation exists */}
      <AnimatePresence>
        {messages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center justify-between px-4 py-3 border-b border-hairline"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-body-sm text-ink font-medium">
                Synapse AI
              </span>
              <span className="text-caption text-ink-tertiary">
                · {messages.filter((m) => m.role === "user").length} message{messages.filter((m) => m.role === "user").length !== 1 ? "s" : ""}
              </span>
            </div>
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-caption text-ink-tertiary hover:text-ink-subtle hover:bg-surface-2 transition-colors duration-200 min-h-[32px]"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {/* Loading history state */}
        {!historyLoaded && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <span className="text-caption text-ink-tertiary">Loading conversation...</span>
            </div>
          </div>
        )}

        {/* Empty state with conversation starters */}
        {historyLoaded && isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="w-14 h-14 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center mb-5"
            >
              <Sparkles className="w-7 h-7 text-primary" />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.25 }}
              className="text-card-title text-ink mb-2"
            >
              Synapse AI
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.25 }}
              className="text-body-sm text-ink-subtle max-w-md mb-8"
            >
              Your AI study assistant. Ask about your resources, create
              flashcards, manage tasks, or get help understanding course material.
            </motion.p>

            {/* Conversation starters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
              {CONVERSATION_STARTERS.map((starter, i) => (
                <motion.button
                  key={starter.label}
                  custom={i}
                  variants={starterVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover={{ scale: 1.02, borderColor: "var(--hairline-strong)" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSend(starter.message)}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-lg bg-surface-1 border border-hairline text-left transition-colors duration-200"
                >
                  <div className="w-8 h-8 rounded-md bg-surface-2 flex items-center justify-center shrink-0">
                    <starter.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-body-sm text-ink-muted">
                    {starter.label}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        <div className="space-y-6 max-w-3xl mx-auto">
          {messages.map((msg, i) => (
            <motion.div
              key={msg.id || `msg-${i}`}
              variants={messageVariants}
              initial="hidden"
              animate="visible"
            >
              <MessageBubble message={msg} />
            </motion.div>
          ))}

          {/* Active tool indicators */}
          <AnimatePresence>
            {activeTools.length > 0 && !streamingText && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/8 border border-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="flex flex-col gap-2 pt-1.5">
                  <AnimatePresence mode="popLayout">
                    {activeTools.map((tool, i) => {
                      const display = TOOL_DISPLAY[tool.name];
                      const Icon = display?.icon ?? Search;
                      return (
                        <motion.div
                          key={`${tool.name}-${i}`}
                          variants={toolIndicatorVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          className="flex items-center gap-2 text-body-sm"
                        >
                          {tool.status === "running" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full bg-semantic-success/20 flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                            </div>
                          )}
                          <span className={tool.status === "running" ? "text-ink-muted" : "text-ink-subtle"}>
                            {display?.label ?? tool.name}
                            {tool.status === "running" && (
                              <span className="text-ink-tertiary ml-1">...</span>
                            )}
                          </span>
                          {tool.status === "done" && (
                            <Icon className="w-3 h-3 text-ink-tertiary" />
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Streaming message */}
          {streamingText && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/8 border border-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <div className="text-body-sm text-ink prose-chat">
                  <ReactMarkdown
                    remarkPlugins={MARKDOWN_REMARK_PLUGINS}
                    rehypePlugins={MARKDOWN_REHYPE_PLUGINS}
                  >
                    {normalizeMarkdownMath(streamingText)}
                  </ReactMarkdown>
                  <span className="inline-block w-[3px] h-[18px] bg-primary/70 rounded-full animate-pulse ml-0.5 align-middle" />
                </div>
              </div>
            </motion.div>
          )}

          {/* Loading spinner (before streaming starts) */}
          <AnimatePresence>
            {loading && !streamingText && activeTools.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex gap-3 items-start"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/8 border border-primary/15 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <ThinkingDots />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-hairline p-4">
        <div className="max-w-3xl mx-auto relative">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={CHAT_ATTACHMENT_ACCEPT}
            multiple
            onChange={handleFileInputChange}
          />

          <AnimatePresence>
            {(attachments.length > 0 || attachmentError) && (
              <motion.div
                initial={{ opacity: 0, y: 8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: 6, height: 0 }}
                className="mb-2 overflow-hidden"
              >
                <div className="flex flex-wrap gap-2 rounded-lg border border-hairline bg-surface-1 px-3 py-2">
                  {attachments.map((attachment) => (
                    <motion.div
                      key={attachment.localId}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      className={cn(
                        "inline-flex max-w-[260px] items-center gap-2 rounded-md border px-2.5 py-1.5 text-caption",
                        attachment.status === "error"
                          ? "border-hairline-strong bg-surface-2 text-ink-subtle"
                          : "border-hairline bg-surface-2 text-ink-muted"
                      )}
                      title={attachment.error || attachment.title}
                    >
                      {attachment.status === "uploading" ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                      ) : attachment.status === "error" ? (
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                      )}
                      <span className="truncate">{attachment.title}</span>
                      <span className="shrink-0 text-ink-tertiary">
                        {formatFileSize(attachment.fileSize)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(attachment.localId)}
                        className="-mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-tertiary transition-colors duration-150 hover:bg-surface-3 hover:text-ink-subtle"
                        aria-label={`Remove ${attachment.title}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </motion.div>
                  ))}

                  {attachmentError && (
                    <div className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface-2 px-2.5 py-1.5 text-caption text-ink-tertiary">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>{attachmentError}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your resources..."
            rows={1}
            className="w-full resize-none pl-12 pr-12 py-3.5 bg-surface-1 border border-hairline rounded-lg text-body-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:border-hairline-strong transition-colors duration-200 min-h-[48px] max-h-[160px]"
            suppressHydrationWarning
            style={{
              height: "auto",
              overflow: input.split("\n").length > 4 ? "auto" : "hidden",
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
            }}
          />
          {/* Attachment button — overlaid inside the textarea */}
          <motion.button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || hasUploadingAttachments}
            whileHover={{ scale: !loading && !hasUploadingAttachments ? 1.05 : 1 }}
            whileTap={{ scale: !loading && !hasUploadingAttachments ? 0.92 : 1 }}
            className={cn(
              "absolute left-2 bottom-2 p-2 rounded-md transition-all duration-200",
              loading || hasUploadingAttachments
                ? "text-ink-tertiary opacity-60"
                : "text-ink-tertiary hover:bg-surface-2 hover:text-ink-subtle"
            )}
            aria-label="Attach PDF, DOCX, or TXT"
            title="Attach PDF, DOCX, or TXT"
            suppressHydrationWarning
          >
            <Paperclip className="w-4 h-4" />
          </motion.button>
          {/* Send button — overlaid inside the textarea */}
          <motion.button
            onClick={() => handleSend()}
            disabled={!canSend}
            whileHover={{ scale: canSend ? 1.05 : 1 }}
            whileTap={{ scale: canSend ? 0.92 : 1 }}
            className={cn(
              "absolute right-2 bottom-2 p-2 rounded-md transition-all duration-200",
              canSend
                ? "bg-primary text-on-primary"
                : "bg-transparent text-ink-tertiary"
            )}
            aria-label="Send message"
            suppressHydrationWarning
          >
            <ArrowUp className="w-4 h-4" />
          </motion.button>
        </div>
        <p className="text-center text-[11px] text-ink-tertiary mt-2 max-w-3xl mx-auto">
          Synapse searches your uploaded resources. Responses may not always be accurate.
        </p>
      </div>
      </div>
    </div>
  );
}

interface ChatRecentsSidebarProps {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  openConversationMenu: string | null;
  isPinned: boolean;
  onNewChat: () => void;
  onSelectConversation: (conversationId: string) => void;
  onToggleMenu: (conversationId: string) => void;
  onRenameConversation: (conversation: ChatConversation) => void;
  onDeleteConversation: (conversationId: string) => void;
  onCollapse: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const sidebarItemVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: 0.06 * i,
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  }),
};

const menuVariants = {
  hidden: { opacity: 0, scale: 0.92, y: -4 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    y: -4,
    transition: { duration: 0.1 },
  },
};

function ChatRecentsSidebar({
  conversations,
  activeConversationId,
  openConversationMenu,
  isPinned,
  onNewChat,
  onSelectConversation,
  onToggleMenu,
  onRenameConversation,
  onDeleteConversation,
  onCollapse,
  onMouseEnter,
  onMouseLeave,
}: ChatRecentsSidebarProps) {
  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 260, opacity: 1 }}
      exit={{ width: 0, opacity: 0, transition: { duration: 0.15, ease: "easeIn" } }}
      transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.8 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "hidden md:flex shrink-0 flex-col border-r border-hairline bg-surface-1 overflow-hidden h-full",
        !isPinned && "absolute left-11 top-0 bottom-0 z-20 shadow-xl shadow-black/30 rounded-r-lg"
      )}
    >
      {/* Header with new chat + collapse */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3, ease: "easeOut" }}
        className="flex items-center gap-2 border-b border-hairline px-3 py-3"
      >
        <motion.button
          onClick={onNewChat}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          className="flex min-h-[36px] flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-button text-on-primary transition-colors duration-200 hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          New chat
        </motion.button>
        <motion.button
          onClick={onCollapse}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-tertiary hover:text-ink-subtle hover:bg-surface-2 transition-colors duration-200"
          aria-label="Collapse chat history"
          title="Collapse chat history"
        >
          <PanelLeftClose className="h-4 w-4" />
        </motion.button>
      </motion.div>

      {/* Conversations list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="px-2 pb-2 text-eyebrow text-ink-tertiary"
        >
          Recents
        </motion.p>

        {conversations.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.3 }}
            className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center"
          >
            <MessageSquare className="h-5 w-5 text-ink-tertiary" />
            <p className="text-caption text-ink-tertiary">
              Your chat history will appear here.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-0.5">
            {conversations.map((conversation, i) => {
              const active = conversation.id === activeConversationId;
              const menuOpen = openConversationMenu === conversation.id;

              return (
                <motion.div
                  key={conversation.id}
                  custom={i}
                  variants={sidebarItemVariants}
                  initial="hidden"
                  animate="visible"
                  className="relative group"
                >
                  <button
                    onClick={() => onSelectConversation(conversation.id)}
                    className={cn(
                      "relative flex min-h-[36px] w-full items-center gap-2 rounded-md px-2.5 py-2 pr-9 text-left text-body-sm transition-all duration-200",
                      active
                        ? "bg-surface-2 text-ink"
                        : "text-ink-subtle hover:bg-surface-2/50 hover:text-ink-muted"
                    )}
                    title={conversation.title}
                  >
                    {/* Active indicator pill */}
                    <AnimatePresence>
                      {active && (
                        <motion.div
                          layoutId="chat-active-indicator"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary"
                          initial={{ opacity: 0, scaleY: 0 }}
                          animate={{ opacity: 1, scaleY: 1 }}
                          exit={{ opacity: 0, scaleY: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        />
                      )}
                    </AnimatePresence>
                    <span className="truncate">{conversation.title}</span>
                  </button>

                  {/* Menu toggle */}
                  <motion.button
                    onClick={() => onToggleMenu(conversation.id)}
                    initial={false}
                    animate={{ opacity: active || menuOpen ? 1 : 0 }}
                    whileHover={{ scale: 1.1 }}
                    className={cn(
                      "absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-ink-tertiary transition-colors duration-200 hover:bg-surface-3 hover:text-ink-subtle",
                      !active && !menuOpen && "group-hover:opacity-100"
                    )}
                    aria-label={`Open actions for ${conversation.title}`}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </motion.button>

                  {/* Context menu */}
                  <AnimatePresence>
                    {menuOpen && (
                      <motion.div
                        variants={menuVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="absolute right-1 top-9 z-30 w-[140px] rounded-lg border border-hairline bg-surface-3 p-1 shadow-lg shadow-black/20"
                      >
                        <button
                          onClick={() => onRenameConversation(conversation)}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-caption text-ink-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
                        >
                          <Pencil className="h-3 w-3" />
                          Rename
                        </button>
                        <button
                          onClick={() => onDeleteConversation(conversation.id)}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-caption text-ink-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.aside>
  );
}

// ─── Thinking Dots ──────────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-ink-tertiary"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ─── Message Bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
          isUser
            ? "bg-surface-3 border border-hairline"
            : "bg-primary/8 border border-primary/15"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-ink-subtle" />
        ) : (
          <Bot className="w-4 h-4 text-primary" />
        )}
      </div>
      <div className={cn("flex-1 min-w-0", isUser && "flex flex-col items-end")}>
        {isUser ? (
          <div className="text-body-sm text-ink whitespace-pre-wrap bg-surface-2 border border-hairline rounded-lg px-4 py-3 max-w-[85%]">
            {message.content}
          </div>
        ) : (
          <div className="text-body-sm text-ink prose-chat">
            <ReactMarkdown
              remarkPlugins={MARKDOWN_REMARK_PLUGINS}
              rehypePlugins={MARKDOWN_REHYPE_PLUGINS}
            >
              {normalizeMarkdownMath(message.content)}
            </ReactMarkdown>
          </div>
        )}

        {/* Tool calls indicator */}
        {message.tool_calls && message.tool_calls.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {message.tool_calls.map((tc, i) => {
              const display = TOOL_DISPLAY[tc.name];
              const Icon = display?.icon ?? Search;
              return (
                <div
                  key={i}
                  className="inline-flex items-center gap-1.5 px-2 py-1 bg-surface-1 border border-hairline rounded-md text-caption text-ink-subtle"
                >
                  <Icon className="w-3 h-3 text-primary/70" />
                  <span>{display?.label ?? tc.name}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <SourcesList sources={message.sources} />
        )}
      </div>
    </div>
  );
}

// ─── Sources List ───────────────────────────────────────────────────────────────

function SourcesList({ sources }: { sources: ChatSource[] }) {
  return (
    <div className="mt-3">
      <p className="text-caption text-ink-tertiary mb-2 flex items-center gap-1.5">
        <BookOpen className="w-3 h-3" />
        Sources
      </p>
      <div className="flex flex-wrap gap-2">
        {sources.map((source) => {
          const href =
            source.source_type === "resource" ||
            source.source_type === "attachment_resource"
              ? `/resources?resource=${encodeURIComponent(source.source_id)}`
              : `/search?source=${encodeURIComponent(source.source_id)}`;

          return (
          <a
            key={`${source.source_type}-${source.source_id}-${source.index}`}
            href={href}
            className="group inline-flex items-center gap-2 px-3 py-1.5 bg-surface-1 border border-hairline rounded-md hover:border-hairline-strong transition-colors duration-200"
          >
            <span className="flex items-center justify-center w-4 h-4 rounded bg-primary/10 text-[10px] font-medium text-primary">
              {source.index}
            </span>
            <span className="text-caption text-ink-muted truncate max-w-[140px]">
              {source.title}
            </span>
            {typeof source.similarity === "number" ? (
              <span className="text-[10px] text-ink-tertiary tabular-nums">
                {(source.similarity * 100).toFixed(0)}%
              </span>
            ) : (
              <span className="text-[10px] text-ink-tertiary">attached</span>
            )}
            <ExternalLink className="w-3 h-3 text-ink-tertiary opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </a>
        );
        })}
      </div>
    </div>
  );
}
