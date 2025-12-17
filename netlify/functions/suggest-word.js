export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // --- 1. CONFIG: FEEDBACK STYLES (The "Vibe" of the critique) ---
  const FEEDBACK_STYLES = [
    "Style: High Praise (e.g., Inspiring, Electric, Flawless)",
    "Style: Constructive/Critical (e.g., Long, Rushed, Chaotic)",
    "Style: Intellectual/Mental (e.g., Insightful, Deep, Useful)",
    "Style: Emotional Reaction (e.g., Fun, Boring, Intense)",
    "Style: Action-Oriented (e.g., Motivating, Urgent, Clear)",
    "Style: Simple One-Word Review (e.g., Wow, Meh, Solid)"
  ];

  // Safety net for 100% uptime
  const BACKUP_WORDS = [
    "Inspiring", "Useful", "Fun", "Long", "Engaging", 
    "Chaotic", "Clear", "Boring", "Fast", "Deep", 
    "Electric", "Solid", "Relevant", "Dry", "Eye-opening",
    "Slow", "Powerful", "Confusing", "Bold", "Helpful"
  ];

  try {
    const { sessionName, existingWords = [] } = JSON.parse(event.body || "{}");
    const avoidList = existingWords.join(", ");

    // Pick a random style so every button click feels different
    const randomStyle = FEEDBACK_STYLES[Math.floor(Math.random() * FEEDBACK_STYLES.length)];
    const salt = Math.floor(Math.random() * 10000); 

    const prompt = `
      Context: You are an attendee at a corporate event named "${sessionName}".
      Task: Give ONE single word of feedback to describe your experience.
      
      Constraint: Give me a word that fits this style: ${randomStyle}.
      Negative Constraint: Do NOT use these words: ${avoidList}.
      Formatting: ONE single adjective or noun. No punctuation.
      
      Examples of good output: "Energizing", "Draggy", "Sharp", "Vague".
      Request ID: ${salt}
    `;

    // --- 2. THE RACE (3 Lanes) ---
    const requests = [];

    // Lane 1: Groq (Fastest)
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
            messages: [{ role: "user", content: prompt }],
            temperature: 1.2 // High creativity
          })
        })
        .then(async res => {
          if (!res.ok) throw new Error("Groq Error");
          const data = await res.json();
          return { word: data.choices[0].message.content, source: "Groq" };
        })
      );
    }

    // Lane 2: Mistral (Direct)
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
            messages: [{ role: "user", content: prompt }],
            temperature: 1.0
          })
        })
        .then(async res => {
          if (!res.ok) throw new Error("Mistral Error");
          const data = await res.json();
          return { word: data.choices[0].message.content, source: "Mistral" };
        })
      );
    }

    // Lane 3: OpenRouter (Variety)
    if (process.env.OPENROUTER_API_KEY) {
      requests.push(
        fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { 
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, 
            "Content-Type": "application/json",
            "HTTP-Referer": "https://wordcloud-app.netlify.app",
            "X-Title": "Word Cloud"
          },
          body: JSON.stringify({
            model: "google/gemini-2.0-flash-exp:free",
            messages: [{ role: "user", content: prompt }],
            temperature: 1.1
          })
        })
        .then(async res => {
          if (!res.ok) throw new Error("OpenRouter Error");
          const data = await res.json();
          return { word: data.choices[0].message.content, source: "OpenRouter" };
        })
      );
    }

    // Execute Race
    if (requests.length === 0) throw new Error("No keys");
    const winner = await Promise.any(requests);
    const cleanWord = winner.word.replace(/[^a-zA-Z]/g, "").trim();

    return {
      statusCode: 200,
      body: JSON.stringify({ word: cleanWord, usedModel: winner.source })
    };

  } catch (err) {
    console.warn("Using Backup:", err.message);
    
    const availableBackups = BACKUP_WORDS.filter(w => !existingWords.includes(w));
    const finalSet = availableBackups.length > 0 ? availableBackups : BACKUP_WORDS;
    const backupWord = finalSet[Math.floor(Math.random() * finalSet.length)];

    return {
      statusCode: 200,
      body: JSON.stringify({ word: backupWord, usedModel: "Local Backup" })
    };
  }
}
