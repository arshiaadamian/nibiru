// Test file for summarizeText function
// This will test the summarizeText function with sample assignment and general content

// Load environment variables from .env file if it exists
// Try loading from both root directory and nibiru folder
try {
  const path = require('path');
  let dotenvResult;
  
  // First try root directory
  dotenvResult = require('dotenv').config({ path: path.join(__dirname, '.env') });
  
  // If not found, try nibiru folder
  if (dotenvResult.error) {
    dotenvResult = require('dotenv').config({ path: path.join(__dirname, 'nibiru', '.env') });
  }
  
  if (dotenvResult.error) {
    console.log('⚠️  .env file not found in root or nibiru folder:', dotenvResult.error.message);
  } else if (dotenvResult.parsed) {
    const envKeys = Object.keys(dotenvResult.parsed);
    if (envKeys.length === 0) {
      console.log('⚠️  .env file found but appears to be empty');
    } else {
      console.log('✅ Loaded .env file with', envKeys.length, 'variable(s):', envKeys.join(', '));
      // Check if OPENAI_API_KEY is present
      if (!dotenvResult.parsed.OPENAI_API_KEY) {
        console.log('⚠️  WARNING: OPENAI_API_KEY not found in .env file');
        console.log('   Available keys:', envKeys.join(', '));
      } else {
        console.log('✅ OPENAI_API_KEY found in .env file');
      }
    }
  } else {
    console.log('ℹ️  No .env file found in root or nibiru folder');
  }
} catch (e) {
  console.log('ℹ️  Note: dotenv not installed or error:', e.message);
  console.log('   You can still set OPENAI_API_KEY as an environment variable or pass it directly.');
}

// Import required modules
const { summarizeText } = require('./nibiru/summarizeText.js');
const fs = require('fs');
const path = require('path');

// Sample assignment text (HTML content)
const assignmentText = `
  <h1>COMP 1510 – Assignment 2: Arrays & Methods</h1>
  <p><strong>Due Date:</strong> October 28, 2024 at 11:59 PM</p>
  <p><strong>Course:</strong> COMP 1510 - Programming Methods</p>
  <p><strong>Instructor:</strong> Dr. Jane Smith</p>
  
  <h2>Overview</h2>
  <p>This assignment focuses on implementing array utilities and methods in Java. You will create a library of array manipulation functions and write comprehensive unit tests.</p>
  
  <h2>Requirements</h2>
  <ul>
    <li>Implement the following methods in the ArrayUtils class:
      <ul>
        <li>reverseArray(int[] arr) - Reverses an array in place</li>
        <li>findMax(int[] arr) - Returns the maximum value</li>
        <li>findMin(int[] arr) - Returns the minimum value</li>
        <li>calculateAverage(int[] arr) - Calculates the average of array elements</li>
      </ul>
    </li>
    <li>Write unit tests for all methods using JUnit</li>
    <li>Follow BCIT coding conventions</li>
    <li>Include JavaDoc comments for all methods</li>
    <li>Submit a .zip file containing src/ directory and README.md</li>
  </ul>
  
  <h2>Submission Instructions</h2>
  <ol>
    <li>Create a folder named "A2_YourLastName_YourStudentID"</li>
    <li>Place your source code in the src/ directory</li>
    <li>Include a README.md with your name, student ID, and any special instructions</li>
    <li>Compress the folder to a .zip file</li>
    <li>Upload to the Learning Hub by the due date</li>
  </ol>
  
  <h2>Rubric</h2>
  <ul>
    <li>Functionality: 40% - All methods work correctly</li>
    <li>Documentation: 20% - JavaDoc comments are complete</li>
    <li>Code Quality: 20% - Follows coding conventions</li>
    <li>Testing: 20% - Unit tests cover all methods and edge cases</li>
  </ul>
  
  <h2>Late Penalty</h2>
  <p>Late submissions will be penalized by 10% per day, up to a maximum of 3 days. After 3 days, no submissions will be accepted.</p>
  
  <h2>Resources</h2>
  <ul>
    <li>Textbook: Chapter 7 - Arrays</li>
    <li>Lab 4 materials</li>
    <li>BCIT Java Coding Standards</li>
  </ul>
`;

// Sample general content (lecture/document)
const generalText = `
  <h1>Lecture 9: Linked Lists</h1>
  <p><strong>Date:</strong> October 15, 2024</p>
  <p><strong>Instructor:</strong> Dr. John Doe</p>
  <p><strong>Course:</strong> COMP 1510 - Programming Methods</p>
  
  <h2>Topics Covered</h2>
  <ul>
    <li>Introduction to linked lists</li>
    <li>Node structure and implementation</li>
    <li>Insertion and deletion operations</li>
    <li>Comparison with arrays</li>
    <li>Use cases and applications</li>
  </ul>
  
  <h2>Key Concepts</h2>
  <p>A linked list is a linear data structure where elements are stored in nodes. Each node contains data and a reference to the next node in the sequence. Unlike arrays, linked lists don't require contiguous memory allocation.</p>
  
  <h2>Advantages of Linked Lists</h2>
  <ul>
    <li>Dynamic size - can grow and shrink during runtime</li>
    <li>Efficient insertion and deletion - O(1) at the beginning</li>
    <li>No memory waste - only allocates what is needed</li>
  </ul>
  
  <h2>Disadvantages</h2>
  <ul>
    <li>No random access - must traverse from the head</li>
    <li>Extra memory for pointers</li>
    <li>Cache performance is poorer than arrays</li>
  </ul>
  
  <h2>Resources</h2>
  <ul>
    <li>Textbook: Chapter 10 - Linked Data Structures</li>
    <li>Online resources: Linked list visualization tools</li>
    <li>Practice exercises on Learning Hub</li>
  </ul>
  
  <h2>Next Steps</h2>
  <p>Complete the lab exercises on linked list implementation. The lab is due next week and will help prepare you for the upcoming midterm exam.</p>
`;

