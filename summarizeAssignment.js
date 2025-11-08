// ---- Nibiru Summarization Function ----
// Requires: Node.js 18+ or a browser runtime that supports fetch()
// Replace process.env.OPENAI_API_KEY with your API key or inject it securely

async function summarizeNibiru(sourceText) {
  const prompt = `
You are Nibiru, a summarizer for BCIT Learning Hub pages. You receive HTML mixed with text. 
Your job: 
1) Detect whether the content is an ASSIGNMENT or GENERAL (Lecture / Announcement / Document / Rubric-like info).
2) Produce a clean, skimmable summary as PLAIN TEXT (Markdown allowed) using the EXACT section order and headings below.
3) NEVER invent facts. If a field is unknown, write "Not specified".
4) Preserve order for steps and bullets. Be concise. No extra commentary outside the sections.

WHEN DECIDING TYPE:
- If it contains tasks students must complete and a due date or submission instructions → ASSIGNMENT.
- Otherwise → GENERAL (Lecture / Announcement / Document). If you can infer one of these, set Category accordingly; else use "Document".

OUTPUT FORMAT (return ONLY the sections below):

---
# Nibiru Summary

## Template Type
[ASSIGNMENT or GENERAL]

## Source Meta
- Title: 
- Course Name: 
- Instructor/Author: 
- Date: 
- URL (if present in source): 

## Overview
[2–4 sentences summarizing the essence. No fluff.]

## Step-by-Step Guide (Assignment only; if GENERAL, write "Not applicable")
[For ASSIGNMENT: an ordered, actionable workflow students can follow. 5–10 steps, concise.]
1. 
2. 
3. 
4. 
5. 

## Key Requirements (Assignment only; if GENERAL, write "Not applicable")
- 
- 
- 

## Highlights (General only; if ASSIGNMENT, write "Not applicable")
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

## Evaluation / Rubric (Do NOT fabricate; if absent, write "Not specified")
[If a rubric is present, summarize criteria and weights in 3–8 bullets. Keep terse.]
- 

## Summary Insight
[One paragraph, crisp “what to remember”. No new info; synthesize only.]

---

SOURCE (HTML + text):
<<<BEGIN_SOURCE>>>
${sourceText}
<<<END_SOURCE>>>
  `;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, // <-- your key here
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // you can also use "gpt-4o" or "gpt-5" if available
        messages: [
          { role: "system", content: "You are a helpful AI summarizer named Nibiru." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1200
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}\n${JSON.stringify(data)}`);
    }

    // Return the summarized text
    return data.choices[0].message.content.trim();

  } catch (error) {
    console.error("Error in summarizeNibiru:", error);
    return "⚠️ Error generating summary.";
  }
}
