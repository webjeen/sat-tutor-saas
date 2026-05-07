import { StoredQuestion } from "../../lib/supabase/fetchQuestions";

interface WorksheetProps {
  questions: StoredQuestion[];
}

function WorksheetItem({
  q,
  number,
}: {
  q: StoredQuestion;
  number: number;
}) {
  return (
    <div
      style={{
        padding: 16,
        marginBottom: 16,
        border: "1px solid #ddd",
        borderRadius: 4,
      }}
    >
      {q.passage && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            background: "#f9f9f9",
            borderRadius: 4,
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          {q.passage}
        </div>
      )}

      <div style={{ fontWeight: 600, marginBottom: 8 }}>
        {number}. {q.question}
      </div>

      <div style={{ paddingLeft: 20 }}>
        {q.choices && typeof q.choices === "object" && Object.keys(q.choices).length > 0 ? (
          Object.entries(q.choices).map(([key, value]) => (
            <div key={key} style={{ marginBottom: 4, fontSize: 14 }}>
              <strong>{key}.</strong> {value}
            </div>
          ))
        ) : (
          <div style={{ color: "#999", fontSize: 13 }}>No choices available</div>
        )}
      </div>
    </div>
  );
}

export function WorksheetDisplay({ questions }: WorksheetProps) {
  if (questions.length === 0) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <h2 style={{ marginBottom: 16 }}>
        Worksheet ({questions.length} questions)
      </h2>
      {questions.map((q, i) => (
        <WorksheetItem key={q.id} q={q} number={i + 1} />
      ))}
    </div>
  );
}
