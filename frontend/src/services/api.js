export async function analyzeThreat(data) {
    const response = await fetch("http://127.0.0.1:8000/analyze", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });

    return await response.json();
}

/**
 * Stream agent events via SSE from /analyze_stream.
 * @param {object} data - The detection payload
 * @param {function} onEvent - Callback fired for each agent event
 * @returns {Promise<object>} - The final analysis report
 */
export async function analyzeWithStream(data, onEvent) {
    const response = await fetch("http://127.0.0.1:8000/analyze_stream", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        throw new Error(`Stream request failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult = null;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete line in buffer

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;

            const payload = trimmed.slice(6); // remove "data: "
            if (payload === "[DONE]") continue;

            try {
                const parsed = JSON.parse(payload);

                // Check if this is the final result event
                if (parsed.type === "result") {
                    finalResult = parsed.data;
                } else {
                    // It's an agent event — fire the callback
                    if (onEvent) onEvent(parsed);
                }
            } catch (e) {
                console.warn("SSE parse error:", e, payload);
            }
        }
    }

    return finalResult;
}