"use client";

import { useState } from "react";

interface ParserInputProps {
  onSubmit: (input: string) => void;
  disabled?: boolean;
}

export function ParserInput({ onSubmit, disabled }: ParserInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSubmit(input);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={`Paste questions in format:\n\n[QUESTION_START]\nExam: DSAT\nSection: RW\nModule: 1\nQuestion_ID: 1\n...\n[QUESTION_END]`}
        rows={16}
        style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }}
        disabled={disabled}
      />
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button type="submit" disabled={disabled || !input.trim()}>
          Parse
        </button>
        <button
          type="button"
          onClick={() => setInput("")}
          disabled={disabled}
        >
          Clear
        </button>
      </div>
    </form>
  );
}
