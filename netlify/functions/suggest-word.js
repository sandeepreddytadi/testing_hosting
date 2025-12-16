export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // --- 1. THE SAFETY NET (Guaranteed 100% Uptime) ---
  // If the AI is too busy or slow, we instantly return one of these.
  const EMERGENCY_BACKUP_WORDS = [
    "Momentum", "Spark", "Velocity", "Impact", "Pulse", 
    "Ignite", "Orbit", "Flux", "Catalyst", "Zenith",
    "Apex", "Rooted", "Flow", "Sync", "Quest",
    "Bold", "Drive", "Focus", "Unity", "Scale"
  ];

  // --- 2. THE RACERS (Small, Fast Models) ---
  // We run these in PARALLEL. The first one to finish wins.
  const MODELS = [
    "amazon/nova-2-lite-v1:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "google/gemma-3-4b-it:free",
    "mistralai/mistral-7b-instruct:free"
  ];

  try {
    const { sessionName, existingWords = [] } = JSON.parse(event.body || "{}");
    const avoidList = existingWords.join(", ");

    // If no key, skip straight to backup
    if (!process.env.OPENROUTER_API_KEY) throw new Error("No Key");

    const prompt = `
      Suggest ONE single positive word for corporate session "${sessionName}".
      Do NOT use emojis. Do NOT use sentences.
      Do NOT repeat: ${avoidList}
      Respond with ONLY the word.
    `;

    // --- 3. THE RACE (Timeout set to 3 seconds) ---
    // We try multiple models at once. If they take > 3s, we use the backup.
    const fetchPromise = (model) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s hard timeout

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

    // Promise.any waits for the FIRST success, ignores failures
    const winner = await Promise.any(MODELS.map(model => fetchPromise(model)));
    
    // Clean up the winner
    let cleanWord = winner.word.replace(/[^a-zA-Z]/g, "").trim();

    return {
      statusCode: 200,
      body: JSON.stringify({ word: cleanWord, usedModel: winner.usedModel })
    };

  } catch (err) {
    // --- 4. THE FALLBACK EXECUTION ---
    // If ALL models fail or time out, we land here.
    console.warn("⚠️ AI busy/failed. Using Backup.", err.message);
    
    // Pick a random backup word that hasn't been used recently (simple filter)
    const availableBackups = EMERGENCY_BACKUP_WORDS.filter(w => !existingWords.includes(w));
    // If we used all backups, just pick any random one
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
