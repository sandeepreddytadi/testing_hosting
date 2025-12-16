export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // --- 1. CONFIG: BACKUP LIST ---
  const EMERGENCY_BACKUP_WORDS = [
    "Momentum", "Spark", "Velocity", "Impact", "Pulse", 
    "Ignite", "Orbit", "Flux", "Catalyst", "Zenith",
    "Apex", "Rooted", "Flow", "Sync", "Quest",
    "Bold", "Drive", "Focus", "Unity", "Scale"
  ];

  // --- 2. CONFIG: RACING MODELS ---
  const MODELS = [
    "amazon/nova-2-lite-v1:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "google/gemma-3-4b-it:free",
    "mistralai/mistral-7b-instruct:free"
  ];

  // 🔴 FIX: Declare this OUTSIDE the try block
  let existingWords = [];
  let sessionName = "Session";

  try {
    // 3. PARSE INPUT
    const body = JSON.parse(event.body || "{}");
    existingWords = body.existingWords || [];
    sessionName = body.sessionName || "Session";

    const avoidList = existingWords.join(", ");

    // Check Key
    if (!process.env.OPENROUTER_API_KEY) throw new Error("No Key");

    const prompt = `
      Suggest ONE single positive word for corporate away day for feedback.
      Do NOT use emojis. Do NOT use sentences.
      Do NOT repeat: ${avoidList}
      Respond with ONLY the word.
    `;

    // 4. THE RACE LOGIC (3s Timeout)
    const fetchPromise = (model) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); 

      return fetch("https://openrouter.ai/api/v1/chat/completions", {
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
        }),
        signal: controller.signal
      })
      .then(async res => {
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error("Downstream Error");
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error("Empty Response");
        return { word: content, usedModel: model };
      });
    };

    // Wait for the FIRST winner
    const winner = await Promise.any(MODELS.map(model => fetchPromise(model)));
    
    // Clean Output
    let cleanWord = winner.word.replace(/[^a-zA-Z]/g, "").trim();

    return {
      statusCode: 200,
      body: JSON.stringify({ word: cleanWord, usedModel: winner.usedModel })
    };

  } catch (err) {
    // --- 5. FALLBACK LOGIC ---
    console.warn("⚠️ AI busy/failed. Using Backup.", err.message);
    
    // 🔴 Now 'existingWords' is accessible here!
    const availableBackups = EMERGENCY_BACKUP_WORDS.filter(w => !existingWords.includes(w));
    
    const finalSet = availableBackups.length > 0 ? availableBackups : EMERGENCY_BACKUP_WORDS;
    const backupWord = finalSet[Math.floor(Math.random() * finalSet.length)];

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        word: backupWord, 
        usedModel: "backup-list (AI Overload Protection)" 
      })
    };
  }
}
