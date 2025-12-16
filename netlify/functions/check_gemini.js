export async function handler(event) {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 1. Check if key exists in Netlify environment
    if (!process.env.GEMINI_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          ok: false,
          message: "GEMINI_API_KEY is NOT set in Netlify environment"
        })
      };
    }

    // 2. Make a tiny test call to Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: "Reply with the word OK only." }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    // 3. Validate response
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (text && text.toUpperCase().includes("OK")) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          message: "✅ Gemini API key is VALID and working"
        })
      };
    }

    // 4. Key exists but Gemini didn't respond correctly
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        message: "⚠️ Gemini responded, but output was unexpected",
        rawResponse: data
      })
    };

  } catch (err) {
    console.error("Key check error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        message: "❌ Gemini API call failed",
        error: err.message
      })
    };
  }
}
