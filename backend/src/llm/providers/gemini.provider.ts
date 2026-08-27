import { GoogleGenAI } from "@google/genai";
import { CompletionResult } from "../types";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set — cannot route to a Gemini model.");
  }
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export async function completeGemini(prompt: string, model: string, temperature?: number): Promise<CompletionResult> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      ...(temperature != null ? { temperature } : {}),
    },
  });
  return {
    text: response.text ?? "",
    tokensIn: response.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: response.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

/**
 * Native PDF input via Part.inlineData — no rasterization step. Plain-text
 * output (no responseMimeType override): this is a transcription call, not
 * a structured one, so completeStructured's JSON-schema machinery doesn't
 * apply here at all.
 */
export async function completeGeminiMultimodal(
  fileBuffer: Buffer,
  mimeType: string,
  promptText: string,
  model: string,
): Promise<CompletionResult> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [{ inlineData: { mimeType, data: fileBuffer.toString("base64") } }, { text: promptText }],
      },
    ],
  });
  return {
    text: response.text ?? "",
    tokensIn: response.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: response.usageMetadata?.candidatesTokenCount ?? 0,
  };
}
