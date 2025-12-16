// deploy as: netlify/functions/debug-models.js
export async function handler(event) {
  // Only allow GET
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 1. Fetch all models from OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/models");
    const data = await response.json();
    const allModels = data.data || [];

    // 2. Filter for TRULY free models (price = 0)
    // We check that prompt (input) AND completion (output) are both "0"
    const freeModels = allModels.filter(m => {
      const p = m.pricing;
      return p && 
             (p.prompt === "0" || p.prompt === 0) && 
             (p.completion === "0" || p.completion === 0);
    });

    // 3. Sort them to put the most popular/robust ones on top
    // (Optional: You can customize this sort)
    freeModels.sort((a, b) => a.id.localeCompare(b.id));

    // 4. Return the list
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "OK",
        count_total: allModels.length,
        count_free: freeModels.length,
        // We map just the useful fields to keep the output readable
        free_models: freeModels.map(m => ({
          id: m.id,
          name: m.name,
          context_length: m.context_length,
          description: m.description ? m.description.substring(0, 60) + "..." : "No desc"
        }))
      }, null, 2)
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}
