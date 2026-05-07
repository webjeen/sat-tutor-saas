import { ParseResult, ParsedQuestion } from "../../lib/parser/types";

interface ParserResultProps {
  result: ParseResult;
}

function QuestionCard({ q }: { q: ParsedQuestion }) {
  return (
    <div style={{ border: "1px solid #ccc", padding: 12, marginBottom: 8 }}>
      <div>
        <strong>
          {q.section} Q{q.questionId}
        </strong>{" "}
        <span style={{ color: "#666" }}>({q.questionType})</span>
      </div>
      <div style={{ marginTop: 4 }}>{q.question}</div>
      {q.section === "RW" && "passage" in q && q.passage && (
        <div style={{ marginTop: 4, color: "#555", fontSize: 13 }}>
          Passage: {q.passage.slice(0, 100)}
          {q.passage.length > 100 ? "..." : ""}
        </div>
      )}
      {q.section === "Math" && "graph" in q && q.graph && (
        <div style={{ marginTop: 4, color: "#555", fontSize: 13 }}>
          Graph: {q.graph.slice(0, 80)}
          {q.graph.length > 80 ? "..." : ""}
        </div>
      )}
      <div style={{ marginTop: 4, fontSize: 13 }}>
        Choices:{" "}
        {Object.entries(q.choices).map(([k, v]) => (
          <span key={k} style={{ marginRight: 12 }}>
            {k}. {v}
          </span>
        ))}
      </div>
      <div style={{ marginTop: 4, fontSize: 13 }}>
        Answer: <strong>{q.answer}</strong>
      </div>
      {q.unclear && (
        <div style={{ marginTop: 4, color: "orange", fontSize: 13 }}>
          UNCLEAR: {q.unclear}
        </div>
      )}
    </div>
  );
}

export function ParserResultDisplay({ result }: ParserResultProps) {
  return (
    <div style={{ marginTop: 16 }}>
      <div>
        Status: <strong>{result.status}</strong>
        {result.decisionReason && (
          <span style={{ color: "#666", marginLeft: 8 }}>
            {result.decisionReason}
          </span>
        )}
      </div>

      {result.errors.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <strong>Errors:</strong>
          {result.errors.map((err, i) => (
            <div
              key={i}
              style={{
                color: err.severity === "reject" ? "red" : "orange",
                fontSize: 13,
                marginTop: 2,
              }}
            >
              [{err.severity}] {err.questionId} / {err.field}: {err.message}
            </div>
          ))}
        </div>
      )}

      {result.questions.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <strong>Parsed Questions ({result.questions.length}):</strong>
          {result.questions.map((q) => (
            <QuestionCard key={q.questionId} q={q} />
          ))}
        </div>
      )}
    </div>
  );
}
