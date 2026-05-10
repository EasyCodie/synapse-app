"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, BookOpen, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatSource {
  index: number;
  title: string;
  source_type: string;
  source_id: string;
  similarity: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
}

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingSources, setStreamingSources] = useState<ChatSource[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setStreamingText("");
    setStreamingSources([]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              err.error || "Something went wrong. Please try again.",
          },
        ]);
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let fullText = "";
      let sources: ChatSource[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);

          try {
            const parsed = JSON.parse(data) as {
              type: string;
              text?: string;
              sources?: ChatSource[];
            };

            if (parsed.type === "sources" && parsed.sources) {
              sources = parsed.sources;
              setStreamingSources(parsed.sources);
            } else if (parsed.type === "text" && parsed.text) {
              fullText += parsed.text;
              setStreamingText(fullText);
            } else if (parsed.type === "done") {
              // Finalize
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: fullText, sources },
              ]);
              setStreamingText("");
              setStreamingSources([]);
            }
          } catch {
            // skip malformed lines
          }
        }
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
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && !streamingText && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="w-10 h-10 text-ink-subtle mb-4" />
            <h2 className="text-card-title text-ink mb-2">Synapse AI</h2>
            <p className="text-body-sm text-ink-subtle max-w-md">
              Ask questions about your uploaded resources, notes, and study
              materials. I&apos;ll find relevant sources and cite them in my
              answers.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {/* Streaming message */}
        {streamingText && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-body-sm text-ink whitespace-pre-wrap">
                {streamingText}
                <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5" />
              </div>
              {streamingSources.length > 0 && (
                <SourcesList sources={streamingSources} />
              )}
            </div>
          </div>
        )}

        {loading && !streamingText && (
          <div className="flex gap-3 items-center">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="flex items-center gap-2 text-ink-subtle">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-body-sm">Searching your resources...</span>
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
            onClick={handleSend}
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
        <div
          className={cn(
            "text-body-sm whitespace-pre-wrap",
            isUser ? "text-ink" : "text-ink"
          )}
        >
          {message.content}
        </div>
        {message.sources && message.sources.length > 0 && (
          <SourcesList sources={message.sources} />
        )}
      </div>
    </div>
  );
}

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
          <span className="text-ink-subtle/60">
            {(source.similarity * 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}
