"use client";

import { useState, useCallback } from "react";
import {
  fetchQuestions,
  StoredQuestion,
} from "../lib/supabase/fetchQuestions";

function pickRandom(questions: StoredQuestion[], count: number): StoredQuestion[] {
  const shuffled = [...questions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function useWorksheet() {
  const [questions, setQuestions] = useState<StoredQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await fetchQuestions();
      if (fetchError || !data) {
        setError(fetchError ?? "No questions found");
        setQuestions([]);
        return;
      }

      if (data.length === 0) {
        setError("No questions in database yet");
        setQuestions([]);
        return;
      }

      const count = Math.min(Math.max(5, Math.ceil(data.length * 0.5)), 10, data.length);
      setQuestions(pickRandom(data, count));
    } finally {
      setLoading(false);
    }
  }, []);

  return { questions, loading, error, generate };
}
