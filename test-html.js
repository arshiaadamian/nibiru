// Simple test to summarize test.html file
// This will test the summarizeText function with the actual HTML file

// Load environment variables from .env file if it exists
try {
  const path = require('path');
  let dotenvResult;
  
  // First try root directory
  dotenvResult = require('dotenv').config({ path: path.join(__dirname, '.env') });
  
  // If not found, try nibiru folder
  if (dotenvResult.error) {
    dotenvResult = require('dotenv').config({ path: path.join(__dirname, 'nibiru', '.env') });
  }
  
  if (dotenvResult.parsed && Object.keys(dotenvResult.parsed).length > 0) {
    console.log('✅ Loaded .env file');
  }
} catch (e) {
  console.log('ℹ️  Note: dotenv not installed or .env file not found.');
}

// Import required modules
const { summarizeText } = require('./nibiru/summarizeText.js');
const fs = require('fs');
const path = require('path');

// Test function
async function testHtmlFile() {
  console.log('='.repeat(60));
  console.log('Testing summarizeText with test.html');
  console.log('='.repeat(60));
  console.log();

  // Check if API key is available
  let apiKey = process.argv[2] || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
  
  // Detect API type
  let apiType = "auto";
  if (process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY && !process.argv[2]) {
    apiType = "gemini";
  } else if (process.argv[2] && !process.argv[2].startsWith("sk-") && process.argv[2].length > 30 && !process.env.OPENAI_API_KEY) {
    apiType = "gemini";
  }
  
  if (!apiKey) {
    console.error('❌ ERROR: API key not found.');
    console.log('Please set OPENAI_API_KEY or GEMINI_API_KEY in .env file or pass as argument.');
    return;
  }

  console.log('✅ API Key found');
  if (apiType === "gemini") {
    console.log('✅ Using Gemini API');
  } else {
    console.log('✅ Using OpenAI API');
  }
  console.log();

  try {
    // Read the HTML file
    const htmlFilePath = path.join(__dirname, 'nibiru', 'test.html');
    console.log(`Reading file: ${htmlFilePath}`);
    
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
    console.log(`✅ Successfully read test.html (${htmlContent.length} characters)`);
    console.log();
    
    // Test with assignment context
    console.log('Summarizing as "assignment"...');
    console.log('This may take a few moments...');
    console.log();
    
    const summary = await summarizeText(
      htmlContent,
      'assignment',
      {
        apiKey: apiKey,
        apiType: apiType,
      }
    );

    console.log('='.repeat(60));
    console.log('✅ SUMMARY GENERATED:');
    console.log('='.repeat(60));
    console.log();
    console.log(summary);
    console.log();
    console.log('='.repeat(60));
    
    // Save output to file
    const outputPath = path.join(__dirname, 'nibiru', 'test-summary-output.txt');
    try {
      fs.writeFileSync(outputPath, summary, 'utf8');
      console.log(`✅ Summary saved to: ${outputPath}`);
    } catch (writeError) {
      console.error(`⚠️  Could not save to file: ${writeError.message}`);
    }
    
    console.log('✅ Test completed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error during testing:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  }
}

// Run the test
testHtmlFile().catch(console.error);