// Test function
async function runTests() {
  console.log('='.repeat(60));
  console.log('Testing summarizeText Function');
  console.log('='.repeat(60));
  console.log();

  // Check if API key is available
  // Priority: 1) Command line argument, 2) Environment variable (OPENAI_API_KEY or GEMINI_API_KEY), 3) .env file
  let apiKey = process.argv[2] || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
  
  // Detect API type
  let apiType = "auto";
  // If GEMINI_API_KEY is set and OPENAI_API_KEY is not, use Gemini
  if (process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY && !process.argv[2]) {
    apiType = "gemini";
  } 
  // If command line arg is provided and doesn't look like OpenAI key, might be Gemini
  else if (process.argv[2] && !process.argv[2].startsWith("sk-") && process.argv[2].length > 30 && !process.env.OPENAI_API_KEY) {
    apiType = "gemini";
  }
  // Otherwise, default to auto (will detect based on key format)
  
  // OPTION: Uncomment and set your API key directly here for testing (not recommended for production)
  // apiKey = 'your-api-key-here';
  // apiType = 'gemini'; // or 'openai'
  
  if (!apiKey) {
    console.error('❌ ERROR: API key not found.');
    console.log();
    console.log('To fix this, choose one of the following options:');
    console.log();
    console.log('1. Create a .env file in nibiru/ folder with:');
    console.log('   OPENAI_API_KEY=your-api-key-here');
    console.log('   OR');
    console.log('   GEMINI_API_KEY=your-api-key-here');
    console.log();
    console.log('2. Set environment variable (Windows PowerShell):');
    console.log('   $env:OPENAI_API_KEY="your-api-key-here"');
    console.log('   OR');
    console.log('   $env:GEMINI_API_KEY="your-api-key-here"');
    console.log('   node test-summarize.js');
    console.log();
    console.log('3. Pass API key as command line argument:');
    console.log('   node test-summarize.js "your-api-key-here"');
    console.log();
    console.log('4. Edit test-summarize.js and uncomment the apiKey line');
    console.log();
    console.log('Skipping tests...');
    return;
  }

  console.log('✅ API Key found');
  if (apiType === "gemini") {
    console.log('✅ Using Gemini API (auto-detected)');
  } else {
    console.log('✅ Using OpenAI API (auto-detected)');
  }
  console.log();

  try {
    // Test 1: Read and summarize test.html file
    console.log('Test 1: Summarizing test.html File');
    console.log('-'.repeat(60));
    console.log('Reading test.html file...');
    
    const htmlFilePath = path.join(__dirname, 'nibiru', 'test.html');
    let htmlContent;
    
    try {
      htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
      console.log(`✅ Successfully read test.html (${htmlContent.length} characters)`);
    } catch (fileError) {
      console.error(`❌ Error reading test.html: ${fileError.message}`);
      console.log('Falling back to sample assignment text...');
      htmlContent = assignmentText;
    }
    
    console.log('Calling summarizeText with context: "assignment"');
    console.log('This may take a few moments...');
    console.log();

    const assignmentSummary = await summarizeText(
      htmlContent,
      'assignment',
      {
        apiKey: apiKey,
        apiType: apiType,
        // model will be auto-selected based on API type
      }
    );

    console.log('✅ Assignment Summary Generated:');
    console.log('='.repeat(60));
    console.log(assignmentSummary);
    console.log('='.repeat(60));
    console.log();

    // Test 2: General content summary
    console.log('Test 2: Summarizing General Content');
    console.log('-'.repeat(60));
    console.log('Calling summarizeText with context: "general"');
    console.log('This may take a few moments...');
    console.log();

    const generalSummary = await summarizeText(
      generalText,
      'general',
      {
        apiKey: apiKey,
        apiType: apiType,
      }
    );

    console.log('✅ General Summary Generated:');
    console.log('='.repeat(60));
    console.log(generalSummary);
    console.log('='.repeat(60));
    console.log();

    // Test 3: Rubric extraction
    console.log('Test 3: Extracting Rubric');
    console.log('-'.repeat(60));
    console.log('Calling summarizeText with context: "rubric"');
    console.log('This may take a few moments...');
    console.log();

    const rubricSummary = await summarizeText(
      assignmentText,
      'rubric',
      {
        apiKey: apiKey,
        apiType: apiType,
      }
    );

    console.log('✅ Rubric Summary Generated:');
    console.log('='.repeat(60));
    console.log(rubricSummary);
    console.log('='.repeat(60));
    console.log();

    console.log('='.repeat(60));
    console.log('✅ All tests completed successfully!');
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

// Run the tests
runTests().catch(console.error);

