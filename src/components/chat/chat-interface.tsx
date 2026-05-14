"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ChatSource {
  index: number;
  title: string;
  source_type: string;
  source_id: string;
  similarity: number;
}

interface ToolCall {
  name: string;
  args: unknown;
  result_summary: string;
}

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  tool_calls?: ToolCall[];
  created_at?: string;
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
  create_task: { icon: CheckSquare, label: "Creating task" },
  get_upcoming_deadlines: { icon: Calendar, label: "Checking deadlines" },
  summarize_resource: { icon: FileText, label: "Reading resource" },
};

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
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [activeTools, setActiveTools] = useState<ActiveTool[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyLoadStartedRef = useRef(false);

  // Load chat history on mount
  useEffect(() => {
    if (historyLoadStartedRef.current) return;
    historyLoadStartedRef.current = true;

    async function loadHistory() {
      try {
        const res = await fetch("/api/chat/history");
        if (res.ok) {
          const { messages: history } = await res.json();
          if (history && history.length > 0) {
            setMessages(
              history.map((m: ChatMessage) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                sources: m.sources,
                tool_calls: m.tool_calls,
                created_at: m.created_at,
              }))
            );
          }
        }
      } catch {
        // History load is best-effort
      } finally {
        setHistoryLoaded(true);
      }
    }
    loadHistory();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, activeTools]);

  // Send message handler
  const handleSend = useCallback(
    async (messageOverride?: string) => {
      const trimmed = (messageOverride ?? input).trim();
      if (!trimmed || loading) return;

      const userMessage: ChatMessage = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
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
          body: JSON.stringify({ message: trimmed }),
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
              };

              switch (parsed.type) {
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
                      { role: "assistant", content: fullText },
                    ]);
                  }
                  setStreamingText("");
                  setActiveTools([]);
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
    [input, loading, streamingText]
  );

  // Clear conversation
  async function handleClear() {
    try {
      await fetch("/api/chat/history", { method: "DELETE" });
      setMessages([]);
    } catch {
      // Best effort
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

  return (
    <div className="flex flex-col h-full">
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
                  <ReactMarkdown>{streamingText}</ReactMarkdown>
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
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your resources..."
            rows={1}
            className="w-full resize-none pl-4 pr-12 py-3.5 bg-surface-1 border border-hairline rounded-lg text-body-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:border-hairline-strong transition-colors duration-200 min-h-[48px] max-h-[160px]"
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
          {/* Send button — overlaid inside the textarea */}
          <motion.button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            whileHover={{ scale: input.trim() && !loading ? 1.05 : 1 }}
            whileTap={{ scale: input.trim() && !loading ? 0.92 : 1 }}
            className={cn(
              "absolute right-2 bottom-2 p-2 rounded-md transition-all duration-200",
              input.trim() && !loading
                ? "bg-primary text-on-primary"
                : "bg-transparent text-ink-tertiary"
            )}
          >
            <ArrowUp className="w-4 h-4" />
          </motion.button>
        </div>
        <p className="text-center text-[11px] text-ink-tertiary mt-2 max-w-3xl mx-auto">
          Synapse searches your uploaded resources. Responses may not always be accurate.
        </p>
      </div>
    </div>
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
            <ReactMarkdown>{message.content}</ReactMarkdown>
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
        {sources.map((source) => (
          <div
            key={source.index}
            className="group inline-flex items-center gap-2 px-3 py-1.5 bg-surface-1 border border-hairline rounded-md hover:border-hairline-strong transition-colors duration-200 cursor-default"
          >
            <span className="flex items-center justify-center w-4 h-4 rounded bg-primary/10 text-[10px] font-medium text-primary">
              {source.index}
            </span>
            <span className="text-caption text-ink-muted truncate max-w-[140px]">
              {source.title}
            </span>
            <span className="text-[10px] text-ink-tertiary tabular-nums">
              {(source.similarity * 100).toFixed(0)}%
            </span>
            <ExternalLink className="w-3 h-3 text-ink-tertiary opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
