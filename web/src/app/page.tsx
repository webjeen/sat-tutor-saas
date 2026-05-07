"use client";

import { useEffect } from "react";
import { ParserInput } from "../components/parser/ParserInput";
import { ParserResultDisplay } from "../components/parser/ParserResult";
import { WorksheetDisplay } from "../components/parser/WorksheetDisplay";
import { useParser } from "../hooks/useParser";
import { useWorksheet } from "../hooks/useWorksheet";
import { testConnection } from "../lib/supabase/testConnection";

export default function Home() {
  const { result, parsing, parse, reset } = useParser();
  const { questions, loading, error, generate } = useWorksheet();

  useEffect(() => {
    testConnection().then((res) => {
      console.log("[Supabase]", res.success ? "OK" : "FAIL", res.message);
    });
  }, []);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1>SAT Tutor — Parser (MVP)</h1>
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

      <hr style={{ margin: "32px 0", border: "none", borderTop: "1px solid #eee" }} />

      <button onClick={generate} disabled={loading}>
        {loading ? "Loading..." : "Generate Worksheet"}
      </button>

      {error && <p style={{ color: "red", marginTop: 8 }}>{error}</p>}

      <WorksheetDisplay questions={questions} />
    </div>
  );
}
