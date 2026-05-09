"use client";

import type { IngestionStats, IngestionError } from "../../lib/ingestion/ingestionService";

interface IngestionResultProps {
  stats: IngestionStats;
  errors: IngestionError[];
  insertedIds: string[];
  filename?: string;
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "8px 16px",
      borderRadius: 6,
      background: "#f9fafb",
      minWidth: 80,
    }}>
      <span style={{ fontSize: 22, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{label}</span>
    </div>
  );
}

export function IngestionResultDisplay({ stats, errors, insertedIds, filename }: IngestionResultProps) {
  const parseErrors = errors.filter((e) => e.stage === "parse");
  const validationFatal = errors.filter((e) => e.stage === "validation" && e.severity === "reject");
  const answerMissing = errors.filter((e) => e.code === "ANSWER_MISSING");
  const dedupWarnings = errors.filter((e) => e.stage === "dedup" && e.severity === "review");
  const dedupDuplicates = errors.filter((e) => e.stage === "dedup" && e.severity === "reject");
  const insertErrors = errors.filter((e) => e.stage === "insert");

  return (
    <div style={{ marginTop: 16 }}>
      {filename && (
        <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
          File: <strong>{filename}</strong>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatBadge label="Parsed" value={stats.totalParsed} color="#4f46e5" />
        <StatBadge label="Valid" value={stats.validQuestions} color="#16a34a" />
        <StatBadge label="Inserted" value={stats.insertedCount} color="#059669" />
        <StatBadge label="Review Req" value={stats.reviewRequired} color="#d97706" />
        <StatBadge label="Ans Missing" value={stats.answerMissing} color="#9333ea" />
        <StatBadge label="Val Errors" value={stats.validationErrors} color="#dc2626" />
        <StatBadge label="Dedup Warn" value={stats.dedupWarnings} color="#d97706" />
        <StatBadge label="Insert Fail" value={stats.insertFailures} color="#dc2626" />
      </div>

      {insertedIds.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", fontSize: 13 }}>
            Inserted IDs ({insertedIds.length})
          </summary>
          <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4, lineHeight: 1.6 }}>
            {insertedIds.join(", ")}
          </div>
        </details>
      )}

      {answerMissing.length > 0 && (
        <details style={{ marginTop: 8 }} open>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "#9333ea" }}>
            Answer Missing ({answerMissing.length})
          </summary>
          {answerMissing.map((e, i) => (
            <div key={i} style={{ fontSize: 12, color: "#9333ea", marginTop: 2 }}>
              Q{e.questionId}: {e.message}
            </div>
          ))}
        </details>
      )}

      {parseErrors.length > 0 && (
        <details style={{ marginTop: 8 }} open>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "#dc2626" }}>
            Parse Errors ({parseErrors.length})
          </summary>
          {parseErrors.map((e, i) => (
            <div key={i} style={{ fontSize: 12, color: "#dc2626", marginTop: 2 }}>
              Q{e.questionId} / {e.field}: {e.message}
            </div>
          ))}
        </details>
      )}

      {validationFatal.length > 0 && (
        <details style={{ marginTop: 8 }} open>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "#dc2626" }}>
            Validation Errors ({validationFatal.length})
          </summary>
          {validationFatal.map((e, i) => (
            <div key={i} style={{ fontSize: 12, color: "#dc2626", marginTop: 2 }}>
              Q{e.questionId} / {e.field}: {e.message}
            </div>
          ))}
        </details>
      )}

      {dedupWarnings.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "#d97706" }}>
            Dedup Warnings ({dedupWarnings.length})
          </summary>
          {dedupWarnings.map((e, i) => (
            <div key={i} style={{ fontSize: 12, color: "#d97706", marginTop: 2 }}>
              Q{e.questionId}: {e.message}
            </div>
          ))}
        </details>
      )}

      {dedupDuplicates.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "#dc2626" }}>
            Dedup Rejections ({dedupDuplicates.length})
          </summary>
          {dedupDuplicates.map((e, i) => (
            <div key={i} style={{ fontSize: 12, color: "#dc2626", marginTop: 2 }}>
              Q{e.questionId}: {e.message}
            </div>
          ))}
        </details>
      )}

      {insertErrors.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "#dc2626" }}>
            Insert Failures ({insertErrors.length})
          </summary>
          {insertErrors.map((e, i) => (
            <div key={i} style={{ fontSize: 12, color: "#dc2626", marginTop: 2 }}>
              Q{e.questionId}: {e.message}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
