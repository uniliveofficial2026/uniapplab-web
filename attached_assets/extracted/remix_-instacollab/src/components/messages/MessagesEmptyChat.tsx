import { Send } from 'lucide-react';

type MessagesEmptyChatProps = {
  onNewMessage: () => void;
};

export function MessagesEmptyChat({ onNewMessage }: MessagesEmptyChatProps) {
  return (
    <div className="hidden md:flex flex-col flex-1 items-center justify-center bg-background">
      <div className="w-24 h-24 border-2 border-foreground rounded-full flex items-center justify-center mb-4">
        <Send className="w-12 h-12 text-foreground -translate-x-1 translate-y-1" />
      </div>
      <h2 className="text-xl font-bold">Your Messages</h2>
      <p className="text-muted-foreground mb-6">Send private photos and messages to a friend or group.</p>
      <button
        type="button"
        onClick={onNewMessage}
        className="px-6 py-2 bg-primary text-primary-foreground font-bold rounded-full"
      >
        Send Message
      </button>
    </div>
  );
}
