"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { Role } from "@/lib/auth";
import type { NetworkData } from "@/lib/graphAnalysis";
import type { PredictionData } from "@/lib/predictiveAnalysis";
import AlertsPanel from "./AlertsPanel";
import HotspotMap from "./HotspotMap";
import MessageBubble, { Message } from "./MessageBubble";
import NetworkGraphView from "./NetworkGraphView";
import RoleBadge from "./RoleBadge";
import VoiceButton from "./VoiceButton";

type Tab = "chat" | "network" | "hotspots" | "alerts";
const tabs: { id: Tab; label: string }[] = [
  { id: "chat", label: "Chat" }, { id: "network", label: "Network" },
  { id: "hotspots", label: "Hotspots" }, { id: "alerts", label: "Alerts" },
];
const suggestions = [
  "How many chain-snatching cases in Bengaluru North this month?",
  "Show repeat persons linked across multiple cases",
  "Which crime type is rising fastest?",
];
const welcome: Message = { id: "welcome", role: "assistant", content: "Namaskara. Ask about synthetic case records, linked persons, trends, or hotspots. Access is enforced by your active role." };

export default function ChatWindow({ role }: { role: Role }) {
  const [tab, setTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceReply, setVoiceReply] = useState(true);
  const [language, setLanguage] = useState<"en-IN" | "kn-IN">("en-IN");
  const [notice, setNotice] = useState("");
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [predictionData, setPredictionData] = useState<PredictionData | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);
  const showNotice = useCallback((text: string) => { setNotice(text); window.setTimeout(() => setNotice(""), 3500); }, []);
  const navigateTo = useCallback((destination: Tab) => setTab(destination), []);

  const submit = useCallback(async (text: string) => {
    const clean = text.trim(); if (!clean || loading) return;
    const history = messages.slice(-10).map(({ role: messageRole, content }) => ({ role: messageRole, content }));
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: clean }]);
    setInput(""); setLoading(true); setTab("chat");
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: clean, history, role }) });
      const data = await response.json();
      if (response.status === 401) { window.location.href = "/login"; return; }
      const answer = data.answer || "I couldn’t complete that request.";
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: answer, sql: data.sql }]);
      if (data.networkData) setNetworkData(data.networkData);
      if (data.predictionData) setPredictionData(data.predictionData);
      if (data.action === "switchTab" && tabs.some((item) => item.id === data.tab)) navigateTo(data.tab as Tab);
      if (voiceReply && "speechSynthesis" in window) {
        speechSynthesis.cancel(); const speech = new SpeechSynthesisUtterance(answer);
        speech.lang = language; speech.rate = 0.95; speechSynthesis.speak(speech);
      }
    } catch { setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: "The service is temporarily unreachable." }]); }
    finally { setLoading(false); }
  }, [language, loading, messages, navigateTo, role, voiceReply]);

  async function exportPdf() {
    try {
      const response = await fetch("/api/export-pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages }) });
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a");
      link.href = url; link.download = "ksp-conversation.pdf"; link.click(); URL.revokeObjectURL(url);
    } catch { showNotice("PDF export could not be completed."); }
  }

  return (
    <main className="min-h-screen pb-36">
      <header className="sticky top-0 z-[1000] border-b bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-police text-xs font-black text-white">KSP</div>
            <div><h1 className="text-sm font-bold text-ink md:text-base">Crime Intelligence Assistant</h1>
              <p className="flex items-center gap-1.5 text-[10px] text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Connected · synthetic data</p></div></div>
          <div className="flex items-center gap-2"><RoleBadge role={role} />
            <button onClick={() => void exportPdf()} className="hidden rounded-lg border px-3 py-2 text-xs font-bold text-police sm:block">Export PDF</button>
            <a href="/login" className="text-xs text-slate-500">Switch</a></div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          {tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)}
            className={`border-b-2 px-4 py-2.5 text-xs font-bold ${tab === item.id ? "border-saffron text-police" : "border-transparent text-slate-500"}`}>{item.label}</button>)}
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-6">
        {tab === "chat" && <>
          <div className="mb-5 flex flex-wrap gap-2">{messages.length <= 1 && suggestions.map((text) => <button key={text} onClick={() => void submit(text)} className="rounded-full border bg-white px-4 py-2 text-left text-xs font-medium text-police shadow-sm hover:border-saffron">{text}</button>)}</div>
          <div className="space-y-4">{messages.map((message) => <MessageBubble key={message.id} message={message} />)}
            {loading && <div className="w-fit rounded-2xl border bg-white px-5 py-3 text-sm text-slate-500">Analysing records…</div>}<div ref={bottomRef} /></div>
          {role === "sp" && <p className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800">SP trust control: all executed analyses are recorded in a SHA-256 hash-chained audit log.</p>}
        </>}
        {tab === "network" && <><h2 className="mb-4 text-xl font-bold">Criminal network analysis</h2><NetworkGraphView initialData={networkData} /></>}
        {tab === "hotspots" && <><h2 className="mb-4 text-xl font-bold">Hotspots & trend forecast</h2><HotspotMap initialData={predictionData} /></>}
        {tab === "alerts" && <><h2 className="mb-4 text-xl font-bold">Proactive alerts</h2><AlertsPanel /></>}
      </section>

      {notice && <div className="fixed bottom-32 left-1/2 z-[1100] -translate-x-1/2 rounded-xl bg-slate-950 px-4 py-3 text-xs text-white">{notice}</div>}
      {tab === "chat" && <div className="fixed inset-x-0 bottom-0 z-[1000] border-t bg-white/95 px-4 py-3 backdrop-blur-xl">
        <form onSubmit={(event: FormEvent) => { event.preventDefault(); void submit(input); }} className="mx-auto flex max-w-6xl items-center gap-2">
          <VoiceButton language={language} onTranscript={(text) => void submit(text)} onError={showNotice} disabled={loading} />
          <button type="button" onClick={() => setLanguage((value) => value === "en-IN" ? "kn-IN" : "en-IN")} className="h-11 rounded-xl border px-2 text-[10px] font-bold">{language === "en-IN" ? "EN" : "ಕನ್ನಡ"}</button>
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about records, networks, trends…" className="h-11 min-w-0 flex-1 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-police" />
          <label className="hidden items-center gap-1 text-[10px] text-slate-500 md:flex"><input type="checkbox" checked={voiceReply} onChange={(e) => setVoiceReply(e.target.checked)} /> Speak</label>
          <button disabled={loading || !input.trim()} className="h-11 rounded-xl bg-police px-5 text-sm font-bold text-white disabled:opacity-40">Send</button>
        </form>
      </div>}
    </main>
  );
}
