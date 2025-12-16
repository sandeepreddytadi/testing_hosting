export async function handler(event) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const { words } = JSON.parse(event.body);
        const text = words.join(", ");

        const res = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.GEMINI_API_KEY}`
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Analyze these words from a live session and give a 2 sentence summary of the group's sentiment/vibe: ${text}`
                        }]
                    }]
                })
            }
        );

        const data = await res.json();
        const summary =
            data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

        return {
            statusCode: 200,
            body: JSON.stringify({ summary })
        };

    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "AI failure" })
        };
    }
}
