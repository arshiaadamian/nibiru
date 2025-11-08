// =============================
// Nibiru: Lecture Summarization Function
// =============================
//
// summarizeLecture(text, context, options)
// - text: the HTML/plain text content from the lecture (PDF viewer HTML or extracted text)
// - context: header/path/directory info (e.g., "https://learn.bcit.ca/d2l/le/content/...")
// - options:
//     apiKey         : OpenAI key (required)
//     model          : default "gpt-4o-mini"
//     temperature    : default 0.3
//     maxTokens      : default 4000 (lectures are longer, need more tokens)
//
// Returns: JSON object with unit_title and slides array
//
// Dependencies: native fetch (Node 18+ or browser). DO NOT hardcode your API key in extension code.

async function summarizeLecture(
  text,
  context,
  {
    apiKey = process.env.OPENAI_API_KEY,
    model = "gpt-4o-mini",
    temperature = 0.3,
    maxTokens = 4000
  } = {}
) {
  if (!apiKey) throw new Error("Missing OpenAI API key");
  if (!text || !text.trim()) throw new Error("Empty source text");

  // Helper function to parse JSON response with fallbacks
  function parseJsonResponse(responseText) {
    try {
      // Try direct JSON parse first
      const jsonResult = JSON.parse(responseText);
      
      // Validate structure
      if (!jsonResult.unit_title || !Array.isArray(jsonResult.slides)) {
        throw new Error("Invalid JSON structure: missing unit_title or slides array");
      }

      // Ensure all slides have required fields
      jsonResult.slides = jsonResult.slides.map((slide, index) => {
        if (!slide.slide_id) {
          slide.slide_id = String(index + 1);
        }
        if (!slide.title) {
          slide.title = `Slide ${slide.slide_id}`;
        }
        return slide;
      });

      return jsonResult;
    } catch (parseError) {
      // If direct parse failed, try to extract JSON from markdown code blocks or plain text
      console.warn("Failed to parse JSON directly, attempting extraction:", parseError);
      
      // Remove markdown code blocks if present
      let cleanedText = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      
      // Try to find JSON object in the response
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const jsonResult = JSON.parse(jsonMatch[0]);
          
          // Validate structure
          if (!jsonResult.unit_title || !Array.isArray(jsonResult.slides)) {
            throw new Error("Invalid JSON structure: missing unit_title or slides array");
          }
          
          // Ensure all slides have required fields
          jsonResult.slides = jsonResult.slides.map((slide, index) => {
            if (!slide.slide_id) {
              slide.slide_id = String(index + 1);
            }
            if (!slide.title) {
              slide.title = `Slide ${slide.slide_id}`;
            }
            return slide;
          });
          
          return jsonResult;
        } catch (extractError) {
          throw new Error(`Failed to parse extracted JSON: ${extractError.message}\nResponse preview: ${responseText.substring(0, 500)}`);
        }
      }
      
      throw new Error(`Failed to parse JSON response: ${parseError.message}\nResponse preview: ${responseText.substring(0, 500)}`);
    }
  }

  const prompt = `
You are Nibiru, the messenger AI that brings summarized knowledge from BCIT Learning Hub lectures.

Your task: Analyze the lecture content and extract structured information into a JSON format.

CONTEXT INFORMATION:
${context}

LECTURE CONTENT (may contain HTML from PDF viewer):
<<<BEGIN_LECTURE_CONTENT>>>\n${text}\n<<<END_LECTURE_CONTENT>>>

INSTRUCTIONS:
1. Extract the main unit/topic title from the content
2. Identify distinct slides/sections in the lecture
3. For each slide, extract:
   - Slide title (if present) or infer from content
   - Overview: 1-2 sentences summarizing the slide
   - Key concepts: important points covered
   - Definitions: terms and their definitions (if any)
   - Steps/Processes: step-by-step procedures or algorithms (if any)
   - Examples: worked examples with problem, method, and result (if any)
   - Reminders: important warnings or pitfalls (if any)
   - Checklist: "I can..." statements indicating learning objectives (if any)
   - MCQs: multiple choice questions (if any)

4. Structure the content as follows:
   - Break the lecture into logical slides/sections based on topic changes
   - If the content doesn't have clear slide breaks, create logical sections
   - Slide IDs should be sequential strings: "1", "2", "3", etc.
   - Only include fields that have actual content (don't create empty arrays/objects)
   - For definitions, use objects with "term" and "def" keys
   - For examples, use objects with "problem", "method", and "result" keys
   - For MCQs, include stem, options (array of strings like "A) ...", "B) ..."), and answer with "letter" and "rationale"

OUTPUT FORMAT (return ONLY valid JSON, no markdown formatting, no code blocks):
{
  "unit_title": "string",
  "slides": [
    {
      "slide_id": "1",
      "title": "string",
      "overview": ["sentence 1", "sentence 2"],
      "key_concepts": ["concept 1", "concept 2"],
      "definitions": [{"term": "term1", "def": "definition1"}],
      "steps": ["Step 1: ...", "Step 2: ..."],
      "example": {"problem": "...", "method": "...", "result": "..."},
      "reminders": ["reminder 1", "reminder 2"],
      "checklist": ["I can ...", "I can ..."],
      "mcqs": [
        {
          "stem": "Question text?",
          "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
          "answer": {"letter": "C", "rationale": "Explanation of why C is correct"}
        }
      ]
    }
  ]
}

IMPORTANT RULES:
- Return ONLY the JSON object, no markdown code blocks, no explanations
- If a field has no content, omit it (don't include empty arrays or empty objects)
- Extract actual content from the lecture - do not invent or fabricate information
- If you cannot identify clear slides, create 1-3 logical sections based on major topics
- Make sure all strings are properly escaped for JSON
- The JSON must be valid and parseable

Now analyze the lecture and return the JSON structure:
  `.trim();

  try {
    // Build request body - try with JSON mode first (supported by gpt-4o, gpt-4o-mini, gpt-4-turbo, etc.)
    const requestBody = {
      model,
      messages: [
        {
          role: "system",
          content: "You are Nibiru, a helpful AI summarizer for BCIT lectures. You extract structured information and return ONLY valid JSON with no markdown formatting or explanations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature,
      max_tokens: maxTokens
    };

    // Add JSON mode if supported by the model (gpt-4o, gpt-4o-mini, gpt-4-turbo-preview, etc.)
    // This ensures structured JSON output
    const modelsWithJsonMode = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4-turbo-preview", "gpt-3.5-turbo"];
    if (modelsWithJsonMode.some(m => model.includes(m))) {
      requestBody.response_format = { type: "json_object" };
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const data = await res.json();

    if (!res.ok) {
      // If JSON mode caused an error, try again without it
      if (data.error && data.error.message && data.error.message.includes("json_object")) {
        console.warn("JSON mode not supported, retrying without it...");
        delete requestBody.response_format;
        
        const retryRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestBody)
        });
        
        const retryData = await retryRes.json();
        if (!retryRes.ok) {
          throw new Error(`OpenAI API Error: ${retryRes.status} ${retryRes.statusText}\n${JSON.stringify(retryData)}`);
        }
        
        // Parse retry response
        const retryResponseText = (retryData.choices?.[0]?.message?.content || "").trim();
        return parseJsonResponse(retryResponseText);
      }
      
      throw new Error(`OpenAI API Error: ${res.status} ${res.statusText}\n${JSON.stringify(data)}`);
    }

    const responseText = (data.choices?.[0]?.message?.content || "").trim();
    return parseJsonResponse(responseText);
    
  } catch (error) {
    console.error("Error in summarizeLecture:", error);
    throw error;
  }
}

