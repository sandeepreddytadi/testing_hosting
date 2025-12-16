export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { words } = JSON.parse(event.body || "{}");

    if (!words || words.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No words provided" })
      };
    }

    const prompt = `
      You are a professional corporate host and facilitator summarizing one-word feedback from a company away-day session 
      (including ice-breakers, team discussions, and reflections).
      
      Guidelines:
      - Keep the tone warm, positive, and inclusive
      - Frame the feedback as shared energy, openness, and team connection
      - Gently turn any challenging words into learning or growth moments
      - Avoid criticism, analysis jargon, or mentioning negatives
      - Write 2–3 short, confident sentences suitable for a big screen
      
      One-word feedback from participants:
      ${words.join(", ")}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    console.log("Gemini raw response:", JSON.stringify(data));

    const summary =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    return {
      statusCode: 200,
      body: JSON.stringify({
        summary: summary || "No insights generated"
      })
    };

  } catch (err) {
    console.error("Analyze error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "AI failure" })
    };
  }
}
