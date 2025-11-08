# Testing Guide for Nibiru Extension

## Prerequisites

1. **Gemini API Key**: You need a valid Google Gemini API key
   - Get one from: https://aistudio.google.com/app/apikey
   - Make sure you have access to Gemini API (free tier available)

2. **Chrome Browser**: The extension works on Chrome/Edge (Chromium-based browsers)

## Installation

1. **Load the Extension**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `nibiru` folder
   - The extension should now appear in your extensions list

2. **Set API Key**:
   - Click the extension icon in the toolbar
   - Click the settings icon (gear) in the top right
   - Enter your Gemini API key (get from Google AI Studio)
   - Click "Save API Key"
   - You should see "API key saved!" toast notification
   - Note: You can get your API key from: https://aistudio.google.com/app/apikey

## Testing Scenarios

### Test 1: Basic Web Page (Easy Test)

1. **Navigate to a webpage with text content**:
   - Go to any news article or blog post
   - Example: https://www.example.com/article

2. **Test the Extension**:
   - Click the extension icon
   - Check status: Should show "Ready to Summarize" (green) if API key is set
   - Click "Generate Summary"
   - Wait for the rocket animation to complete
   - You should see a formatted summary appear

### Test 2: BCIT Learning Hub - Content Page

1. **Navigate to Learning Hub**:
   - Log into BCIT Learning Hub: https://learn.bcit.ca
   - Go to a course
   - Navigate to a content page (Table of Contents or course material)

2. **Test the Extension**:
   - Click the extension icon
   - Status should show "Ready to Summarize"
   - Click "Generate Summary"
   - Should extract and summarize the course content

### Test 3: BCIT Learning Hub - Document Viewer

1. **Open a Document**:
   - In Learning Hub, click on a PDF or document link
   - Wait for the document to load in the viewer
   - The URL should be something like: `learn.bcit.ca/d2l/le/content/.../View`

2. **Test the Extension**:
   - Click the extension icon
   - Status should show "Ready to Summarize"
   - Click "Generate Summary"
   - Should extract text from the embedded document and summarize it

### Test 4: Error Handling

1. **Test Without API Key**:
   - Remove API key from settings (or don't set one)
   - Status should show "API Key Not Set" (red)
   - "Generate Summary" button should be hidden

2. **Test on Invalid Page**:
   - Go to `chrome://extensions/`
   - Click extension icon
   - Status should show "Invalid Page" (red)
   - "Generate Summary" button should be hidden

3. **Test on Empty Page**:
   - Go to a blank page or page with no content
   - Status might show "No Content Detected"
   - Extension will still attempt summarization if URL is valid

## Debugging

### Check Extension Console

1. **Open Extension Popup DevTools**:
   - Right-click on the extension icon
   - Select "Inspect popup" (if available)
   - Or: Go to `chrome://extensions/`, find Nibiru, click "service worker" to see background logs

2. **Check Browser Console**:
   - Open any webpage
   - Press F12 to open DevTools
   - Go to Console tab
   - Look for any error messages

### Common Issues

1. **"API key not set" error**:
   - Make sure you've saved the API key in settings
   - Verify the key is valid in Google AI Studio
   - Make sure you have API access enabled

2. **"Failed to extract content" error**:
   - The page might be restricted (cross-origin)
   - Try a different page
   - Check browser console for specific errors

3. **"No content found" error**:
   - The page might not have extractable text
   - Try a page with more text content
   - For PDFs, make sure they're rendered in the browser (not downloaded)

4. **Extension not loading**:
   - Check `chrome://extensions/` for errors
   - Make sure all files are in the correct location
   - Reload the extension

### Verify Content Extraction

1. **Check what content is being extracted**:
   - Open browser console (F12)
   - Look for console.log messages from content script
   - These will show what content was found

2. **Test content extraction manually**:
   - Open a webpage
   - Open console (F12)
   - The extension logs extraction attempts

## Expected Behavior

### Status Indicator

- **Green "Ready to Summarize"**: 
  - API key is set
  - Valid webpage is open
  - Extension can access page content
  - "Generate Summary" button is visible

- **Red "Not Ready"** (with specific reason):
  - "API Key Not Set": No API key configured
  - "No Active Tab": No tab is open
  - "Invalid Page": On chrome:// or extension page
  - "No Content Detected": Page has no extractable content
  - "Error Checking Page": Error occurred during status check

### Summary Generation

1. **Loading Animation**:
   - Rocket flies across planets
   - Progress percentage updates
   - "Generating summary..." text pulses

2. **Completion**:
   - Rocket completes animation
   - Summary appears in formatted text
   - Toast notification: "Summary generated!"

3. **Error Handling**:
   - Error message displayed in summary area
   - Button re-enables after error
   - Toast notification: "Failed to generate summary"

## Testing Checklist

- [ ] Extension loads without errors
- [ ] API key can be set and saved
- [ ] Status shows "Ready" on valid web pages
- [ ] Status shows "Not Ready" on invalid pages
- [ ] Summary generates successfully on test page
- [ ] Summary generates on Learning Hub content page
- [ ] Summary generates on Learning Hub document viewer
- [ ] Error messages display correctly
- [ ] Button disables during summarization (no spam)
- [ ] Theme toggle works
- [ ] Copy button works
- [ ] Summary is formatted correctly (markdown rendered)

## Next Steps

If everything works:
- Test with various BCIT Learning Hub pages
- Test with different document types (PDFs, PowerPoints, etc.)
- Verify summaries are accurate and useful
- Check that context (course name, breadcrumbs) is captured

If issues occur:
- Check browser console for errors
- Verify API key is valid and has API access enabled
- Test on different pages to isolate the issue
- Check that all files are in the correct locations

