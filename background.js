// Background service worker for Nibiru extension
// Handles OpenAI API calls for summarization

// Function to extract page content (runs in page context)
function extractPageContent() {
    // Remove script and style elements
    const scripts = document.querySelectorAll('script, style, nav, header, footer, aside, .sidebar, .menu, .navigation');
    scripts.forEach(el => el.style.display = 'none');

    // Try to find main content area
    const mainContentSelectors = [
        'main',
        '[role="main"]',
        '.main-content',
        '.content',
        '#content',
        '.page-content',
        '.article',
        '.post',
        '.entry-content',
        '.body-content',
        'article',
        '.assignment-content',
        '.course-content',
        '.learning-hub-content'
    ];

    let mainContent = null;
    for (const selector of mainContentSelectors) {
        mainContent = document.querySelector(selector);
        if (mainContent) break;
    }

    const contentElement = mainContent || document.body;
    const textContent = contentElement.innerText || contentElement.textContent || '';
    const title = document.title || '';
    const url = window.location.href || '';

    // Extract context (breadcrumbs, sidebar, etc.)
    const contextSelectors = [
        '.breadcrumbs',
        '.breadcrumb',
        '.navigation-path',
        '.page-path',
        '[aria-label*="breadcrumb" i]',
        'nav[aria-label*="navigation" i]'
    ];

    let context = '';
    for (const selector of contextSelectors) {
        const contextEl = document.querySelector(selector);
        if (contextEl) {
            context = contextEl.innerText || contextEl.textContent || '';
            break;
        }
    }

    const htmlContent = contentElement.innerHTML || '';

    // Restore hidden elements
    scripts.forEach(el => el.style.display = '');

    return {
        text: textContent.trim(),
        html: htmlContent,
        title: title.trim(),
        url: url,
        context: context.trim()
    };
}

// Import the summarize function (we'll include it inline for manifest v3)
async function summarizeNibiruAuto(text, context, options = {}) {
    const {
        apiKey,
        model = "gpt-4o-mini",
        temperature = 0.3,
        maxTokens = 1200,
        preferClassifier = false,
        forceCategory,
        rubricOnly = false
    } = options;

    if (!apiKey) throw new Error("Missing OpenAI API key");
    if (!text || !text.trim()) throw new Error("Empty source text");

    // Heuristic classifier (fast + offline)
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

    // AI classifier (more robust on tricky pages)
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

    // Decide category
    let category = forceCategory || (preferClassifier ? await aiCategory(context, text) : heuristicCategory(context, text));

    // Build prompt based on category
    let prompt = '';
    if (rubricOnly) {
        prompt = `
You are Nibiru, extracting ONLY rubric/evaluation details from a BCIT Learning Hub page that contains HTML mixed with text.

Instructions:
- Return PLAIN TEXT (Markdown allowed).
- If NO rubric/evaluation/grading info is present, explicitly return "No rubric found."
- Do NOT invent weights or criteria.
- If weights are partially missing, include the criteria anyway and write "Weight: Not specified".
- Keep it concise and skimmable.

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
    } else if (category === "ASSIGNMENT") {
        prompt = `
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
[One paragraph, crisp "what to remember". No new info; synthesize only.]

---

CONTEXT:
${context}

SOURCE (HTML + text):
<<<BEGIN_SOURCE>>>
${text}
<<<END_SOURCE>>>
        `.trim();
    } else {
        prompt = `
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
[One paragraph: crisp "what to remember". Synthesize only—no new facts.]

---

CONTEXT:
${context}

SOURCE (HTML + text):
<<<BEGIN_SOURCE>>>
${text}
<<<END_SOURCE>>>
        `.trim();
    }

    // Call OpenAI API
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

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'summarize') {
        (async () => {
            try {
                // Get API key from storage
                const result = await chrome.storage.local.get(['apiKey']);
                const apiKey = result.apiKey;

                if (!apiKey) {
                    sendResponse({ 
                        success: false, 
                        error: 'API key not set. Please configure your OpenAI API key in the extension settings.' 
                    });
                    return;
                }

                // Extract content if not provided
                let text = request.text;
                let context = request.context || '';

                if (!text) {
                    // Get active tab
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab || !tab.id) {
                        sendResponse({ success: false, error: 'No active tab found' });
                        return;
                    }

                    // Extract content from the page
                    try {
                        // Inject content script and extract content
                        const results = await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            func: extractPageContent
                        });

                        if (!results || !results[0] || !results[0].result) {
                            sendResponse({ success: false, error: 'Failed to extract page content' });
                            return;
                        }

                        const content = results[0].result;
                        text = content.text || content.html || '';
                        context = content.context || content.title || '';
                    } catch (error) {
                        sendResponse({ success: false, error: `Failed to extract content: ${error.message}` });
                        return;
                    }
                }

                if (!text || !text.trim()) {
                    sendResponse({ success: false, error: 'No content found on the page' });
                    return;
                }

                // Summarize the content
                const summary = await summarizeNibiruAuto(text, context, {
                    apiKey,
                    model: request.model || "gpt-4o-mini",
                    temperature: request.temperature || 0.3,
                    maxTokens: request.maxTokens || 1200
                });

                // Save summary to storage
                await chrome.storage.local.set({ summary: summary });

                sendResponse({ success: true, summary: summary });
            } catch (error) {
                console.error('Summarization error:', error);
                sendResponse({ 
                    success: false, 
                    error: error.message || 'Failed to generate summary' 
                });
            }
        })();

        return true; // Keep message channel open for async response
    }
});

