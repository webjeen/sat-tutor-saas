export type DedupStatus = "unique" | "duplicate" | "similar";

export interface Fingerprint {
  textHash: string;
  structureHash: string;
  choiceHash: string;
  patternSignature: string;
}

export interface DedupMatch {
  questionId: string;
  score: number;
  matchType: "exact" | "near" | "similar";
}

export interface DedupResult {
  status: DedupStatus;
  fingerprint: Fingerprint;
  matches: DedupMatch[];
  reason: string;
}

export interface FingerprintStore {
  add(questionId: string, fingerprint: Fingerprint, contentText?: string): void;
  findMatches(fingerprint: Fingerprint, candidateContentText?: string): DedupMatch[];
  getAll(): Map<string, Fingerprint>;
}
