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

    const prompt = `
      You are a professional corporate host summarizing one-word feedback from a company away-day.
      The words are: ${words.join(", ")}
      
      Task:
      - Write 2 short, energetic sentences summarizing the team's vibe.
      - Keep it positive and inspiring.
      - Do not use markdown or bullet points, just plain text.
    `;

    // --- 3. THE RACE (Multi-Provider Setup) ---
    const requests = [];

    // Lane 1: OpenRouter (Gemini / Mistral Free)
    if (process.env.OPENROUTER_API_KEY) {
      requests.push(
        fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "X-Title": "Word Cloud Summarizer"
          },
          body: JSON.stringify({
            model: "google/gemini-2.0-flash-exp:free",
            messages: [{ role: "user", content: prompt }]
          })
        }).then(async res => {
          if (!res.ok) throw new Error("OpenRouter Error");
          const data = await res.json();
          return { summary: data.choices[0].message.content, source: "OpenRouter" };
        })
      );
    }

    // Lane 2: Groq (Ultra Fast Llama)
    if (process.env.GROQ_API_KEY) {
      requests.push(
        fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }]
          })
        }).then(async res => {
          if (!res.ok) throw new Error("Groq Error");
          const data = await res.json();
          return { summary: data.choices[0].message.content, source: "Groq" };
        })
      );
    }

    // Lane 3: Mistral Direct
    if (process.env.MISTRAL_API_KEY) {
      requests.push(
        fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "mistral-small-latest",
            messages: [{ role: "user", content: prompt }]
          })
        }).then(async res => {
          if (!res.ok) throw new Error("Mistral Error");
          const data = await res.json();
          return { summary: data.choices[0].message.content, source: "Mistral" };
        })
      );
    }

    // --- 4. EXECUTE RACE ---
    if (requests.length === 0) throw new Error("No API keys configured");

    const winner = await Promise.any(requests);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        summary: winner.summary.trim(), 
        provider: winner.source 
      })
    };

  } catch (err) {
    console.error("All providers failed or general error:", err);
    
    // Safety Net: If AI fails, return a generic upbeat summary
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        summary: "The team is showing incredible energy and alignment today. Let's keep this momentum going as we move forward!",
        provider: "Static Backup"
      })
    };
  }
}
