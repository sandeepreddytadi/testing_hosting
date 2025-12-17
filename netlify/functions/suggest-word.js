export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // --- 1. CONFIGURATION ---
  
  // The Safety Net (Local Backup)
  const BACKUP_WORDS = [
    "Momentum", "Spark", "Impact", "Velocity", "Pulse", 
    "Ignite", "Orbit", "Flux", "Catalyst", "Zenith", 
    "Apex", "Rooted", "Flow", "Sync", "Quest",
    "Bold", "Drive", "Focus", "Unity", "Scale"
  ];

  // Your requested OpenRouter Models
  // We will pick ONE random one per request to keep variety high but rate limits low.
  const OPENROUTER_MODELS = [
    "meta-llama/llama-3.2-3b-instruct:free",
    "google/gemini-2.0-flash-exp:free",
    "mistralai/mistral-7b-instruct:free",
    "microsoft/phi-3-mini-128k-instruct:free",
    "openrouter/auto"
  ];

  try {
    const { sessionName, existingWords = [] } = JSON.parse(event.body || "{}");
    const avoidList = existingWords.join(", ");

    const prompt = `
      Suggest ONE single positive word for corporate session "${sessionName}".
      Do NOT use emojis. Do NOT use sentences.
      Do NOT repeat these words: ${avoidList}.
      Respond with ONLY the word.
    `;

    // --- 2. THE RACE TRACK (3 Lanes) ---
    const requests = [];

    // --- LANE 1: GROQ (Fastest) ---
    if (process.env.GROQ_API_KEY) {
      requests.push(
        fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { 
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, 
            "Content-Type": "application/json" 
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [{ role: "user", content: prompt }]
          })
        })
        .then(async res => {
          if (!res.ok) throw new Error("Groq Error");
          const data = await res.json();
          return { word: data.choices[0].message.content, source: "Groq (Llama-Instant)" };
        })
      );
    }

    // --- LANE 2: MISTRAL DIRECT (Reliable) ---
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
        })
        .then(async res => {
          if (!res.ok) throw new Error("Mistral Error");
          const data = await res.json();
          return { word: data.choices[0].message.content, source: "Mistral Direct" };
        })
      );
    }

    // --- LANE 3: OPENROUTER (Variety / Gemini / Phi-3) ---
    if (process.env.OPENROUTER_API_KEY) {
      // Pick a random model from your list for this specific user
      const randomModel = OPENROUTER_MODELS[Math.floor(Math.random() * OPENROUTER_MODELS.length)];
      
      requests.push(
        fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { 
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, 
            "Content-Type": "application/json",
            "HTTP-Referer": "https://wordcloud-app.netlify.app",
            "X-Title": "Word Cloud Suggest"
          },
          body: JSON.stringify({
            model: randomModel,
            messages: [{ role: "user", content: prompt }]
          })
        })
        .then(async res => {
          if (!res.ok) throw new Error("OpenRouter Error");
          const data = await res.json();
          return { word: data.choices[0].message.content, source: `OpenRouter (${randomModel})` };
        })
      );
    }

    // --- 3. EXECUTE RACE ---
    if (requests.length === 0) throw new Error("No keys configured");

    // Wait for the FIRST successful response
    const winner = await Promise.any(requests);

    // Clean up output
    const cleanWord = winner.word.replace(/[^a-zA-Z]/g, "").trim();

    return {
      statusCode: 200,
      body: JSON.stringify({ word: cleanWord, usedModel: winner.source })
    };

  } catch (err) {
    // --- 4. BACKUP (If all 3 APIs fail) ---
    console.warn("⚠️ All APIs busy/failed. Using Backup.");
    
    const availableBackups = BACKUP_WORDS.filter(w => !existingWords.includes(w));
    const finalSet = availableBackups.length > 0 ? availableBackups : BACKUP_WORDS;
    const backupWord = finalSet[Math.floor(Math.random() * finalSet.length)];

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        word: backupWord, 
        usedModel: "Local Backup (All APIs Busy)" 
      })
    };
  }
}
