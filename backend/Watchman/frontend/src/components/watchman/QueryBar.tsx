"use client";

import { useCallback, useRef, useState } from "react";
import type { WatchmanQueryEntry } from "@/lib/watchman-types";
import { queryWatchman } from "@/lib/watchman-api";

interface QueryBarProps {
  queryHistory: WatchmanQueryEntry[];
  onNewEntry: (entry: WatchmanQueryEntry) => void;
  hasIncidentHistory: boolean;
}

export default function QueryBar({
  queryHistory,
  onNewEntry,
  hasIncidentHistory,
}: QueryBarProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const { answer, question } = await queryWatchman(q);
      onNewEntry({
        id: Math.random().toString(36).slice(2, 10),
        question,
        answer,
        askedAt: Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, onNewEntry]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") submit();
    },
    [submit]
  );

  // Show last 3 Q&A pairs (newest first)
  const recent = queryHistory.slice(0, 3);

  return (
    <div
      style={{
        position: "relative",
        borderTop: "1px solid var(--color-border)",
        background: "rgba(10,10,10,0.97)",
        backdropFilter: "blur(8px)",
        flexShrink: 0,
      }}
    >
      {/* Recent answers — appear above the input */}
      {recent.length > 0 && (
        <div
          style={{
            borderBottom: "1px solid var(--color-border)",
            maxHeight: 220,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
          {recent.map((entry, idx) => (
            <div
              key={entry.id}
              className={idx === 0 ? "animate-fade-up" : undefined}
              style={{
                padding: "10px 16px",
                borderBottom:
                  idx < recent.length - 1
                    ? "1px solid rgba(0,229,255,0.06)"
                    : undefined,
              }}
            >
              {/* Question */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  marginBottom: 5,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--color-accent-cyan)",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  &gt;
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--color-text-dim)",
                    lineHeight: 1.4,
                  }}
                >
                  {entry.question}
                </span>
              </div>
              {/* Answer */}
              <div
                style={{
                  paddingLeft: 18,
                  fontSize: 12,
                  color: "var(--color-text)",
                  lineHeight: 1.55,
                  borderLeft: "2px solid rgba(0,229,255,0.2)",
                }}
              >
                {entry.answer}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 16px",
          gap: 10,
        }}
      >
        {/* Prompt glyph */}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            color: loading ? "var(--color-text-dim)" : "var(--color-accent-cyan)",
            flexShrink: 0,
            transition: "color 200ms ease",
          }}
        >
          {loading ? "…" : ">_"}
        </span>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder={
            !hasIncidentHistory
              ? "No incidents recorded yet — ask once Watchman detects something"
              : "Ask Watchman about incidents… e.g. What time did the intruder walk in?"
          }
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: loading ? "var(--color-text-dim)" : "var(--color-text)",
            letterSpacing: "0.02em",
            caretColor: "var(--color-accent-cyan)",
          }}
        />

        <button
          onClick={submit}
          disabled={loading || !input.trim()}
          className="hud-button"
          aria-label="Submit query"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.1em",
            padding: "4px 12px",
            borderRadius: 2,
            border: "1px solid rgba(0,229,255,0.3)",
            background:
              loading || !input.trim()
                ? "transparent"
                : "rgba(0,229,255,0.06)",
            color:
              loading || !input.trim()
                ? "var(--color-text-dim)"
                : "var(--color-accent-cyan)",
            cursor:
              loading || !input.trim() ? "not-allowed" : "pointer",
            flexShrink: 0,
            transition: "all 150ms ease",
          }}
        >
          {loading ? "ASKING…" : "ASK"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "4px 16px 8px",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--color-accent-red)",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
