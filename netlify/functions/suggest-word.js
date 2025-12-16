export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { sessionName, existingWords = [] } = JSON.parse(event.body || "{}");
    const avoidList = existingWords.join(", ");

    // 1. Check for Key
    if (!process.env.OPENROUTER_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "Server Error: Missing OpenRouter Key" }) };
    }

    const prompt = `
      You are helping participants in a company away-day session "${sessionName}".
      
      Task:
      - Suggest ONE single positive word for this session.
      - Do NOT use emojis.
      - Do NOT use sentences.
      - Do NOT repeat these words: ${avoidList}
      
      Respond with ONLY the word.
    `;

    // 2. Call OpenRouter (Mistral 7B - Stable & Free)
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://wordcloud-app.netlify.app", 
        "X-Title": "Word Cloud Suggestion"
      },
      body: JSON.stringify({
        "model": "mistralai/mistral-7b-instruct:free", // <--- Using the stable free model
        "messages": [
          { "role": "user", "content": prompt }
        ]
      })
    });

    const data = await response.json();

    // 3. Extract word (OpenAI format)
    let word = data.choices?.[0]?.message?.content || "";

    // 4. Clean output (Remove punctuation, newlines, extra spaces)
    word = word.replace(/[^a-zA-Z]/g, "").trim();

    return {
      statusCode: 200,
      body: JSON.stringify({ word })
    };

  } catch (err) {
    console.error("Suggest-word error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Suggestion failed", details: err.message })
    };
  }
}
