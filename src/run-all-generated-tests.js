// src/run-all-generated-tests.js
// Modified to run tests one by one with individual browser sessions
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// ES Module equivalent for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants for test statuses
const TestStatus = {
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED'
};

// Function to find all test files directly inside AI-generated subfolders
function findAllAiGeneratedTests() {
  const aiGeneratedDir = path.join(__dirname, '../AI-generated');
  
  if (!fs.existsSync(aiGeneratedDir)) {
    console.error(`❌ AI-generated directory not found: ${aiGeneratedDir}`);
    return [];
  }
  
  const testFiles = [];
  
  // Get all directories inside AI-generated
  const directories = fs.readdirSync(aiGeneratedDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  console.log(`Found ${directories.length} directories in AI-generated: ${directories.join(', ')}`);
  
  // For each directory, find the TS files with matching names
  for (const dir of directories) {
    const dirPath = path.join(aiGeneratedDir, dir);
    const tsFilePath = path.join(dirPath, `${dir}.ts`);
    
    if (fs.existsSync(tsFilePath)) {
      // Find corresponding feature file if it exists (optional)
      const featuresDir = path.join(__dirname, '../src/features');
      const featureFilePath = path.join(featuresDir, `${dir}.feature`);
      
      testFiles.push({
        name: dir,
        tsPath: tsFilePath,
        featurePath: fs.existsSync(featureFilePath) ? featureFilePath : null
      });
      
      console.log(`✅ Found test file: ${tsFilePath}`);
    } else {
      // Check if any TS file exists in the directory
      const tsFiles = fs.readdirSync(dirPath).filter(f => f.endsWith('.ts'));
      
      if (tsFiles.length > 0) {
        const firstTsFile = path.join(dirPath, tsFiles[0]);
        testFiles.push({
          name: dir,
          tsPath: firstTsFile,
          featurePath: null
        });
        console.log(`⚠️ Using alternative TS file for ${dir}: ${firstTsFile}`);
      } else {
        console.log(`❌ No TS files found in directory: ${dirPath}`);
      }
    }
  }
  
  return testFiles;
}

// Run a single test with its own browser instance
function runSingleTest(test, index, total) {
  console.log(`\n[${index+1}/${total}] Running test: ${test.name}...`);
  
  const startTime = Date.now();
  const reportJsonPath = `reports/json/${test.name}-report.json`;
  
  try {
    // Set required environment variables
    process.env.HEADLESS = process.env.HEADLESS || 'false'; // Default to visible browser
    process.env.BASE_URL = process.env.BASE_URL || 'https://example.com'; // Set a default BASE_URL
    process.env.REUSE_BROWSER = 'false'; // Don't reuse browser
    process.env.CURRENT_TEST_NAME = test.name; // Pass test name to hooks
    
    console.log(`Using BASE_URL: ${process.env.BASE_URL}`);
    console.log(`Browser: ${process.env.HEADLESS === 'true' ? 'Headless' : 'Visible'} mode`);
    
    // Build the cucumber command
    let command = 'npx cucumber-js --require-module tsx/esm';
    
    // Add require paths
    command += ` --require src/support/world.ts --require src/support/hooks.ts --require ${test.tsPath}`;
    
    // Add feature path if available
    if (test.featurePath) {
      command += ` ${test.featurePath}`;
    }
    
    // Add formatters
    command += ` --format progress --format json:${reportJsonPath}`;
    
    console.log(`Executing: ${command}`);
    
    // Run the command
    execSync(command, { stdio: 'inherit', env: process.env });
    
    console.log(`✅ Test completed: ${test.name}`);
    
    // Parse the report JSON if available
    let result = {
      testName: test.name,
      status: TestStatus.PASSED,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      error: null,
      screenshots: [],
      steps: []
    };
    
    if (fs.existsSync(reportJsonPath)) {
      try {
        const reportJson = JSON.parse(fs.readFileSync(reportJsonPath, 'utf8'));
        
        if (Array.isArray(reportJson) && reportJson.length > 0) {
          let hasFailedSteps = false;
          
          for (const feature of reportJson) {
            if (feature.elements && feature.elements.length > 0) {
              for (const element of feature.elements) {
                if (element.steps) {
                  for (const step of element.steps) {
                    const stepStatus = (step.result && step.result.status === 'passed') ? 
                      TestStatus.PASSED : TestStatus.FAILED;
                    
                    result.steps.push({
                      stepName: step.name || step.keyword,
                      status: stepStatus,
                      duration: step.result ? (step.result.duration || 0) : 0,
                      error: step.result ? step.result.error_message : null
                    });
                    
                    if (stepStatus === TestStatus.FAILED) {
                      hasFailedSteps = true;
                    }
                  }
                }
              }
            }
          }
          
          if (hasFailedSteps) {
            result.status = TestStatus.FAILED;
          }
        }
      } catch (e) {
        console.error(`Error parsing test report: ${e.message}`);
      }
    }
    
    // Find screenshots related to this test
    const screenshotsDir = 'reports/screenshots';
    if (fs.existsSync(screenshotsDir)) {
      const screenshots = fs.readdirSync(screenshotsDir)
        .filter(file => file.toLowerCase().includes(test.name.toLowerCase()))
        .map(file => path.join('screenshots', file));
      
      result.screenshots = screenshots;
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Test failed: ${test.name}`);
    console.error(error.message);
    
    return {
      testName: test.name,
      status: TestStatus.FAILED,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      error: error.message,
      screenshots: [],
      steps: []
    };
  }
}

// Update the HTML report generation to display time in seconds
function generateHtmlReport(testResults) {
  console.log('\n📊 Generating HTML report...');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const htmlPath = `reports/html/test-report-${timestamp}.html`;
  
  // Convert milliseconds to seconds for all results
  testResults = testResults.map(result => {
    // Convert overall test duration to seconds
    const durationInSeconds = (result.duration / 1000).toFixed(2);
    
    // Convert step durations to seconds
    if (result.steps && result.steps.length > 0) {
      result.steps = result.steps.map(step => ({
        ...step,
        durationInSeconds: (step.duration / 1000).toFixed(2)
      }));
    }
    
    return {
      ...result,
      durationInSeconds
    };
  });
  
  const summary = {
    total: testResults.length,
    passed: testResults.filter(r => r.status === TestStatus.PASSED).length,
    failed: testResults.filter(r => r.status === TestStatus.FAILED).length,
    skipped: testResults.filter(r => r.status === TestStatus.SKIPPED).length
  };
  
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Playwright Agent Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: flex; justify-content: space-around; margin: 20px 0; }
        .summary-card { padding: 20px; border-radius: 8px; text-align: center; min-width: 120px; }
        .passed { background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
        .failed { background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
        .skipped { background-color: #fff3cd; border: 1px solid #ffeaa7; color: #856404; }
        .total { background-color: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; }
        .test-result { margin: 20px 0; padding: 15px; border-radius: 8px; border: 1px solid #ddd; }
        .test-passed { border-left: 5px solid #28a745; }
        .test-failed { border-left: 5px solid #dc3545; }
        .test-skipped { border-left: 5px solid #ffc107; }
        .step { margin: 10px 0; padding: 10px; background-color: #f8f9fa; border-radius: 4px; }
        .step-passed { border-left: 3px solid #28a745; }
        .step-failed { border-left: 3px solid #dc3545; }
        .screenshot { max-width: 300px; margin: 10px 0; cursor: pointer; border: 1px solid #ddd; border-radius: 4px; transition: transform 0.3s; }
        .screenshot:hover { transform: scale(1.05); }
        .screenshots-container { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 15px; }
        .error { background-color: #f8d7da; padding: 10px; border-radius: 4px; margin: 10px 0; color: #721c24; }
        .timestamp { color: #6c757d; font-size: 0.9em; }
        .duration { color: #007bff; font-weight: bold; }
        .toggle-button { background: #f8f9fa; border: 1px solid #ddd; padding: 5px 10px; cursor: pointer; margin-bottom: 10px; border-radius: 4px; }
        .toggle-button:hover { background: #e9ecef; }
        .steps-container { border: 1px solid #eee; padding: 10px; border-radius: 4px; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Playwright Agent Test Report</h1>
            <p class="timestamp">Generated: ${new Date().toLocaleString()}</p>
        </div>

        <div class="summary">
            <div class="summary-card total">
                <h3>${summary.total}</h3>
                <p>Total Tests</p>
            </div>
            <div class="summary-card passed">
                <h3>${summary.passed}</h3>
                <p>Passed</p>
            </div>
            <div class="summary-card failed">
                <h3>${summary.failed}</h3>
                <p>Failed</p>
            </div>
            <div class="summary-card skipped">
                <h3>${summary.skipped}</h3>
                <p>Skipped</p>
            </div>
        </div>

        <div class="test-results">
            ${testResults.map(result => `
                <div class="test-result test-${result.status.toLowerCase()}">
                    <h3>🎬 ${result.testName}</h3>
                    <p><strong>Status:</strong> <span class="${result.status.toLowerCase()}">${result.status}</span></p>
                    <p><strong>Duration:</strong> <span class="duration">${result.durationInSeconds} seconds</span></p>
                    <p><strong>Timestamp:</strong> <span class="timestamp">${new Date(result.timestamp).toLocaleString()}</span></p>
                    
                    ${result.error ? `<div class="error"><strong>Error:</strong> ${result.error}</div>` : ''}
                    
                    ${result.steps && result.steps.length > 0 ? `
                    <h4>📝 Steps:</h4>
                    <button class="toggle-button" onclick="toggleSteps(this)">Show Steps</button>
                    <div class="steps-container">
                    ${result.steps.map(step => `
                        <div class="step step-${step.status.toLowerCase()}">
                            <strong>${step.stepName}</strong> - 
                            <span class="${step.status.toLowerCase()}">${step.status}</span>
                            <span class="duration">(${step.duration}ms)</span>
                            ${step.error ? `<div class="error">${step.error}</div>` : ''}
                            ${step.screenshot ? `<br><img src="${step.screenshot}" class="screenshot" alt="Step screenshot" onclick="window.open(this.src)">` : ''}
                        </div>
                    `).join('')}
                    </div>` : ''}
                    
                    ${result.screenshots && result.screenshots.length > 0 ? `
                        <h4>📸 Screenshots:</h4>
                        <div class="screenshots-container">
                        ${result.screenshots.map(screenshot => `
                            <img src="../${screenshot}" class="screenshot" alt="Test screenshot" onclick="window.open(this.src)">
                        `).join('')}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    </div>

    <script>
    function toggleSteps(button) {
        const container = button.nextElementSibling;
        if (container.style.display === 'none') {
            container.style.display = 'block';
            button.textContent = 'Hide Steps';
        } else {
            container.style.display = 'none';
            button.textContent = 'Show Steps';
        }
    }

    // Initialize steps containers to be hidden by default
    document.addEventListener('DOMContentLoaded', function() {
        const containers = document.querySelectorAll('.steps-container');
        containers.forEach(container => {
            container.style.display = 'none';
        });
    });
    </script>
</body>
</html>`;
  
  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  fs.writeFileSync('reports/html/latest.html', htmlContent, 'utf8');
  
  console.log(`✅ HTML report saved: ${htmlPath}`);
  console.log(`✅ HTML report copied to: reports/html/latest.html`);
  
  return htmlPath;
}

// Combine individual JSON reports into one
function combineJsonReports(testFiles) {
  console.log('\n🔄 Combining JSON reports...');
  
  const combinedReport = [];
  const combinedReportPath = 'reports/json/combined-report.json';
  
  for (const test of testFiles) {
    const reportPath = `reports/json/${test.name}-report.json`;
    
    if (fs.existsSync(reportPath)) {
      try {
        const reportJson = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        if (Array.isArray(reportJson)) {
          combinedReport.push(...reportJson);
        }
      } catch (e) {
        console.error(`Error reading report for ${test.name}: ${e.message}`);
      }
    }
  }
  
  // Save combined report
  fs.writeFileSync(combinedReportPath, JSON.stringify(combinedReport, null, 2));
  console.log(`✅ Combined JSON report saved: ${combinedReportPath}`);
  
  return combinedReportPath;
}

// Main function
async function runAllTests() {
  console.log('🔍 Finding test files in AI-generated folders...');
  
  // Ensure reports directories exist
  const dirs = [
    'reports',
    'reports/html', 
    'reports/json',
    'reports/screenshots',
    'reports/artifacts'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Find all tests in AI-generated folders
  const testFiles = findAllAiGeneratedTests();
  
  if (testFiles.length === 0) {
    console.log('⚠️ No test files found in AI-generated folders.');
    return;
  }
  
  console.log(`Found ${testFiles.length} tests to run.`);
  
  // Run tests one by one
  const testResults = [];
  
  for (let i = 0; i < testFiles.length; i++) {
    const result = runSingleTest(testFiles[i], i, testFiles.length);
    testResults.push(result);
  }
  
  // Combine JSON reports
  combineJsonReports(testFiles);
  
  // Generate HTML report
  const reportPath = generateHtmlReport(testResults);
  
  // Print summary
  console.log('\n📋 Test Summary:');
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  
  for (const result of testResults) {
    if (result.status === TestStatus.PASSED) {
      console.log(`✅ ${result.testName}: PASSED`);
      passed++;
    } else if (result.status === TestStatus.FAILED) {
      console.log(`❌ ${result.testName}: FAILED`);
      failed++;
    } else {
      console.log(`⚠️ ${result.testName}: SKIPPED`);
      skipped++;
    }
  }
  
  console.log(`\n🎯 Final Results: ${passed} passed, ${failed} failed, ${skipped} skipped, ${passed + failed + skipped} total`);
  console.log(`\n📊 HTML report is available at: ${reportPath}`);
  console.log('    Run "npm run reports:open" to view the report in your browser');
}

// Run the tests
runAllTests().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});