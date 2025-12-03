// src/test-reporter.ts
import * as fs from 'fs';
import * as path from 'path';

export interface TestResult {
  testName: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  duration: number;
  timestamp: string;
  error?: string;
  screenshots: string[];
  steps: TestStep[];
}

export interface TestStep {
  stepName: string;
  status: 'PASSED' | 'FAILED';
  duration: number;
  screenshot?: string;
  error?: string;
}

export class TestReporter {
  private results: TestResult[] = [];
  private currentTest: TestResult | null = null;
  private testStartTime: number = 0;
  private stepStartTime: number = 0;

  constructor() {
    this.ensureReportsDirectory();
  }

  private ensureReportsDirectory() {
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
  }

  startTest(testName: string) {
    this.testStartTime = Date.now();
    this.currentTest = {
      testName,
      status: 'PASSED',
      duration: 0,
      timestamp: new Date().toISOString(),
      screenshots: [],
      steps: []
    };
    
    console.log(`📊 Started recording test: ${testName}`);
  }

  startStep(stepName: string) {
    this.stepStartTime = Date.now();
    console.log(`📝 Recording step: ${stepName}`);
  }

  endStep(stepName: string, status: 'PASSED' | 'FAILED', error?: string, screenshot?: string) {
    if (!this.currentTest) return;

    const duration = Date.now() - this.stepStartTime;
    
    const step: TestStep = {
      stepName,
      status,
      duration,
      error,
      screenshot
    };

    this.currentTest.steps.push(step);

    if (status === 'FAILED') {
      this.currentTest.status = 'FAILED';
      this.currentTest.error = error;
    }

    if (screenshot) {
      this.currentTest.screenshots.push(screenshot);
    }

    console.log(`✅ Step completed: ${stepName} - ${status} (${duration}ms)`);
  }

  endTest() {
    if (!this.currentTest) return;

    this.currentTest.duration = Date.now() - this.testStartTime;
    this.results.push(this.currentTest);

    console.log(`🏁 Test completed: ${this.currentTest.testName} - ${this.currentTest.status} (${this.currentTest.duration}ms)`);
    
    this.currentTest = null;
  }

  async generateReports() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Generate JSON report
    await this.generateJsonReport(timestamp);
    
    // Generate HTML report
    await this.generateHtmlReport(timestamp);
    
    // Generate summary
    await this.generateSummaryReport(timestamp);

