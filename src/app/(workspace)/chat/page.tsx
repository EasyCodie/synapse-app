import { ChatInterface } from "@/components/chat/chat-interface";

export default function ChatPage() {
  return (
    <div className="h-[calc(100vh-theme(spacing.6)*2)]">
      <ChatInterface />
    </div>
  );
}
