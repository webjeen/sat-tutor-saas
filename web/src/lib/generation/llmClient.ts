import Anthropic from "@anthropic-ai/sdk";
import type { PromptPayload, LLMResponse } from "./types";
import { GENERATION_CONFIG } from "./config";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

export async function callLLM(payload: PromptPayload): Promise<LLMResponse> {
  const anthropic = getClient();
  const startMs = Date.now();

  try {
    const response = await anthropic.messages.create({
      model: GENERATION_CONFIG.llm.model,
      max_tokens: GENERATION_CONFIG.llm.maxTokens,
      temperature: GENERATION_CONFIG.llm.temperature,
      system: payload.system,
      messages: [
        { role: "user", content: payload.user },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const rawText = textBlock && textBlock.type === "text" ? textBlock.text : "";

    return {
      rawText,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs: Date.now() - startMs,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown LLM error";
    throw new Error(`LLM call failed: ${message}`);
  }
}
