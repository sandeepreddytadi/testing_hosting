export async function handler(event) {
  // 1. Basic Security Checks
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 2. Parse Data
    const { words } = JSON.parse(event.body || "{}");
    if (!words || words.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "No words provided" }) };
    }

    // 3. Check for Key
    if (!process.env.OPENROUTER_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "Server Error: Missing OpenRouter Key" }) };
    }

    const prompt = `
      You are a professional corporate host summarizing one-word feedback from a company away-day.
      The words are: ${words.join(", ")}
      
      Task:
      - Write 2 short, energetic sentences summarizing the team's vibe.
      - Keep it positive and inspiring.
      - Do not use markdown or bullet points, just plain text.
    `;

    // 4. Call OpenRouter with your chosen model
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://wordcloud-app.netlify.app", // Optional: put your site URL here
        "X-Title": "Word Cloud App"
      },
      body: JSON.stringify({
        "model": "google/gemini-2.0-flash-exp:free", // <--- THE MODEL YOU CHOSE
        "messages": [
          { "role": "user", "content": prompt }
        ]
      })
    });

    const data = await response.json();

    // 5. Extract the summary safely
    const summary = data.choices?.[0]?.message?.content;

    if (!summary) {
      console.error("AI Error:", JSON.stringify(data));
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: "AI didn't return a summary", details: data }) 
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ summary })
    };

  } catch (err) {
    console.error("Function Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error", details: err.message })
    };
  }
}
