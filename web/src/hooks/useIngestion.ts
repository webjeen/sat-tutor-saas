"use client";

import { useState, useCallback } from "react";
import { ingestMarkdown } from "../lib/ingestion/ingestionService";
import type { IngestionResult, IngestionStats, IngestionError } from "../lib/ingestion/ingestionService";
import type { FingerprintStore } from "../lib/dedup/types";
import { createFingerprintStore } from "../lib/dedup/dedup";

export function useIngestion() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<IngestionStats | null>(null);
  const [errors, setErrors] = useState<IngestionError[]>([]);
  const [insertedIds, setInsertedIds] = useState<string[]>([]);
  const [store] = useState<FingerprintStore>(createFingerprintStore);

  const ingest = useCallback(async (markdown: string) => {
    setLoading(true);
    setErrors([]);
    setStats(null);
    setInsertedIds([]);

    try {
      const result: IngestionResult = await ingestMarkdown(markdown, store);
      setStats(result.stats);
      setErrors(result.errors);
      setInsertedIds(result.insertedIds);
    } catch (err) {
      setErrors([{
        questionId: "SYSTEM",
        stage: "insert",
        field: "runtime",
        message: err instanceof Error ? err.message : "Unknown error",
        severity: "reject",
      }]);
    } finally {
      setLoading(false);
    }
  }, [store]);

  const reset = useCallback(() => {
    setLoading(false);
    setStats(null);
    setErrors([]);
    setInsertedIds([]);
  }, []);

  return { loading, stats, errors, insertedIds, ingest, reset };
}
