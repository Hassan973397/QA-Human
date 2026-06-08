import Anthropic from "@anthropic-ai/sdk";
import type { LlmProvider } from "@hasan-qa-humans/core";

/**
 * Builds an LLM provider backed by the official Anthropic SDK, used to enrich
 * failure analysis. Returns undefined when no API key is configured, so the
 * analyzer transparently falls back to the rule-based path (fully offline).
 */
export function createAnthropicProvider(): LlmProvider | undefined {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return undefined;

  const client = new Anthropic({ apiKey });
  const model = process.env.HQA_LLM_MODEL || "claude-opus-4-8";

  return async (prompt: string): Promise<string> => {
    // Short, scoped analysis task — run without thinking and instruct for a
    // final-answer-only reply (recommended for Opus 4.8 when thinking is off).
    const message = await client.messages.create({
      model,
      max_tokens: 1024,
      system:
        "You are a senior QA engineer. Respond with exactly two short labelled lines and no other text:\n" +
        "Root cause: <one sentence>\nFix: <one sentence>",
      messages: [{ role: "user", content: prompt }],
    });
    return message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
  };
}
