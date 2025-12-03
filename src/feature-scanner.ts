// src/feature-scanner.ts
import * as fs from 'fs';
import * as path from 'path';
import { RealDOMScanner } from './real-dom-scanner';

class FeatureScanner {
  private featuresDir: string;
  private outputDir: string;

  constructor(featuresDir = 'src/features', outputDir = 'AI-generated') {
    this.featuresDir = featuresDir;
    this.outputDir = outputDir;
  }

  async scanAllFeatures() {
    try {
      console.log(`🔍 Scanning features directory: ${this.featuresDir}`);
      
      // Check if features directory exists
      if (!fs.existsSync(this.featuresDir)) {
        throw new Error(`Features directory not found: ${this.featuresDir}`);
      }
      
      // Get all feature files
      const featureFiles = fs.readdirSync(this.featuresDir)
        .filter(file => file.endsWith('.feature'));
      
      console.log(`📋 Found ${featureFiles.length} feature files: ${featureFiles.join(', ')}`);
      
      // Create output directory if it doesn't exist
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
      }
      
      // Process each feature file
      for (const featureFile of featureFiles) {
        await this.processFeatureFile(featureFile);
      }
      
      console.log('✅ Processed all feature files');
      
    } catch (error) {
      console.error('❌ Error scanning feature files:', error);
    }
  }

  private async processFeatureFile(featureFileName: string) {
    const featureFilePath = path.join(this.featuresDir, featureFileName);
    const featureBaseName = path.basename(featureFileName, '.feature');
    const outputSubDir = path.join(this.outputDir, featureBaseName);
    
    console.log(`\n🔍 Processing feature file: ${featureFileName}`);
    
    try {
      // Create output subdirectory for this feature
      if (!fs.existsSync(outputSubDir)) {
        fs.mkdirSync(outputSubDir, { recursive: true });
      }
      
      // Create scanner for this feature file
      const domScanner = new RealDOMScanner(featureFilePath, `${outputSubDir}/${featureBaseName}.ts`);
      
      // Run the scanner to generate the test file
      await domScanner.scanAndGenerate();
      
      console.log(`✅ Generated test file for ${featureFileName} at: ${outputSubDir}/${featureBaseName}.ts`);
    } catch (error) {
      console.error(`❌ Error processing feature file ${featureFileName}:`, error);
    }
  }
}

// Run the feature scanner
const scanner = new FeatureScanner();
scanner.scanAllFeatures().catch(console.error);