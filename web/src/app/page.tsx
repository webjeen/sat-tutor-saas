"use client";

import { useEffect, useState } from "react";
import { ParserInput } from "../components/parser/ParserInput";
import { ParserResultDisplay } from "../components/parser/ParserResult";
import { WorksheetDisplay } from "../components/parser/WorksheetDisplay";
import { FileUpload } from "../components/parser/FileUpload";
import { IngestionResultDisplay } from "../components/parser/IngestionResult";
import { useParser } from "../hooks/useParser";
import { useWorksheet } from "../hooks/useWorksheet";
import { useIngestion } from "../hooks/useIngestion";
import { testConnection } from "../lib/supabase/testConnection";

export default function Home() {
  const { result, parsing, parse, reset } = useParser();
  const { questions, loading, error, generate } = useWorksheet();
  const { loading: ingesting, stats, errors, insertedIds, ingest, reset: resetIngestion } = useIngestion();
  const [activeTab, setActiveTab] = useState<"paste" | "upload">("upload");
  const [lastFilename, setLastFilename] = useState<string>();

  useEffect(() => {
    testConnection().then((res) => {
      console.log("[Supabase]", res.success ? "OK" : "FAIL", res.message);
    });
  }, []);

  const handleFileLoaded = (content: string, filename: string) => {
    setLastFilename(filename);
    ingest(content);
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1>SAT Tutor — Parser (MVP)</h1>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16 }}>
        <button
          onClick={() => setActiveTab("upload")}
          style={{
            padding: "8px 20px",
            border: "1px solid #ccc",
            borderRadius: "6px 0 0 6px",
            background: activeTab === "upload" ? "#4f46e5" : "#fff",
            color: activeTab === "upload" ? "#fff" : "#333",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          File Upload
        </button>
        <button
          onClick={() => setActiveTab("paste")}
          style={{
            padding: "8px 20px",
            border: "1px solid #ccc",
            borderLeft: "none",
            borderRadius: "0 6px 6px 0",
            background: activeTab === "paste" ? "#4f46e5" : "#fff",
            color: activeTab === "paste" ? "#fff" : "#333",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Manual Paste
        </button>
      </div>

      {/* Upload tab */}
      {activeTab === "upload" && (
        <div>
          <FileUpload onFileLoaded={handleFileLoaded} disabled={ingesting} />
          {ingesting && <p style={{ marginTop: 8, color: "#4f46e5" }}>Ingesting...</p>}
          {stats && (
            <>
              <IngestionResultDisplay
                stats={stats}
                errors={errors}
                insertedIds={insertedIds}
                filename={lastFilename}
              />
              <button onClick={resetIngestion} style={{ marginTop: 12 }}>
                Reset Ingestion
              </button>
            </>
          )}
        </div>
      )}

      {/* Paste tab */}
      {activeTab === "paste" && (
        <div>
          <p style={{ color: "#666" }}>
            Paste DSAT questions in the tagged format to parse them.
          </p>
          <ParserInput onSubmit={parse} disabled={parsing} />
          {result && (
            <>
              <ParserResultDisplay result={result} />
              <button onClick={reset} style={{ marginTop: 12 }}>
                Reset
              </button>
            </>
          )}
        </div>
      )}

      <hr style={{ margin: "32px 0", border: "none", borderTop: "1px solid #eee" }} />

      <button onClick={generate} disabled={loading}>
        {loading ? "Loading..." : "Generate Worksheet"}
      </button>

      {error && <p style={{ color: "red", marginTop: 8 }}>{error}</p>}

      <WorksheetDisplay questions={questions} />
    </div>
  );
}
