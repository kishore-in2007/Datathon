export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string | null;
};

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <article className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm md:max-w-[72%] ${
          isUser
            ? "rounded-br-md bg-police text-white"
            : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
        }`}
      >
        {!isUser && (
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-saffron">
            Intelligence assistant
          </div>
        )}
        <p className="whitespace-pre-wrap">{message.content}</p>
        {!isUser && message.sql && (
          <details className="mt-3 border-t border-slate-100 pt-2">
            <summary className="cursor-pointer select-none text-xs font-semibold text-police">
              Reasoning · view SQL
            </summary>
            <code className="mt-2 block overflow-x-auto rounded-lg bg-slate-950 p-3 text-[11px] leading-5 text-emerald-300">
              {message.sql}
            </code>
          </details>
        )}
      </div>
    </article>
  );
}
