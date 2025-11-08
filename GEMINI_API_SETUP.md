# Gemini API Setup Guide

## The Problem
If you're getting 404 errors for all Gemini models, it means the **Generative Language API is not enabled** for your Google Cloud project.

## Solution: Enable the Gemini API

### Option 1: Enable via Google Cloud Console (Recommended)

1. **Go to Google Cloud Console**:
   - Visit: https://console.cloud.google.com/
   - Make sure you're signed in with the same Google account that created the API key

2. **Select Your Project**:
   - Click the project dropdown at the top
   - Select your project (Project number: 874248803413 or name "Nibiru")

3. **Enable the Generative Language API**:
   - Go directly to: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
   - Or navigate: APIs & Services → Library → Search "Generative Language API"
   - Click the **"ENABLE"** button
   - Wait for the API to be enabled (usually takes 1-2 minutes)

4. **Verify API is Enabled**:
   - Go to: https://console.cloud.google.com/apis/dashboard
   - You should see "Generative Language API" in the list of enabled APIs

5. **Test Your Extension**:
   - Reload the extension in Chrome
   - Try generating a summary again
   - It should now work!

### Option 2: Use Google AI Studio API Key

If you prefer not to use Google Cloud Console, you can get an API key from Google AI Studio:

1. **Go to Google AI Studio**:
   - Visit: https://aistudio.google.com/app/apikey
   - Sign in with your Google account

2. **Create API Key**:
   - Click "Create API Key"
   - Select your project or create a new one
   - Copy the API key

3. **Use in Extension**:
   - The API is automatically enabled for AI Studio keys
   - Paste the key in the extension settings
   - It should work immediately

## Troubleshooting

### Still Getting 404 Errors?

1. **Check API Status**:
   - Make sure the API is actually enabled
   - Go to: https://console.cloud.google.com/apis/dashboard
   - Look for "Generative Language API" in the enabled APIs list

2. **Check API Key**:
   - Verify the API key is correct
   - Make sure it's from the same project
   - Try creating a new API key

3. **Wait a Few Minutes**:
   - Sometimes it takes a few minutes for the API to be fully activated
   - Try again after 2-3 minutes

4. **Check Billing**:
   - Make sure billing is enabled (free tier is available)
   - Go to: https://console.cloud.google.com/billing
   - Some APIs require billing to be enabled, even for free tier

5. **Check API Quotas**:
   - Make sure you haven't exceeded API quotas
   - Go to: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas

### Common Error Messages

- **404 "Model not found"**: API not enabled → Enable the Generative Language API
- **403 "Permission denied"**: API key doesn't have access → Check API key permissions
- **401 "Unauthorized"**: Invalid API key → Check API key is correct
- **429 "Quota exceeded"**: Too many requests → Wait or check quotas

## Quick Test

After enabling the API, you can test it directly:

```bash
# Test with curl (replace YOUR_API_KEY with your actual key)
curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_API_KEY"
```

This should return a list of available models. If you get a 404, the API is not enabled.

## Need Help?

- Google Cloud Console: https://console.cloud.google.com/
- Gemini API Documentation: https://ai.google.dev/gemini-api/docs
- Google AI Studio: https://aistudio.google.com/

