// -- Tutor SaaS Layer configuration --

export const TUTOR_CONFIG = {
  retry: {
    maxRetries: 3,
    retryDelayMs: 1000,
    staleJobTimeoutMs: 30 * 60 * 1000, // 30 minutes
  },

  concurrency: {
    maxConcurrentExports: 3,
    maxConcurrentJobs: 5,
  },

  pipeline: {
    generationTimeoutMs: 120 * 1000, // 2 minutes per question
    assemblyTimeoutMs: 30 * 1000,
    exportTimeoutMs: 60 * 1000,
  },

  review: {
    autoRetryOnSoftFailure: true,
    maxReviewRetries: 2,
  },

  staleJob: {
    checkIntervalMs: 5 * 60 * 1000, // 5 minutes
    maxAgeMs: 24 * 60 * 60 * 1000, // 24 hours
  },

  audit: {
    maxEventsPerJob: 200,
    retentionDays: 90,
  },
} as const;
