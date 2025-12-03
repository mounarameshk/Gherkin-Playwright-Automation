// src/support/hooks.ts
import { After, Before, BeforeAll, AfterAll, Status } from '@cucumber/cucumber';
import * as fs from 'fs';
import * as path from 'path';

// Set a longer timeout for steps
import { setDefaultTimeout } from '@cucumber/cucumber';
setDefaultTimeout(60 * 1000); // 60 seconds

// Create screenshots directory if it doesn't exist
BeforeAll(async function() {
  const screenshotsDir = process.env.SCREENSHOT_PATH || 'reports/screenshots';
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  console.log(`Screenshots will be saved to: ${screenshotsDir}`);
});

// Before each scenario
Before(async function(scenario) {
  console.log(`Starting scenario: ${scenario.pickle.name}`);
  
  // Store scenario for later use
  this.currentScenario = scenario.pickle;
  
  // Extract feature name from URI
  if (scenario.pickle.uri) {
    const match = scenario.pickle.uri.match(/([^/\\]+)\.feature$/i);
    if (match) {
      this.featureName = match[1];
    } else {
      this.featureName = 'unknown-feature';
    }
  }
  
  // For test name without feature file
  if (!this.featureName && process.env.CURRENT_TEST_NAME) {
    this.featureName = process.env.CURRENT_TEST_NAME;
  }
  
  // Open a new browser for this scenario
  await this.openBrowser();
});

// After each scenario
After(async function(scenario) {
  if (!this.page) return;
  
  try {
    // Take screenshot regardless of pass/fail
    const screenshotsDir = process.env.SCREENSHOT_PATH || 'reports/screenshots';
    
    // Sanitize scenario name for filename
    const scenarioName = scenario.pickle.name
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase()
      .substring(0, 30);
    
    const featureName = this.featureName || 'unknown';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotName = `${featureName}-${scenarioName}-${timestamp}.png`;
    const screenshotPath = path.join(screenshotsDir, screenshotName);
    
    // Capture screenshot
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPath}`);
    
    // Attach screenshot to report
    const screenshotBuffer = fs.readFileSync(screenshotPath);
    this.attach(screenshotBuffer, 'image/png');
  } catch (error) {
    console.error('Error taking screenshot:', error);
  }
  
  // Always close browser after each scenario
  await this.closeBrowser();
});

// After all scenarios
AfterAll(async function() {
  console.log('All scenarios completed');
});