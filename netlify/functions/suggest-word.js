export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // --- SUGGESTION CHAIN (Optimized for Speed) ---
  const MODEL_CHAIN = [
    "amazon/nova-2-lite-v1:free",               // 1. Extremely Fast
    "meta-llama/llama-3.2-3b-instruct:free",    // 2. Very Lightweight (3B)
    "mistralai/mistral-7b-instruct:free",       // 3. Reliable
    "google/gemma-3-4b-it:free",                // 4. Google's fast small model
    "meta-llama/llama-3.3-70b-instruct:free"    // 5. Heavyweight backup
  ];

  try {
    const { sessionName, existingWords = [] } = JSON.parse(event.body || "{}");
    const avoidList = existingWords.join(", ");

    if (!process.env.OPENROUTER_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing OpenRouter Key" }) };
    }

    const prompt = `
      Suggest ONE single positive word for a corporate "${sessionName}" session.
      Do NOT use emojis.
      Do NOT use sentences.
      Do NOT repeat these words: ${avoidList}
      Respond with ONLY the word.
    `;

    // --- RETRY LOOP ---
    let word = null;

    for (const model of MODEL_CHAIN) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://wordcloud-app.netlify.app",
            "X-Title": "Word Cloud Suggest"
          },
          body: JSON.stringify({
            "model": model,
            "messages": [{ "role": "user", "content": prompt }]
          })
        });

        const data = await response.json();

        if (data.choices?.[0]?.message?.content) {
          word = data.choices[0].message.content;
          break; // Success!
        }
      } catch (err) {
        console.warn(`Skipping ${model}`);
      }
    }

    if (!word) {
      return { statusCode: 500, body: JSON.stringify({ error: "All models busy" }) };
    }

    word = word.replace(/[^a-zA-Z]/g, "").trim();

    return { statusCode: 200, body: JSON.stringify({ word }) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Suggestion failed" }) };
  }
}
