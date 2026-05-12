"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import {
  Send,
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
  create_flashcards: { icon: Layers, label: "Creating flashcards" },
  create_task: { icon: CheckSquare, label: "Creating task" },
  get_upcoming_deadlines: { icon: Calendar, label: "Checking deadlines" },
  summarize_resource: { icon: FileText, label: "Reading resource" },
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

  // Load chat history on mount
  useEffect(() => {
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
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

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
      {/* Header */}
      {messages.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            <span className="text-body-sm text-ink font-medium">
              Synapse AI
            </span>
          </div>
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-caption text-ink-subtle hover:text-ink hover:bg-surface-2 transition-colors duration-200"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {/* Loading history state */}
        {!historyLoaded && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 text-ink-subtle animate-spin" />
          </div>
        )}

        {/* Empty state with conversation starters */}
        {historyLoaded && isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-card-title text-ink mb-2">Synapse AI</h2>
            <p className="text-body-sm text-ink-subtle max-w-md mb-8">
              Your AI study assistant. I can search your resources, create
              flashcards, manage tasks, and help you understand your course
              material.
            </p>

            {/* Conversation starters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
              {CONVERSATION_STARTERS.map((starter) => (
                <button
                  key={starter.label}
                  onClick={() => handleSend(starter.message)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-1 border border-hairline text-left hover:border-hairline-strong hover:bg-surface-2 transition-colors duration-200"
                >
                  <starter.icon className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-body-sm text-ink-muted">
                    {starter.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg, i) => (
          <MessageBubble key={msg.id || i} message={msg} />
        ))}

        {/* Active tool indicators */}
        {activeTools.length > 0 && !streamingText && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="flex flex-col gap-2">
              {activeTools.map((tool, i) => {
                const display = TOOL_DISPLAY[tool.name];
                const Icon = display?.icon ?? Search;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-body-sm text-ink-subtle"
                  >
                    {tool.status === "running" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    ) : (
                      <Icon className="w-3.5 h-3.5 text-primary" />
                    )}
                    <span>
                      {display?.label ?? tool.name}
                      {tool.status === "running" ? "..." : " ✓"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Streaming message */}
        {streamingText && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-body-sm text-ink prose-chat">
                <ReactMarkdown>{streamingText}</ReactMarkdown>
                <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5" />
              </div>
            </div>
          </div>
        )}

        {/* Loading spinner (before streaming starts) */}
        {loading && !streamingText && activeTools.length === 0 && (
          <div className="flex gap-3 items-center">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="flex items-center gap-2 text-ink-subtle">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-body-sm">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-hairline p-4">
        <div className="flex gap-3 items-end max-w-3xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your resources..."
            rows={1}
            className="flex-1 resize-none px-4 py-3 bg-surface-1 border border-hairline rounded-lg text-body-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:border-hairline-strong min-h-[44px] max-h-[120px]"
            style={{
              height: "auto",
              overflow: input.split("\n").length > 3 ? "auto" : "hidden",
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className={cn(
              "p-3 rounded-lg transition-colors shrink-0",
              input.trim() && !loading
                ? "bg-primary hover:bg-primary-hover text-on-primary"
                : "bg-surface-2 text-ink-subtle cursor-not-allowed"
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Message Bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className="flex gap-3">
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          isUser ? "bg-surface-3" : "bg-primary/10"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-ink-subtle" />
        ) : (
          <Bot className="w-4 h-4 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        {isUser ? (
          <div className="text-body-sm text-ink whitespace-pre-wrap">
            {message.content}
          </div>
        ) : (
          <div className="text-body-sm text-ink prose-chat">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}

        {/* Tool calls indicator */}
        {message.tool_calls && message.tool_calls.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.tool_calls.map((tc, i) => {
              const display = TOOL_DISPLAY[tc.name];
              const Icon = display?.icon ?? Search;
              return (
                <div
                  key={i}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-surface-2 border border-hairline rounded text-caption text-ink-subtle"
                >
                  <Icon className="w-3 h-3" />
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
    <div className="mt-3 flex flex-wrap gap-2">
      {sources.map((source) => (
        <div
          key={source.index}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-2 border border-hairline rounded-md text-caption text-ink-subtle"
        >
          <BookOpen className="w-3 h-3" />
          <span>
            [{source.index}] {source.title}
          </span>
          <span className="text-ink-tertiary">
            {(source.similarity * 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}
