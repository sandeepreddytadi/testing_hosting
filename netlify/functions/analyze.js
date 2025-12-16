// deploy this as /netlify/functions/analyze.js
export async function handler(event) {
  // 1. Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 2. Parse Input
    const { words } = JSON.parse(event.body || "{}");
    if (!words || words.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "No words provided" }) };
    }

    // 3. Check for API Key
    if (!process.env.GEMINI_API_KEY) {
      console.error("FATAL: GEMINI_API_KEY is not set in Netlify Environment Variables");
      return { statusCode: 500, body: JSON.stringify({ error: "Server configuration error: API Key missing" }) };
    }

    const prompt = `
      You are a professional corporate host summarizing one-word feedback from a company away-day.
      Write 2 short, energetic sentences summarizing the vibe of these words:
      ${words.join(", ")}`;

    // 4. Call Google API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();

    // 5. Handle Google API Errors Explicitly
    if (!response.ok) {
      console.error("Gemini API Error:", JSON.stringify(data));
      return { 
        statusCode: response.status, 
        body: JSON.stringify({ 
          error: "AI Provider Error", 
          details: data.error?.message || "Unknown error from Google" 
        }) 
      };
    }

    // 6. Extract Content
    const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!summary) {
      console.log("Safety Filter Triggered or Empty Response:", JSON.stringify(data));
      return {
        statusCode: 200,
        body: JSON.stringify({ summary: "The team is full of energy, but I couldn't summarize the specific words just now!" }) 
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ summary })
    };

  } catch (err) {
    console.error("Function Crash:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error", details: err.message })
    };
  }
}
