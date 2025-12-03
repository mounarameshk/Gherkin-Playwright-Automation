// src/support/world.ts
import { setWorldConstructor, World } from '@cucumber/cucumber';
import { chromium, firefox, webkit } from 'playwright';
// Import types separately using the 'type' keyword
import type { Browser, BrowserContext, Page } from 'playwright';

// Custom world class for Playwright
class CustomWorld extends World {
  browser: Browser | null = null;
  context: BrowserContext | null = null;
  page: Page | null = null;
  featureName = '';

  constructor(options: any) {
    super(options);
  }

  async openBrowser() {
    // Use chromium by default
    const browserType = process.env.BROWSER_TYPE || 'chromium';
    const headless = process.env.HEADLESS === 'true';
    
    try {
      console.log(`Launching ${browserType} browser (headless: ${headless})`);
      
      // Launch browser based on selected type
      switch (browserType) {
        case 'firefox':
          this.browser = await firefox.launch({ headless, slowMo: 50 });
          break;
        case 'webkit':
          this.browser = await webkit.launch({ headless, slowMo: 50 });
          break;
        default:
          this.browser = await chromium.launch({ 
            headless, 
            slowMo: 50,
            args: ['--start-maximized']
          });
      }
      
      // Create a new context
      this.context = await this.browser.newContext({
       // viewport: { width: 1280, height: 720 },
       viewport: null,
        acceptDownloads: true,
        recordVideo: process.env.RECORD_VIDEO === 'true' ? {
          dir: 'reports/videos/'
        } : undefined
      });
      
      // Create a new page
      this.page = await this.context.newPage();
      
      // Set default navigation timeout
      this.page.setDefaultTimeout(60000);
      this.page.setDefaultNavigationTimeout(60000);
      
      return this.page;
    } catch (error) {
      console.error('Error launching browser:', error);
      throw error;
    }
  }

  async closeBrowser() {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (error) {
      console.error('Error closing browser:', error);
    }
  }
}

setWorldConstructor(CustomWorld);