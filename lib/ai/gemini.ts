import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { GenerateJson } from "./analyze";

/** Spec §2: Gemini 3.5 Flash-Lite (stable; ai.google.dev/gemini-api/docs/models, checked 2026-10-17). */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
/** Spec §6.1 step 5. */
export const AI_TIMEOUT_MS = 30_000;

export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export function createGeminiGenerate(apiKey: string, model: string): GenerateJson {
  const ai = new GoogleGenAI({ apiKey });
  return async ({ system, prompt, schema }) => {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
        // One attempt only: retries would run past the 30-second limit.
        httpOptions: { timeout: AI_TIMEOUT_MS, retryOptions: { attempts: 1 } },
      },
    });
    const text = response.text;
    if (!text) throw new Error("Gemini returned no text");
    return text;
  };
}