    console.log('📊 All reports generated successfully!');
  }

  private async generateJsonReport(timestamp: string) {
    const jsonReport = {
      generated: new Date().toISOString(),
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.status === 'PASSED').length,
        failed: this.results.filter(r => r.status === 'FAILED').length,
        skipped: this.results.filter(r => r.status === 'SKIPPED').length
      },
      results: this.results
    };

    const jsonPath = `reports/json/test-results-${timestamp}.json`;
    fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
    
    // Also create latest.json for easy access
    fs.writeFileSync('reports/json/latest.json', JSON.stringify(jsonReport, null, 2));
    
    console.log(`📄 JSON report saved: ${jsonPath}`);
  }

  private async generateHtmlReport(timestamp: string) {
    const htmlContent = this.generateHtmlContent();
    const htmlPath = `reports/html/test-report-${timestamp}.html`;
    
    fs.writeFileSync(htmlPath, htmlContent);
    
    // Also create latest.html for easy access
    fs.writeFileSync('reports/html/latest.html', htmlContent);
    
    console.log(`🌐 HTML report saved: ${htmlPath}`);
  }

  private generateHtmlContent(): string {
    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'PASSED').length,
      failed: this.results.filter(r => r.status === 'FAILED').length,
      skipped: this.results.filter(r => r.status === 'SKIPPED').length
    };

    return `
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
        .passed { background-color: #d4edda; border: 1px solid #c3e6cb; }
        .failed { background-color: #f8d7da; border: 1px solid #f5c6cb; }
        .skipped { background-color: #fff3cd; border: 1px solid #ffeaa7; }
        .total { background-color: #d1ecf1; border: 1px solid #bee5eb; }
        .test-result { margin: 20px 0; padding: 15px; border-radius: 8px; border: 1px solid #ddd; }
        .test-passed { border-left: 5px solid #28a745; }
        .test-failed { border-left: 5px solid #dc3545; }
        .step { margin: 10px 0; padding: 10px; background-color: #f8f9fa; border-radius: 4px; }
        .step-passed { border-left: 3px solid #28a745; }
        .step-failed { border-left: 3px solid #dc3545; }
        .screenshot { max-width: 300px; margin: 10px 0; cursor: pointer; }
        .error { background-color: #f8d7da; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .timestamp { color: #6c757d; font-size: 0.9em; }
        .duration { color: #007bff; font-weight: bold; }
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
            ${this.results.map(result => `
                <div class="test-result test-${result.status.toLowerCase()}">
                    <h3>🎬 ${result.testName}</h3>
                    <p><strong>Status:</strong> <span class="${result.status.toLowerCase()}">${result.status}</span></p>
                    <p><strong>Duration:</strong> <span class="duration">${result.duration}ms</span></p>
                    <p><strong>Timestamp:</strong> <span class="timestamp">${new Date(result.timestamp).toLocaleString()}</span></p>
                    
                    ${result.error ? `<div class="error"><strong>Error:</strong> ${result.error}</div>` : ''}
                    
                    <h4>📝 Steps:</h4>
                    ${result.steps.map(step => `
                        <div class="step step-${step.status.toLowerCase()}">
                            <strong>${step.stepName}</strong> - 
                            <span class="${step.status.toLowerCase()}">${step.status}</span>
                            <span class="duration">(${step.duration}ms)</span>
                            ${step.error ? `<div class="error">${step.error}</div>` : ''}
                            ${step.screenshot ? `<br><img src="../screenshots/${path.basename(step.screenshot)}" class="screenshot" alt="Step screenshot" onclick="window.open(this.src)">` : ''}
                        </div>
                    `).join('')}
                    
                    ${result.screenshots.length > 0 ? `
                        <h4>📸 Screenshots:</h4>
                        ${result.screenshots.map(screenshot => `
                            <img src="../screenshots/${path.basename(screenshot)}" class="screenshot" alt="Test screenshot" onclick="window.open(this.src)">
                        `).join('')}
                    ` : ''}
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
  }

  private async generateSummaryReport(timestamp: string) {
    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'PASSED').length,
      failed: this.results.filter(r => r.status === 'FAILED').length,
      skipped: this.results.filter(r => r.status === 'SKIPPED').length,
      totalDuration: this.results.reduce((sum, r) => sum + r.duration, 0),
      timestamp: new Date().toISOString()
    };

    const summaryPath = `reports/summary-${timestamp}.txt`;
    const summaryContent = `
🤖 PLAYWRIGHT AGENT TEST REPORT
=====================================
Generated: ${new Date().toLocaleString()}

📊 SUMMARY:
- Total Tests: ${summary.total}
- Passed: ${summary.passed}
- Failed: ${summary.failed}  
- Skipped: ${summary.skipped}
- Total Duration: ${summary.totalDuration}ms

📝 DETAILED RESULTS:
${this.results.map(result => `
- ${result.testName}: ${result.status} (${result.duration}ms)
  Steps: ${result.steps.length}
  Screenshots: ${result.screenshots.length}
  ${result.error ? `Error: ${result.error}` : ''}
`).join('')}

🎯 SUCCESS RATE: ${summary.total > 0 ? Math.round((summary.passed / summary.total) * 100) : 0}%
`;

    fs.writeFileSync(summaryPath, summaryContent);
    console.log(`📋 Summary report saved: ${summaryPath}`);
  }
}
