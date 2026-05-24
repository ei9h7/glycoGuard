// src/services/mealPhotoAnalysis.js

export async function analyzeMealPhoto(base64Image, mimeType, child) {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

  if (!apiKey) {
    console.error('mealPhotoAnalysis: VITE_OPENROUTER_API_KEY is not set');
    return { error: 'API key not configured' };
  }
  if (!base64Image || !mimeType || !child) {
    console.error('mealPhotoAnalysis: missing required arguments', { base64Image: !!base64Image, mimeType, child: !!child });
    return { error: 'Missing required arguments' };
  }

  const body = {
    model: "anthropic/claude-haiku-4.5",
    max_tokens: 512,
    messages: [
      {
        // System as plain string — required by OpenRouter
        role: "system",
        content: "You are a pediatric nutrition assistant. Analyze this meal photo for a child with suspected hyperinsulinism and reactive hypoglycemia. Respond ONLY with valid JSON, no markdown, no backticks, no explanation: { \"description\": string, \"carbsEstimate\": number, \"ingredients\": string[], \"concerns\": string[], \"confidence\": \"low\"|\"medium\"|\"high\" }",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Child: ${child.name}, glucose target ${child.glucoseTargetMin}–${child.glucoseTargetMax} mmol/L, meal interval ${child.mealIntervalMinutes} min. Please analyse the meal in this photo.`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          },
        ],
      },
    ],
  };

  let res;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://glycoguard.app",
        "X-Title": "GlycoGuard",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    console.error('mealPhotoAnalysis: network error', networkErr);
    return { error: `Network error: ${networkErr.message}` };
  }

  if (!res.ok) {
    const errText = await res.text();
    console.error('mealPhotoAnalysis: HTTP error', res.status, errText);
    return { error: `HTTP ${res.status}: ${errText}` };
  }

  let data;
  try {
    data = await res.json();
  } catch (parseErr) {
    console.error('mealPhotoAnalysis: failed to parse response JSON', parseErr);
    return { error: 'Invalid response from API' };
  }

  const text = data?.choices?.[0]?.message?.content ?? "";
  console.log('mealPhotoAnalysis: raw response', text);

  if (!text) {
    console.error('mealPhotoAnalysis: empty response content', data);
    return { error: 'Empty response from model' };
  }

  const jsonText = text.replace(/^```json\n?|^```\n?|```$/g, "").trim();

  try {
    return JSON.parse(jsonText);
  } catch (jsonErr) {
    console.error('mealPhotoAnalysis: JSON parse failed', jsonErr, 'raw text:', jsonText);
    return { error: `Could not parse response: ${jsonText.slice(0, 100)}` };
  }
}

export default analyzeMealPhoto;
