"use client";

import { useEffect, useRef, useState } from "react";

type SpeechRecognitionEventLike = Event & {
  results: { 0: { 0: { transcript: string } } };
};

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  }
}

export default function VoiceButton({
  onTranscript,
  onError,
  disabled,
  language,
}: {
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  language: "en-IN" | "kn-IN";
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const gotResult = useRef(false);
  const transcriptHandler = useRef(onTranscript);
  const errorHandler = useRef(onError);

  useEffect(() => {
    transcriptHandler.current = onTranscript;
    errorHandler.current = onError;
  }, [onError, onTranscript]);

  useEffect(() => {
    let mounted = true;
    const Constructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(Boolean(Constructor));
    if (!Constructor) return;
    const instance = new Constructor();
    instance.lang = language;
    instance.interimResults = false;
    instance.continuous = false;
    instance.onresult = (event) => {
      gotResult.current = true;
      transcriptHandler.current(event.results[0][0].transcript.trim());
    };
    instance.onerror = () => {
      if (mounted) errorHandler.current("I couldn’t hear that clearly. Please try again or type your question.");
    };
    instance.onend = () => {
      if (!mounted) return;
      setListening(false);
      if (!gotResult.current) errorHandler.current("No speech detected. You can try the mic again or use the text box.");
    };
    recognition.current = instance;
    return () => {
      mounted = false;
      instance.onresult = null;
      instance.onerror = null;
      instance.onend = null;
      instance.stop();
    };
  }, [language]);

  if (!supported) return null;

  function toggle() {
    if (!recognition.current || disabled) return;
    if (listening) {
      recognition.current.stop();
      setListening(false);
      return;
    }
    gotResult.current = false;
    setListening(true);
    recognition.current.start();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-label={listening ? "Stop listening" : "Ask by voice"}
      title={listening ? "Listening…" : "Ask by voice"}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition ${
        listening
          ? "animate-pulse border-red-200 bg-red-50 text-red-600"
          : "border-slate-200 bg-white text-police hover:border-police/30 hover:bg-blue-50"
      } disabled:opacity-40`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
      </svg>
    </button>
  );
}
