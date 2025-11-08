// ---- Nibiru General Summarization Function ----
// Works in Node 18+ or browsers that support fetch(). For Chrome extensions,
// inject your API key securely (do NOT hardcode).

async function summarizeNibiruGeneral(sourceText, {
  apiKey = process.env.OPENAI_API_KEY,
  model = "gpt-4o-mini",
  temperature = 0.3,
  maxTokens = 1200
} = {}) {
  if (!apiKey) throw new Error("Missing OpenAI API key");

  const prompt = `
You are Nibiru, a summarizer for BCIT Learning Hub pages. You receive HTML mixed with text.
TASK: Produce a clean, skimmable GENERAL summary (Lecture / Announcement / Document / Rubric-like info) as PLAIN TEXT (Markdown allowed) using the EXACT sections below.
RULES:
- NEVER invent facts. If a field is unknown, write "Not specified".
- Be concise. No extra commentary outside the sections.
- If you detect this is actually an assignment, still follow this GENERAL format (do not switch templates).

OUTPUT FORMAT (return ONLY the sections below):

---
# Nibiru General Summary

## Source Meta
- Title: 
- Category:  (Lecture / Rubric / Announcement / Document)
- Date: 
- Instructor/Author: 
- URL (if present in source): 

## Main Summary
[2–4 sentences capturing the essence, no fluff.]

## Highlights
- 
- 
- 

## Purpose / Context
[Why this matters; what it prepares the student for. 1–3 sentences.]

## Resources
[List links/titles mentioned. If none, write "Not specified".]
- 

## Tips & Notes
[Short tactical tips if implied; else "Not specified".]
- 

## Evaluation / Rubric (if present; else "Not specified")
- 

## Summary Insight
[One paragraph: crisp “what to remember”. Synthesize only—no new facts.]

---

SOURCE (HTML + text):
<<<BEGIN_SOURCE>>>
${sourceText}
<<<END_SOURCE>>>
  `.trim();

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are a helpful AI summarizer named Nibiru." },
        { role: "user", content: prompt }
      ],
      temperature,
      max_tokens: maxTokens
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`OpenAI API Error: ${res.status} ${res.statusText}\n${JSON.stringify(data)}`);
  }
  return (data.choices?.[0]?.message?.content || "").trim();
}

// Example usage:
(async () => {
  const html = `
    <h1>Lecture 9: Linked Lists</h1>
    <p>Author: Dr. Smith • Date: Oct 12</p>
    <ul><li>Node structure</li><li>Insert/Delete</li><li>Use cases</li></ul>
    <p>Resources: Chapter 6, lab4.pdf</p>
  `;
  const output = await summarizeNibiruGeneral(html, { apiKey: "YOUR_API_KEY" });
  console.log(output);
})();
