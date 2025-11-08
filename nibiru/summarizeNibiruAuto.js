// =============================
// Nibiru: Context-Aware Summarizer Router
// =============================
//
// summarizeNibiruAuto(text, context, options)
// - text: the HTML/plain text to be summarized (Learning Hub main content)
// - context: sidebar/TOC/breadcrumbs like "Assignments / COMP1510 Assignment 2 / PDF"
// - options:
//     apiKey         : OpenAI key (required)
//     model          : default "gpt-4o-mini"
//     temperature    : default 0.3
//     maxTokens      : default 1200
//     preferClassifier: false (set true to run a tiny AI classifier instead of regex)
//     forceCategory  : "ASSIGNMENT" | "GENERAL" (optional override)
//     rubricOnly     : boolean (optional; if true, uses rubric-extractor prompt)
//
// Dependencies: native fetch (Node 18+ or browser). DO NOT hardcode your API key in extension code.

async function summarizeNibiruAuto(
  text,
  context,
  {
    apiKey = process.env.OPENAI_API_KEY,
    model = "gpt-4o-mini",
    temperature = 0.3,
    maxTokens = 1200,
    preferClassifier = false,
    forceCategory,       // "ASSIGNMENT" | "GENERAL"
    rubricOnly = false
  } = {}
) {
  if (!apiKey) throw new Error("Missing OpenAI API key");
  if (!text || !text.trim()) throw new Error("Empty source text");

  // 1) Heuristic classifier (fast + offline)
  function heuristicCategory(ctx, body) {
    const blob = `${ctx} ${body}`.toLowerCase();
    const hit = (s) => blob.includes(s);
    const assignmentSignals = [
      "assignment", "assignments", "due", "deadline",
      "submit", "submission", "deliverable",
      "rubric", "marks", "grading", "evaluation",
      "late penalty", "points", "weight"
    ];
    const score = assignmentSignals.reduce((acc, k) => acc + (hit(k) ? 1 : 0), 0);
    return score >= 2 || /assignment\s*\d+/i.test(blob) ? "ASSIGNMENT" : "GENERAL";
  }

  // 2) Optional: tiny AI classifier (more robust on tricky pages)
  async function aiCategory(ctx, body) {
    const clsPrompt = `
You are a strict classifier. Read the CONTEXT and SOURCE and output exactly one word: ASSIGNMENT or GENERAL.
- ASSIGNMENT: students must do tasks and likely has due dates/submission steps/rubrics.
- GENERAL: lectures, announcements, rubrics-only pages, or any non-assignment docs.
Output exactly one token: ASSIGNMENT or GENERAL. No punctuation, no explanation.

CONTEXT:
${ctx}

SOURCE (snippet, may include HTML):
${body.slice(0, 2000)}
    `.trim();

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a strict labeler that outputs one token only." },
          { role: "user", content: clsPrompt }
        ],
        temperature: 0.0,
        max_tokens: 4
      })
    });
    const data = await res.json();
    const label = (data.choices?.[0]?.message?.content || "").trim().toUpperCase();
    return label === "ASSIGNMENT" ? "ASSIGNMENT" : "GENERAL";
  }

  // 3) Decide category
  let category = forceCategory || (preferClassifier ? await aiCategory(context, text) : heuristicCategory(context, text));

  // 4) If rubric-only requested, use the rubric extractor regardless of category
  if (rubricOnly) {
    const prompt = `
You are Nibiru, extracting ONLY rubric/evaluation details from a BCIT Learning Hub page that contains HTML mixed with text.

Instructions:
- Return PLAIN TEXT (Markdown allowed).
- If NO rubric/evaluation/grading info is present, explicitly return "No rubric found."
- Do NOT invent weights or criteria.
- If weights are partially missing, include the criteria anyway and write "Weight: Not specified".
- Keep it concise and skimmable.

GENERAL MESSAGE:
Summarize the text that is passed to you based on the category below:
Category: ${category}

OUTPUT FORMAT (return ONLY the sections below):

---
# Nibiru Rubric

## Source Meta
- Title: 
- Course/Module (if available): 
- URL (if present in source): 

## Rubric Summary
[1–2 sentences describing what the rubric evaluates. If none, write "No rubric found."]

## Criteria & Weights
[Use bullets. Each bullet = one criterion. Include weight if present; else "Not specified". 3–12 bullets ideal. If none, write "No rubric found."]
- Criterion: ; Weight: 

## Notes / Marking Rules
[Late penalties, rounding rules, minimum thresholds, pass conditions, submission requirements that affect grading. If none, write "Not specified".]
- 

---

CONTEXT:
${context}

SOURCE (HTML + text):
<<<BEGIN_SOURCE>>>
${text}
<<<END_SOURCE>>>
    `.trim();

    return await callOpenAI({ apiKey, model, temperature, maxTokens, prompt });
  }

  // 5) Otherwise: route to Assignment or General full-summary prompt
  if (category === "ASSIGNMENT") {
    const prompt = `
You are Nibiru, a summarizer for BCIT Learning Hub pages. You receive HTML mixed with text. 
GENERAL MESSAGE: Summarize the text that is passed to you based on the category below.
Category: ASSIGNMENT

Your job:
1) Produce a clean, skimmable summary as PLAIN TEXT (Markdown allowed) using the EXACT section order and headings below.
2) NEVER invent facts. If a field is unknown, write "Not specified".
3) Provide an ordered, actionable Step-by-Step Guide (5–10 steps).

OUTPUT FORMAT (return ONLY the sections below):

---
# Nibiru Summary

## Template Type
ASSIGNMENT

## Source Meta
- Title: 
- Course Name: 
- Instructor/Author: 
- Date: 
- URL (if present in source): 

## Overview
[2–4 sentences summarizing the essence. No fluff.]

## Step-by-Step Guide
[An ordered, actionable workflow students can follow. 5–10 steps, concise.]
1. 
2. 
3. 
4. 
5. 

## Key Requirements
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
- 

## Summary Insight
[One paragraph, crisp “what to remember”. No new info; synthesize only.]

---

CONTEXT:
${context}

SOURCE (HTML + text):
<<<BEGIN_SOURCE>>>
${text}
<<<END_SOURCE>>>
    `.trim();

    return await callOpenAI({ apiKey, model, temperature, maxTokens, prompt });
  } else {
    const prompt = `
You are Nibiru, a summarizer for BCIT Learning Hub pages. You receive HTML mixed with text.
GENERAL MESSAGE: Summarize the text that is passed to you based on the category below.
Category: GENERAL (Lecture / Announcement / Document / Rubric-like info)

Rules:
- Return PLAIN TEXT (Markdown allowed).
- NEVER invent facts. If a field is unknown, write "Not specified".
- Be concise. No extra commentary outside the sections.

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

CONTEXT:
${context}

SOURCE (HTML + text):
<<<BEGIN_SOURCE>>>
${text}
<<<END_SOURCE>>>
    `.trim();

    return await callOpenAI({ apiKey, model, temperature, maxTokens, prompt });
  }
}

// --- Low-level caller shared by all prompts
async function callOpenAI({ apiKey, model, temperature, maxTokens, prompt }) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are a helpful AI summarizer named Nibiru. Return only the requested sections in plain text (Markdown allowed), no extra commentary." },
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

// =============================
// Example
// =============================
/*
(async () => {
  const context = `
Expand side panel
Table of Contents
Assignments
Comp1510 Assignment 2
PDF document
Activity Details
You have viewed this topic
  `;

  const html = `
    <h1>COMP 1510 – Assignment 2: Arrays & Methods</h1>
    <p>Due: Oct 28, 11:59 PM. Submit a .zip with src/ and README.md.</p>
    <ul>
      <li>Implement array utilities</li>
      <li>Write unit tests</li>
      <li>Follow BCIT coding conventions</li>
    </ul>
    <p>Rubric: Functionality 40%, Docs 20%, Efficiency 20%, Style 20%</p>
  `;

  const summary = await summarizeNibiruAuto(html, context, {
    apiKey: "YOUR_OPENAI_KEY",
    preferClassifier: false, // try true for AI classification
  });

  console.log(summary);
})();
*/
