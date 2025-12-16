export async function handler(event) {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 1️⃣ Check env key existence
    if (!process.env.GEMINI_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          step: "ENV_CHECK",
          ok: false,
          error: "GEMINI_API_KEY is missing in Netlify environment"
        }, null, 2)
      };
    }

    // 2️⃣ Build a strong test prompt
    const prompt = `
You are a test AI.

Respond EXACTLY in this JSON format:
{
  "status": "OK",
  "message": "Gemini is responding correctly",
  "model": "name"
}
`;

    // 3️⃣ Call Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const status = response.status;
    const data = await response.json();

    // 4️⃣ Extract text safely
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || null;

    return {
      statusCode: 200,
      body: JSON.stringify({
        step: "GEMINI_RESPONSE",
        httpStatus: status,
        keyPresent: true,
        hasCandidates: !!data?.candidates,
        extractedText: text,
        rawGeminiResponse: data
      }, null, 2)
    };

  } catch (err) {
    console.error("Debug error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        step: "EXCEPTION",
        error: err.message,
        stack: err.stack
      }, null, 2)
    };
  }
}
