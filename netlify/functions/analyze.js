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

    const prompt =
      `Analyze these words from a live session and give a 2 sentence summary of the group's sentiment/vibe: ${words.join(", ")}`;

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
