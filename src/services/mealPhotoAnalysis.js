// src/services/mealPhotoAnalysis.js

import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

const aiChatFn = httpsCallable(functions, "aiChat", { timeout: 60000 });

export async function analyzeMealPhoto(base64Image, mimeType, child) {
  if (!base64Image || !mimeType || !child) {
    console.error('mealPhotoAnalysis: missing required arguments', { base64Image: !!base64Image, mimeType, child: !!child });
    return { error: 'Missing required arguments' };
  }

  const systemPrompt = "You are a pediatric nutrition assistant. Analyze this meal photo for a child with suspected hyperinsulinism and reactive hypoglycemia. Respond ONLY with valid JSON, no markdown, no backticks, no explanation: { \"description\": string, \"carbsEstimate\": number, \"ingredients\": string[], \"concerns\": string[], \"confidence\": \"low\"|\"medium\"|\"high\" }";

  const messages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Child: ${child.name}, glucose target ${child.glucoseTargetMin}–${child.glucoseTargetMax} mmol/L, meal interval ${child.mealIntervalMinutes} min. Please analyse the meal in this photo.`,
        },
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${base64Image}` },
        },
      ],
    },
  ];

  let result;
  try {
    result = await aiChatFn({ systemPrompt, messages, maxTokens: 512 });
  } catch (err) {
    console.error('mealPhotoAnalysis: Cloud Function error', err);
    return { error: `Request failed: ${err.message}` };
  }

  const text = result.data?.content ?? "";
  if (!text) {
    console.error('mealPhotoAnalysis: empty response', result.data);
    return { error: 'Empty response from model' };
  }

  const jsonText = text.replace(/^```json\n?|^```\n?|```$/g, "").trim();
  try {
    return JSON.parse(jsonText);
  } catch (jsonErr) {
    console.error('mealPhotoAnalysis: JSON parse failed', jsonErr, 'raw:', jsonText);
    return { error: `Could not parse response: ${jsonText.slice(0, 100)}` };
  }
}

export default analyzeMealPhoto;
