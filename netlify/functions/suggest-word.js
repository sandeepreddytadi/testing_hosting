export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { sessionName, existingWords = [] } = JSON.parse(event.body || "{}");

    const avoidList = existingWords.join(", ");

    const prompt = `
You are helping participants in a company away-day session 
(ice-breakers, team discussions, reflections).

Task:
- Suggest ONE single-word response only
- The word must be positive, simple, and relevant to a team discussion
- It must feel natural for a corporate away-day
- Do NOT use emojis
- Do NOT use sentences
- Do NOT repeat any of these words: ${avoidList}

Session context:
"${sessionName}"

Respond with ONLY the word.
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();

    let word =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Clean output (extra safety)
    word = word.replace(/[^a-zA-Z]/g, "").trim();

    return {
      statusCode: 200,
      body: JSON.stringify({ word })
    };

  } catch (err) {
    console.error("Suggest-word error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Suggestion failed" })
    };
  }
}
