// =============================
// Nibiru: Unified Text Summarizer
// =============================
//
// summarizeText(text, context, options)
// - text: the HTML/plain text to be summarized
// - context: "assignment" or "general" (or "rubric" for rubric-only extraction)
// - options:
//     apiEndpoint  : API endpoint URL (auto-detected based on API type, or specify manually)
//     apiKey       : API key (optional if OPENAI_API_KEY or GEMINI_API_KEY is set in .env file)
//     apiType      : "openai" | "gemini" | "auto" (default: "auto" - detects based on endpoint or key format)
//     model        : model name (default: "gpt-4o-mini" for OpenAI, "gemini-1.5-flash" for Gemini)
//     temperature  : default 0.3
//     maxTokens    : default 1200
//
// This function routes to the appropriate template based on the provided context
// and calls the AI API to generate the summary.
//
// API Key: The function will use process.env.OPENAI_API_KEY or process.env.GEMINI_API_KEY if no apiKey is provided.
// For Node.js environments, ensure your .env file is loaded (e.g., using dotenv package).
// For Chrome extensions, pass the apiKey explicitly or use chrome.storage to retrieve it.

async function summarizeText(
  text,
  context,
  {
    apiEndpoint,
    apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY,
    apiType = "auto", // "openai" | "gemini" | "auto"
    model,
    temperature = 0.3,
    maxTokens = 1200
  } = {}
) {
  // Validate inputs
  if (!apiKey) throw new Error("Missing API key. Please provide apiKey in options or set OPENAI_API_KEY or GEMINI_API_KEY in .env file");
  if (!text || !text.trim()) throw new Error("Empty source text");
  
  // Detect API type if auto
  let detectedApiType = apiType;
  if (apiType === "auto") {
    // Check if endpoint is provided and contains "gemini" or "google"
    if (apiEndpoint && (apiEndpoint.includes("gemini") || apiEndpoint.includes("google"))) {
      detectedApiType = "gemini";
    }
    // Check environment variables - if GEMINI_API_KEY is set, use Gemini
    else if (process.env.GEMINI_API_KEY) {
      detectedApiType = "gemini";
    }
    // Check if API key looks like a Gemini key (Gemini keys don't start with "sk-" and are typically longer)
    // This works even if stored as OPENAI_API_KEY
    else if (apiKey && !apiKey.startsWith("sk-") && apiKey.length > 30) {
      detectedApiType = "gemini";
    } 
    // Check if API key looks like OpenAI key (starts with "sk-")
    else if (apiKey && apiKey.startsWith("sk-")) {
      detectedApiType = "openai";
    } else {
      // Default to OpenAI if we can't determine
      detectedApiType = "openai";
    }
  }
  
  // Set default endpoint and model based on API type
  if (!apiEndpoint) {
    if (detectedApiType === "gemini") {
      // Use OpenAI-compatible endpoint for Gemini (easier integration)
      // Try gemini-2.0-flash-exp or gemini-1.5-pro
      model = model || "gemini-2.0-flash-exp";
      apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;
    } else {
      // Default OpenAI endpoint
      model = model || "gpt-4o-mini";
      apiEndpoint = "https://api.openai.com/v1/chat/completions";
    }
  } else if (!model) {
    // If endpoint is provided but model isn't, set defaults
    if (detectedApiType === "gemini") {
      model = "gemini-2.0-flash-exp";
    } else {
      model = "gpt-4o-mini";
    }
  }
  
  // Normalize context to uppercase for consistency
  const normalizedContext = (context || "general").toLowerCase().trim();
  
  // Determine the category based on context
  let category;
  let isRubricOnly = false;
  
  if (normalizedContext === "assignment" || normalizedContext === "assignments") {
    category = "ASSIGNMENT";
  } else if (normalizedContext === "rubric") {
    category = "ASSIGNMENT"; // Rubrics are typically part of assignments
    isRubricOnly = true;
  } else {
    category = "GENERAL";
  }

  // Generate prompt based on category
  let prompt;
  
  if (isRubricOnly) {
    // Rubric-only extraction prompt
    prompt = `
You are Nibiru, extracting ONLY rubric/evaluation details from a BCIT Learning Hub page that contains HTML mixed with text.

Instructions:
- Return PLAIN TEXT (Markdown allowed).
- If NO rubric/evaluation/grading info is present, return a message indicating no rubric was found.
- Do NOT invent weights or criteria.
- If weights are partially missing, include the criteria but omit the weight field entirely rather than writing "Not specified".
- Keep it concise and skimmable.
- IMPORTANT: Only output the section headings and content. Do NOT include any instructions, notes in brackets, or parenthetical instructions in the final output. Use only the clean section headings shown below.
- CRITICAL: Only include fields that have actual content. If a field would say "Not specified" or is empty, omit that entire field/line. Do not show empty fields or placeholder text.

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

SOURCE (HTML + text):
<<<BEGIN_SOURCE>>>
${text}
<<<END_SOURCE>>>
    `.trim();
  } else if (category === "ASSIGNMENT") {
    // Assignment summary prompt
    prompt = `
You are Nibiru, a summarizer for BCIT Learning Hub pages. You receive HTML mixed with text. 
GENERAL MESSAGE: Summarize the text that is passed to you based on the category below.
Category: ASSIGNMENT

Your job:
1) Produce a clean, skimmable summary as PLAIN TEXT (Markdown allowed) using the EXACT section order and headings below. Use only the section headings shown - do not include any instructions or notes in parentheses.
2) NEVER invent facts. If a field is unknown or not available, DO NOT include that field at all - omit it entirely from the output.
3) Provide an ordered, actionable Step-by-Step Guide (5–10 steps).
4) IMPORTANT: Only output the section headings and content. Do NOT include any instructions, notes in brackets, or parenthetical instructions in the final output.
5) CRITICAL: Only include fields that have actual content. If a field would say "Not specified" or is empty, omit that entire field/line. Do not show empty fields or placeholder text.
6) Do NOT wrap the output in markdown code blocks. Output the content directly as plain text with markdown formatting.

OUTPUT FORMAT (return ONLY the sections below):

---
# Nibiru Summary

## Template Type
ASSIGNMENT

## Source Meta
- Title: 
- Course Name: 
- Instructor/Author: [Only include if available]
- Date: 
- URL: [Only include if present in source] 

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
[Only include this section if resources are mentioned. List links/titles. If none, omit this entire section.]
- 

## Tips & Notes
[Only include this section if tips are available. Short tactical tips if implied. If none, omit this entire section.]
- 

## Evaluation / Rubric
- 

## Summary Insight
[One paragraph, crisp "what to remember". No new info; synthesize only.]

---

SOURCE (HTML + text):
<<<BEGIN_SOURCE>>>
${text}
<<<END_SOURCE>>>
    `.trim();
  } else {
    // General summary prompt
    prompt = `
You are Nibiru, a summarizer for BCIT Learning Hub pages. You receive HTML mixed with text.
GENERAL MESSAGE: Summarize the text that is passed to you based on the category below.
Category: GENERAL (Lecture / Announcement / Document / Rubric-like info)

Rules:
- Return PLAIN TEXT (Markdown allowed).
- NEVER invent facts. If a field is unknown or not available, DO NOT include that field at all - omit it entirely from the output.
- Be concise. No extra commentary outside the sections.
- IMPORTANT: Only output the section headings and content. Do NOT include any instructions, notes in brackets, or parenthetical instructions in the final output. Use only the clean section headings shown below.
- CRITICAL: Only include fields that have actual content. If a field would say "Not specified" or is empty, omit that entire field/line. Do not show empty fields or placeholder text. Only include sections that have meaningful content.
- Do NOT wrap the output in markdown code blocks. Output the content directly as plain text with markdown formatting.

OUTPUT FORMAT (return ONLY the sections below):

---
# Nibiru General Summary

## Source Meta
- Title: 
- Category: [Only include if determinable: Lecture / Rubric / Announcement / Document]
- Date: 
- Instructor/Author: [Only include if available]
- URL: [Only include if present in source] 

## Main Summary
[2–4 sentences capturing the essence, no fluff.]

## Highlights
- 
- 
- 

## Purpose / Context
[Why this matters; what it prepares the student for. 1–3 sentences.]

## Resources
[Only include this section if resources are mentioned. List links/titles. If none, omit this entire section.]
- 

## Tips & Notes
[Only include this section if tips are available. Short tactical tips if implied. If none, omit this entire section.]
- 

## Evaluation / Rubric
- 

## Summary Insight
[One paragraph: crisp "what to remember". Synthesize only—no new facts.]

---

SOURCE (HTML + text):
<<<BEGIN_SOURCE>>>
${text}
<<<END_SOURCE>>>
    `.trim();
  }

  // Call the AI API
  try {
    let requestBody;
    let requestHeaders;
    let requestUrl = apiEndpoint;
    
    if (detectedApiType === "gemini") {
      // Check if using OpenAI-compatible endpoint
      if (apiEndpoint.includes("/openai/")) {
        // Use OpenAI-compatible format for Gemini
        // For OpenAI-compatible endpoint, use Authorization header
        requestUrl = apiEndpoint;
        requestHeaders = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        };
        requestBody = {
          model,
          messages: [
            { 
              role: "system", 
              content: "You are a helpful AI summarizer named Nibiru. Return only the requested sections in plain text (Markdown allowed), no extra commentary." 
            },
            { role: "user", content: prompt }
          ],
          temperature,
          max_tokens: maxTokens
        };
      } else {
        // Native Gemini API format
        requestUrl = `${apiEndpoint}?key=${apiKey}`;
        requestHeaders = {
          "Content-Type": "application/json"
        };
        requestBody = {
          contents: [{
            parts: [{
              text: `You are a helpful AI summarizer named Nibiru. Return only the requested sections in plain text (Markdown allowed), no extra commentary.\n\n${prompt}`
            }]
          }],
          generationConfig: {
            temperature: temperature,
            maxOutputTokens: maxTokens
          }
        };
      }
    } else {
      // OpenAI API format
      requestUrl = apiEndpoint;
      requestHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      };
      requestBody = {
        model,
        messages: [
          { 
            role: "system", 
            content: "You are a helpful AI summarizer named Nibiru. Return only the requested sections in plain text (Markdown allowed), no extra commentary." 
          },
          { role: "user", content: prompt }
        ],
        temperature,
        max_tokens: maxTokens
      };
    }

    const response = await fetch(requestUrl, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    if (!response.ok) {
      // Provide more helpful error messages for common issues
      if (response.status === 429) {
        const errorMsg = data.error?.message || data.message || "Rate limit exceeded or quota exceeded";
        const apiName = detectedApiType === "gemini" ? "Gemini" : "OpenAI";
        throw new Error(`API Quota/Rate Limit Error (429): ${errorMsg}\nPlease check your ${apiName} account billing and usage limits.`);
      } else if (response.status === 401) {
        const apiName = detectedApiType === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY";
        throw new Error(`API Authentication Error (401): Invalid API key. Please check your ${apiName}.`);
      } else {
        throw new Error(`API Error: ${response.status} ${response.statusText}\n${JSON.stringify(data, null, 2)}`);
      }
    }

    // Parse response based on API type
    let result;
    if (detectedApiType === "gemini") {
      // Check if using OpenAI-compatible endpoint
      if (apiEndpoint.includes("/openai/")) {
        // OpenAI-compatible response format: data.choices[0].message.content
        result = data.choices?.[0]?.message?.content || "";
      } else {
        // Native Gemini response format: data.candidates[0].content.parts[0].text
        result = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (!result && data.promptFeedback) {
          throw new Error(`Gemini API Error: ${JSON.stringify(data.promptFeedback)}`);
        }
      }
    } else {
      // OpenAI response format: data.choices[0].message.content
      result = data.choices?.[0]?.message?.content || "";
    }

    return result.trim();
  } catch (error) {
    console.error("Error in summarizeText:", error);
    throw error;
  }
}

// Export for use in other modules (if using ES modules)
if (typeof module !== "undefined" && module.exports) {
  module.exports = { summarizeText };
}

// Example usage:
/*
(async () => {
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

  // Option 1: Use API key from .env file (process.env.OPENAI_API_KEY)
  // Make sure to load dotenv: require('dotenv').config(); at the top of your file
  const summary = await summarizeText(html, "assignment", {
    model: "gpt-4o-mini"
    // apiKey will be loaded from process.env.OPENAI_API_KEY automatically
  });
  console.log(summary);

  // Option 2: Explicitly provide API key
  const generalSummary = await summarizeText(html, "general", {
    apiKey: "your-api-key-here", // or omit to use process.env.OPENAI_API_KEY
    model: "gpt-4o-mini"
  });
  console.log(generalSummary);

  // Extract rubric only (uses API key from .env if available)
  const rubric = await summarizeText(html, "rubric", {
    model: "gpt-4o-mini"
  });
  console.log(rubric);
})();
*/

