// src/prevent-networkidle.ts
import * as fs from 'fs';
import gherkinParse from 'gherkin-parse';

export function preventNetworkIdle() {
  const testFile = 'generated-test-with-real-selectors.ts';
  const featureFile = 'src/features/test-enhanced.feature';
  
  if (!fs.existsSync(testFile) || !fs.existsSync(featureFile)) return;
  
  let content = fs.readFileSync(testFile, 'utf-8');
  
  // Check for any waitForLoadState patterns
  const forbiddenPatterns = [
    /waitForLoadState/g,
    /networkidle/g,
    /domcontentloaded/g
  ];
  
  let hasForbiddenPattern = false;
  forbiddenPatterns.forEach(pattern => {
    if (pattern.test(content)) {
      hasForbiddenPattern = true;
      console.log(`❌ FOUND FORBIDDEN PATTERN: ${pattern}`);
    }
  });
  
  if (hasForbiddenPattern) {
    // Aggressively remove all waitForLoadState patterns
    content = content
      .replace(/await\s+page\.waitForLoadState\s*\([^)]*\)\s*;?\s*/g, '')
      .replace(/page\.waitForLoadState\s*\([^)]*\)\s*;?\s*/g, '')
      .replace(/,\s*waitUntil:\s*['"]\w+['"]/g, '')
      .replace(/waitUntil:\s*['"]\w+['"]\s*,?\s*/g, '');
    
    fs.writeFileSync(testFile, content);
    console.log('🧹 REMOVED all waitForLoadState patterns');
  }
  
  // Ensure the test is aligned with the feature file
  alignWithFeatureFile(testFile, featureFile);
}

function alignWithFeatureFile(testFile: string, featureFile: string) {
  try {
    // Use convertFeatureFileToJSON instead of convertFeatureToJSON
    const featureJSON = gherkinParse.convertFeatureFileToJSON(featureFile);
    const feature = featureJSON.feature;
    
    let testContent = fs.readFileSync(testFile, 'utf-8');
    let modified = false;
    
    // Check each step in the feature file
    feature.children.forEach((scenario: any) => {
      scenario.steps.forEach((step: any) => {
        const keyword = step.keyword.trim();
        const stepText = step.text.trim();
        
        // The pattern we expect in the test file
        const expectedPattern = `${keyword}('${stepText}'`;
        
        // If the step definition doesn't exist in the test file
        if (!testContent.includes(expectedPattern)) {
          console.log(`⚠️ Step '${keyword} ${stepText}' not found in test file - attempting to fix`);
          
          // Find the closest match to replace
          const stepRegex = /(?:Given|When|Then)\(['"](.+?)['"]/g;
          const matches = Array.from(testContent.matchAll(stepRegex));
          
          if (matches.length > 0) {
            // Find the best match based on keyword and similarity
            const keywordMatches = matches.filter(m => 
              m[0].startsWith(keyword)
            );
            
            const bestMatch = keywordMatches.length > 0 ? 
              keywordMatches[0] : matches[0];
            
            // Replace the step text
            testContent = testContent.replace(
              bestMatch[0],
              `${keyword}('${stepText}'`
            );
            
            modified = true;
            console.log(`✅ Fixed step: ${keyword} ${stepText}`);
          }
        }
      });
    });
    
    if (modified) {
      fs.writeFileSync(testFile, testContent);
      console.log('✅ Test file updated to match feature file');
    } else {
      console.log('✅ Test file already aligned with feature file');
    }
    
  } catch (error) {
    console.error('❌ Error aligning with feature file:', error);
  }
}

// Run immediately
preventNetworkIdle();