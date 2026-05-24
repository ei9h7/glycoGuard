// src/services/mealPhotoAnalysis.js
export async function analyzeMealPhoto(base64Image, mimeType, child) {
  try {
    const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    if (!apiKey || !base64Image || !mimeType || !child) return null;

    const body = {
      model: "anthropic/claude-haiku-4-5",
      messages: [
        {
          role: "system",
          content: [
            {
              type: "text",
              text:
                "You are a pediatric nutrition assistant. Analyze this meal photo for a child with suspected hyperinsulinism and reactive hypoglycemia. Respond ONLY with valid JSON, no markdown, no backticks: { description: string, carbsEstimate: number, ingredients: string[], concerns: string[], confidence: 'low'|'medium'|'high' }",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Context: child.name="${child.name}", glucoseTargetMin=${child.glucoseTargetMin}, glucoseTargetMax=${child.glucoseTargetMax}, mealIntervalMinutes=${child.mealIntervalMinutes}`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            },
          ],
        },
      ],
      stream: false,
    };

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://glycoguard.app",
        "X-Title": "GlycoGuard",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    // Remove markdown/code fences if present before parsing
    const jsonText = text.replace(/^```json\n?|^```\n?|```$/g, "").trim();
    try {
      return JSON.parse(jsonText);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

export default analyzeMealPhoto;
