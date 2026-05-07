"use client";

import { useState, useCallback } from "react";
import { ParseResult } from "../lib/parser/types";
import { parseQuestions } from "../lib/parser/parseQuestions";
import { saveParsedQuestion } from "../lib/supabase/saveParsedQuestion";

export function useParser() {
  const [result, setResult] = useState<ParseResult | null>(null);
  const [parsing, setParsing] = useState(false);

  const parse = useCallback((input: string) => {
    setParsing(true);
    try {
      const parsed = parseQuestions(input);
      setResult(parsed);

      if (
        parsed.status === "validation_passed" ||
        parsed.status === "review_required"
      ) {
        for (const q of parsed.questions) {
          saveParsedQuestion(q);
        }
      }
    } finally {
      setParsing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setParsing(false);
  }, []);

  return { result, parsing, parse, reset };
}