// =============================
// Example Usage
// =============================
/*
(async () => {
  const context = `
https://learn.bcit.ca/d2l/le/content/1155226/viewContent/11820526/View + Side Panel

Expand side panel
Table of Contents
Assignments
Comp1510 Assignment 2
Comp1510 Assignment 2
PDF document
Activity Details
You have viewed this topic
  `;

  const html = `
    <body>
      <h1>COMP 1510 - Lecture 5: Arrays and Loops</h1>
      <div>
        <h2>Section 1: Introduction to Arrays</h2>
        <p>Arrays are collections of elements of the same type.</p>
        <p>Key concepts: indexing, size, elements</p>
        <p>Definition: Array - a contiguous block of memory storing multiple values</p>
      </div>
      <div>
        <h2>Section 2: Looping Through Arrays</h2>
        <p>Steps to iterate:</p>
        <ol>
          <li>Initialize loop variable</li>
          <li>Check condition</li>
          <li>Access array element</li>
          <li>Increment loop variable</li>
        </ol>
      </div>
    </body>
  `;

  try {
    const result = await summarizeLecture(html, context, {
      apiKey: "YOUR_OPENAI_KEY"
    });

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
})();
*/

// Export for use in other modules (if using ES modules)
// export { summarizeLecture };

// For Node.js CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { summarizeLecture };
}

