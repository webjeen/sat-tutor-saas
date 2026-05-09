"use client";

import { useRef, useState } from "react";

interface FileUploadProps {
  onFileLoaded: (content: string, filename: string) => void;
  disabled?: boolean;
}

export function FileUpload({ onFileLoaded, disabled }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const processFile = (file: File) => {
    if (!file.name.endsWith(".md")) {
      alert("Only .md files are supported");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") {
        setFileName(file.name);
        onFileLoaded(text, file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragOver ? "#4f46e5" : "#ccc"}`,
        borderRadius: 8,
        padding: 24,
        textAlign: "center" as const,
        cursor: disabled ? "not-allowed" : "pointer",
        background: dragOver ? "#f5f3ff" : "#fafafa",
        opacity: disabled ? 0.5 : 1,
        transition: "border-color 0.2s, background 0.2s",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".md"
        onChange={handleFileChange}
        style={{ display: "none" }}
        disabled={disabled}
      />
      {fileName ? (
        <div style={{ fontSize: 14 }}>
          <strong>{fileName}</strong> — drop another to replace
        </div>
      ) : (
        <div style={{ color: "#666", fontSize: 14 }}>
          Drop a <code>.md</code> file here, or click to browse
        </div>
      )}
    </div>
  );
}
