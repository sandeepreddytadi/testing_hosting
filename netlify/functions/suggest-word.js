export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // 1. CONFIG: The "Boring Word" Ban List
  // We explicitly tell the AI: "If you use these, you fail."
  const BANNED_WORDS = [
    "Synergy", "Engage", "Elevate", "Empower", "Leverage", "Circle-back", 
    "Deep-dive", "Touchbase", "Pivot", "Unpack", "Bandwidth", "Paradigm",
    "Streamline", "Optimize", "Align", "Alignment", "Sync", "Journey",
    "Transform", "Transformation", "Innovate", "Innovation", "Disrupt"
  ];

  // 2. CONFIG: The "Vibe" Randomizer
  // Instead of asking for "a word", we ask for specific FLAVORS of words.
  const VIBES = [
    "A bold, punchy ACTION VERB (e.g., Ignite, Launch, Sprint)",
    "A visual NATURE metaphor (e.g., Summit, Roots, Horizon, Tides)",
    "A word related to SPEED and MOTION (e.g., Velocity, Momentum, Surge)",
    "A word related to STRENGTH and STRUCTURE (e.g., Anchor, Pillar, Forge)",
    "A modern, slightly edgy TECH word (e.g., Glitch, Beta, Node, Signal)",
    "A simple, human EMOTIONAL word (e.g., Trust, Spark, Pulse, Guts)"
  ];

  // 3. CONFIG: The Model Chain
  const MODEL_CHAIN = [
    "amazon/nova-2-lite-v1:free",
    "meta-llama/llama-3.2-3b-instruct:free", 
    "mistralai/mistral-7b-instruct:free",
    "google/gemma-3-4b-it:free",
    "meta-llama/llama-3.3-70b-instruct:free"
  ];

  try {
    const { sessionName, existingWords = [] } = JSON.parse(event.body || "{}");
    
    // Combine your live words with our banned words
    const avoidList = [...existingWords, ...BANNED_WORDS].join(", ");
    
    // Pick a random vibe for this specific request
    const randomVibe = VIBES[Math.floor(Math.random() * VIBES.length)];

    if (!process.env.OPENROUTER_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing OpenRouter Key" }) };
    }

    const prompt = `
      Context: You are the creative director for a corporate event named "${sessionName}".
      
      Task: Suggest ONE single word to put on a giant screen.
      
      Constraint 1 (Style): I need ${randomVibe}.
      Constraint 2 (Formatting): ONE word only. No punctuation. No emojis.
      Constraint 3 (Ban List): DO NOT use any of these words: ${avoidList}.
      
      If the style is "Tech", give me something cool like "Orbit" or "Flux".
      If the style is "Nature", give me "Wild" or "Bloom".
      
      Respond with ONLY the word.
    `;

    let word = null;
    let usedModel = null;

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
            "messages": [{ "role": "user", "content": prompt }],
            "temperature": 1.2 // High temperature = More creative/random
          })
        });

        const data = await response.json();

        if (data.choices?.[0]?.message?.content) {
          word = data.choices[0].message.content;
          usedModel = model;
          break;
        }
      } catch (err) {
        console.warn(`Skipping ${model}`);
      }
    }

    if (!word) {
      return { statusCode: 500, body: JSON.stringify({ error: "All models busy" }) };
    }

    // Clean output (remove periods, spaces, quotes)
    word = word.replace(/[^a-zA-Z]/g, "").trim();

    // If AI fails and gives a banned word anyway, force a fallback
    if (BANNED_WORDS.map(w => w.toUpperCase()).includes(word.toUpperCase())) {
      word = "Spark"; // Emergency backup
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ word, usedModel })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Suggestion failed" }) };
  }
}
