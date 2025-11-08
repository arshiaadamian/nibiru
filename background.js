// Background service worker for Nibiru extension
// Handles Gemini API calls for summarization

// Function to extract page content (runs in page context)
function extractPageContent() {
    // Remove script and style elements
    const scripts = document.querySelectorAll('script, style, nav, header, footer, aside, .sidebar, .menu, .navigation');
    scripts.forEach(el => el.style.display = 'none');

    // BCIT Learning Hub specific selectors (prioritized)
    const mainContentSelectors = [
        // Learning Hub specific
        '.d2l-fileviewer',                    // Document viewer container
        '.d2l-fileviewer-content',            // Document viewer content
        '[data-testid="content-viewer"]',     // Content viewer
        '.d2l-htmlblock',                     // HTML content block
        '.d2l-htmleditor-container',          // HTML editor container
        '.d2l-widget-content',                // Widget content
        '#d2l_content',                      // Main content area
        '.d2l-page-main',                     // Main page area
        '.d2l-content',                       // General content
        // Standard selectors
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

    // Try to extract from iframe if present (for embedded documents)
    let iframeContent = '';
    try {
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
            try {
                // Only access if same-origin or if we can access it
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                if (iframeDoc) {
                    const iframeBody = iframeDoc.body;
                    if (iframeBody) {
                        const iframeText = iframeBody.innerText || iframeBody.textContent || '';
                        if (iframeText.trim().length > 100) { // Only use if substantial content
                            iframeContent += '\n\n[Embedded Document Content]\n' + iframeText.trim();
                        }
                    }
                }
            } catch (e) {
                // Cross-origin iframe, can't access - skip
                console.log('Cannot access iframe content (cross-origin):', e);
            }
        }
    } catch (e) {
        console.log('Error accessing iframes:', e);
    }

    // Try to extract from PDF.js viewer (common for PDFs)
    let pdfContent = '';
    try {
        // PDF.js viewer text layer
        const pdfTextLayer = document.querySelector('.textLayer, .pdfViewer, #viewer');
        if (pdfTextLayer) {
            const pdfText = pdfTextLayer.innerText || pdfTextLayer.textContent || '';
            if (pdfText.trim().length > 100) {
                pdfContent = '\n\n[PDF Content]\n' + pdfText.trim();
            }
        }
        
        // Try to find text spans in PDF viewer
        const pdfTextSpans = document.querySelectorAll('.textLayer span, .page .textLayer span');
        if (pdfTextSpans.length > 0) {
            let pdfText = '';
            pdfTextSpans.forEach(span => {
                pdfText += (span.textContent || '') + ' ';
            });
            if (pdfText.trim().length > 100) {
                pdfContent = '\n\n[PDF Content]\n' + pdfText.trim();
            }
        }
    } catch (e) {
        console.log('Error extracting PDF content:', e);
    }

    const contentElement = mainContent || document.body;
    let textContent = contentElement.innerText || contentElement.textContent || '';
    
    // Add iframe and PDF content if found
    if (iframeContent) {
        textContent += iframeContent;
    }
    if (pdfContent) {
        textContent += pdfContent;
    }
    
    const title = document.title || '';
    const url = window.location.href || '';

    // Extract context (breadcrumbs, sidebar, etc.) - Learning Hub specific
    const contextSelectors = [
        // Learning Hub breadcrumbs
        '.d2l-navigation-s-item',            // Navigation items
        '.d2l-breadcrumbs',                  // Breadcrumbs
        '.d2l-navigation-s-link',            // Navigation links
        '.d2l-page-header',                   // Page header
        // Standard selectors
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

    // Also get course title from Learning Hub
    try {
        const courseTitle = document.querySelector('.d2l-navigation-s-title, .d2l-page-header-title');
        if (courseTitle) {
            const courseText = courseTitle.innerText || courseTitle.textContent || '';
            if (courseText) {
                context = (context ? context + ' > ' : '') + courseText;
            }
        }
    } catch (e) {
        console.log('Error extracting course title:', e);
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
        model = "gemini-1.5-flash-latest",
        temperature = 0.3,
        maxTokens = 1200,
        preferClassifier = false,
        forceCategory,
        rubricOnly = false
    } = options;

    if (!apiKey) throw new Error("Missing Gemini API key");
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

        // Use simpler model list for classification (faster)
        const modelVariants = [
            "gemini-1.5-flash",
            "gemini-1.5-pro",
            "gemini-pro"
        ];
        
        const apiVersions = ["v1beta", "v1"];
        
        let lastError = null;
        let res = null;
        let data = null;
        
        // Try each model variant and API version (limited attempts for classification)
        for (const apiVersion of apiVersions) {
            for (const modelVariant of modelVariants) {
                try {
                    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelVariant}:generateContent?key=${apiKey}`;
                    res = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{
                                    text: `You are a strict labeler that outputs one token only.\n\n${clsPrompt}`
                                }]
                            }],
                            generationConfig: {
                                temperature: 0.0,
                                maxOutputTokens: 4
                            }
                        })
                    });
                    
                    data = await res.json();
                    
                    // If successful, break out of loops
                    if (res.ok) {
                        break;
                    } else if (res.status === 401 || res.status === 403) {
                        // Auth error - fall back to heuristic
                        console.warn(`AI classification auth error. Using heuristic classification.`);
                        return heuristicCategory(ctx, body);
                    } else if (res.status !== 404) {
                        // If it's not a 404, stop trying
                        lastError = data.error?.message || data.message || JSON.stringify(data);
                        break;
                    } else {
                        lastError = data.error?.message || data.message || `Model ${modelVariant} not found`;
                    }
                } catch (fetchError) {
                    lastError = fetchError.message;
                    continue;
                }
            }
            
            // If we got a successful response, break out of API version loop
            if (res && res.ok) {
                break;
            }
        }
        
        if (!res || !res.ok) {
            // If classification fails, fall back to heuristic
            console.warn(`AI classification failed: ${lastError || JSON.stringify(data)}. Using heuristic classification.`);
            return heuristicCategory(ctx, body);
        }
        
        const label = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim().toUpperCase();
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

    // Helper function to list available models
    async function listAvailableModels(apiKey) {
        const apiVersions = ["v1beta", "v1"];
        for (const apiVersion of apiVersions) {
            try {
                const listUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${apiKey}`;
                const listRes = await fetch(listUrl);
                if (listRes.ok) {
                    const listData = await listRes.json();
                    if (listData.models && listData.models.length > 0) {
                        // Filter models that support generateContent
                        const availableModels = listData.models
                            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
                            .map(m => m.name.replace('models/', ''));
                        console.log('Available Gemini models:', availableModels);
                        return { models: availableModels, apiVersion };
                    }
                }
            } catch (e) {
                console.log(`Failed to list models from ${apiVersion}:`, e);
            }
        }
        return null;
    }

    // Try to get available models first
    let availableModels = null;
    let workingApiVersion = null;
    try {
        const modelList = await listAvailableModels(apiKey);
        if (modelList && modelList.models.length > 0) {
            availableModels = modelList.models;
            workingApiVersion = modelList.apiVersion;
        }
    } catch (e) {
        console.warn('Could not list available models, using default list:', e);
    }

    // Use available models if we got them, otherwise use default list
    const modelVariants = availableModels || [
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-pro",
        "gemini-1.5-flash-002",
        "gemini-1.5-pro-002"
    ];
    
    const apiVersions = workingApiVersion ? [workingApiVersion] : ["v1beta", "v1"];
    
    let lastError = null;
    let res = null;
    let data = null;
    let successfulModel = null;
    let successfulApiVersion = null;
    
    // Try each model variant and API version combination
    for (const apiVersion of apiVersions) {
        for (const modelVariant of modelVariants) {
            try {
                const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelVariant}:generateContent?key=${apiKey}`;
                res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: `You are a helpful AI summarizer named Nibiru. Return only the requested sections in plain text (Markdown allowed), no extra commentary.\n\n${prompt}`
                            }]
                        }],
                        generationConfig: {
                            temperature: temperature,
                            maxOutputTokens: maxTokens
                        }
                    })
                });
                
                data = await res.json();
                
                // If successful, break out of loops
                if (res.ok) {
                    successfulModel = modelVariant;
                    successfulApiVersion = apiVersion;
                    console.log(`Successfully using model: ${modelVariant} with API version: ${apiVersion}`);
                    break;
                } else if (res.status === 401 || res.status === 403) {
                    // Authentication/permission error - don't try other models
                    lastError = data.error?.message || data.message || `Authentication error: ${res.status}`;
                    throw new Error(`Gemini API Authentication Error: ${lastError}. Please check your API key and ensure the Gemini API is enabled in Google Cloud Console.`);
                } else if (res.status === 429) {
                    // Rate limit/quota exceeded - extract retry time if available
                    const errorMsg = data.error?.message || data.message || JSON.stringify(data);
                    const retryAfterMatch = errorMsg.match(/retry in ([\d.]+)s/i) || errorMsg.match(/(\d+\.?\d*)\s*seconds?/i);
                    const retryAfter = retryAfterMatch ? Math.ceil(parseFloat(retryAfterMatch[1])) : 60;
                    lastError = errorMsg;
                    
                    // Check if it's a quota issue (limit: 0 usually means billing not enabled)
                    if (errorMsg.includes('quota') || errorMsg.includes('Quota exceeded') || errorMsg.includes('limit: 0')) {
                        const hasBillingIssue = errorMsg.includes('limit: 0');
                        const billingHelp = hasBillingIssue 
                            ? `\n\n🔑 IMPORTANT: Your quota limit is 0, which usually means billing is not enabled.\n\nEven though the free tier is free, Google requires billing to be enabled:\n1. Go to: https://console.cloud.google.com/billing\n2. Link a billing account to your project\n3. You won't be charged for free tier usage\n4. This will increase your quota limits\n\nOr wait ${retryAfter} seconds for the quota to reset.`
                            : `\n\nOptions:\n1. Wait ${retryAfter} seconds and try again (quota resets)\n2. Enable billing in Google Cloud Console for higher limits\n3. Check your usage: https://ai.dev/usage?tab=rate-limit`;
                        
                        throw new Error(`Gemini API Quota Exceeded${billingHelp}`);
                    } else {
                        // Rate limit - can retry
                        throw new Error(`Gemini API Rate Limit: ${errorMsg}\n\nPlease retry in ${retryAfter} seconds.`);
                    }
                } else if (res.status !== 404) {
                    // If it's not a 404, it's a different error, stop trying
                    lastError = data.error?.message || data.message || JSON.stringify(data);
                    break;
                } else {
                    // 404 means model not found, try next variant
                    lastError = data.error?.message || data.message || `Model ${modelVariant} not found`;
                }
            } catch (fetchError) {
                // If it's a quota or auth error, throw it immediately
                if (fetchError.message && (fetchError.message.includes('Authentication') || 
                    fetchError.message.includes('Quota') || 
                    fetchError.message.includes('Rate Limit'))) {
                    throw fetchError;
                }
                lastError = fetchError.message;
                continue;
            }
        }
        
        // If we got a successful response, break out of API version loop
        if (res && res.ok) {
            break;
        }
    }
    
    if (!res || !res.ok) {
        const errorMsg = lastError || data?.error?.message || data?.message || JSON.stringify(data);
        
        // Check for quota/rate limit errors first
        if (res?.status === 429 || (errorMsg && (errorMsg.includes('quota') || errorMsg.includes('Quota exceeded')))) {
            const retryAfterMatch = errorMsg.match(/retry in ([\d.]+)s/i);
            const retryAfter = retryAfterMatch ? Math.ceil(parseFloat(retryAfterMatch[1])) : 60;
            throw new Error(`Gemini API Quota Exceeded: ${errorMsg}\n\n⚠️ You've exceeded your free tier quota.\n\nOptions:\n1. Wait ${retryAfter} seconds and try again\n2. Enable billing in Google Cloud Console (free tier may require billing to be enabled)\n3. Check your usage: https://ai.dev/usage?tab=rate-limit\n4. Upgrade your plan if needed\n\nTo enable billing:\n- Go to: https://console.cloud.google.com/billing\n- Link a billing account (free tier is still free, but billing must be enabled)`);
        }
        
        // Check if it's an API not enabled error
        let helpText = "";
        if (res?.status === 404 || (errorMsg && errorMsg.includes("not found"))) {
            helpText = `
            
⚠️ IMPORTANT: The Gemini API may not be enabled for your project!

Please follow these steps:
1. Go to Google Cloud Console: https://console.cloud.google.com/
2. Select your project
3. Enable the Generative Language API:
   - Go to: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
   - Click "ENABLE" button
4. Wait a few minutes for the API to activate
5. Verify your API key has access to the enabled API
6. Try again

Alternatively, if you're using Google AI Studio:
- Make sure you're using the API key from: https://aistudio.google.com/app/apikey
- The API should be automatically enabled for AI Studio keys`;
        } else if (res?.status === 403) {
            helpText = `
            
⚠️ Permission Error: Your API key may not have access to Gemini API.

Please check:
1. The API key is from the correct project
2. The Generative Language API is enabled
3. The API key has the correct permissions`;
        }
        
        throw new Error(`Gemini API Error: Could not find an available model. Tried: ${modelVariants.join(", ")}. Error: ${errorMsg}${helpText}`);
    }
    
    // Extract text from Gemini response
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!responseText) {
        throw new Error(`Gemini API returned empty response. Check API key and model availability.`);
    }
    return responseText.trim();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'summarize') {
        // Use async function and handle response properly
        (async () => {
            let responseSent = false;
            
            const sendResponseSafe = (response) => {
                if (!responseSent) {
                    responseSent = true;
                    try {
                        sendResponse(response);
                    } catch (error) {
                        console.error('Error sending response:', error);
                    }
                }
            };

            try {
                // Get API key from storage
                const result = await chrome.storage.local.get(['apiKey']);
                const apiKey = result.apiKey;

                if (!apiKey) {
                    sendResponseSafe({ 
                        success: false, 
                        error: 'API key not set. Please configure your Gemini API key in the extension settings.' 
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
                        sendResponseSafe({ success: false, error: 'No active tab found' });
                        return;
                    }

                    // Extract content from the page
                    try {
                        // First, try to inject content script into main page
                        let results;
                        try {
                            results = await chrome.scripting.executeScript({
                                target: { tabId: tab.id },
                                func: extractPageContent
                            });
                        } catch (injectError) {
                            // If injection fails, try with files approach
                            console.log('Function injection failed, trying file injection:', injectError);
                            await chrome.scripting.executeScript({
                                target: { tabId: tab.id },
                                files: ['content.js']
                            });
                            
                            // Wait a bit for content script to load
                            await new Promise(resolve => setTimeout(resolve, 500));
                            
                            // Send message to content script
                            try {
                                results = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
                                if (results && results.content) {
                                    results = [{ result: results.content }];
                                }
                            } catch (msgError) {
                                console.error('Error sending message to content script:', msgError);
                                sendResponseSafe({ 
                                    success: false, 
                                    error: 'Failed to communicate with content script. Make sure you are on a valid webpage.' 
                                });
                                return;
                            }
                        }

                        if (!results || !results[0] || !results[0].result) {
                            sendResponseSafe({ 
                                success: false, 
                                error: 'Failed to extract page content. Make sure you are on a valid webpage.' 
                            });
                            return;
                        }

                        const content = results[0].result;
                        
                        // Check if we got meaningful content
                        text = content.text || content.html || '';
                        context = content.context || content.title || '';
                        
                        // If text is too short, it might not have captured the document
                        if (text.trim().length < 50) {
                            console.warn('Extracted content is very short, may not have captured document content');
                            // Still proceed, but log a warning
                        }
                    } catch (error) {
                        console.error('Content extraction error:', error);
                        sendResponseSafe({ 
                            success: false, 
                            error: `Failed to extract content: ${error.message}. Make sure you are on a page with viewable content.` 
                        });
                        return;
                    }
                }

                if (!text || !text.trim()) {
                    sendResponseSafe({ success: false, error: 'No content found on the page' });
                    return;
                }

                // Summarize the content
                const summary = await summarizeNibiruAuto(text, context, {
                    apiKey,
                    model: request.model || "gemini-1.5-flash-latest",
                    temperature: request.temperature || 0.3,
                    maxTokens: request.maxTokens || 1200
                });

                // Save summary to storage
                await chrome.storage.local.set({ summary: summary });

                sendResponseSafe({ success: true, summary: summary });
            } catch (error) {
                console.error('Summarization error:', error);
                sendResponseSafe({ 
                    success: false, 
                    error: error.message || 'Failed to generate summary' 
                });
            }
        })();

        return true; // Keep message channel open for async response
    }
    
    // Return false if we don't handle the message (but we handle 'summarize')
    return false;
});

