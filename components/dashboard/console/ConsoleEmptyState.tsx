import { MessageSquare } from "lucide-react";

export function ConsoleEmptyState({ noConversations }: { noConversations: boolean }) {
  return (
    <div
      dir="rtl"
      className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <MessageSquare className="h-10 w-10 text-white/20" />
      <p className="text-sm text-white/55">
        {noConversations
          ? "אין שיחות פעילות עדיין."
          : "בחרו שיחה מהרשימה כדי לפתוח אותה כאן."}
      </p>
    </div>
  );
}
