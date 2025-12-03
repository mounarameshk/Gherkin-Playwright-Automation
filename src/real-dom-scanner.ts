// src/real-dom-scanner.ts
import * as fs from 'fs';
import * as path from 'path';
import { chromium, Page } from 'playwright';

export class RealDOMScanner {
  private featureFilePath: string;
  private outputFilePath: string;
  private domElements: any = {};
  private capturedScreens: Map<string, any> = new Map();

  constructor(featureFilePath = 'src/features/auth.feature', outputFilePath?: string) {
    this.featureFilePath = featureFilePath;
    
    if (outputFilePath) {
      this.outputFilePath = outputFilePath;
    } else {
      const featureBaseName = path.basename(featureFilePath, '.feature');
      this.outputFilePath = path.join('AI-generated', featureBaseName, `${featureBaseName}.ts`);
    }
  }

  async scanAndGenerate() {
    try {
      console.log('🔍 Starting dynamic browser crawler...');
      
      // Check if feature file exists
      if (!fs.existsSync(this.featureFilePath)) {
        throw new Error(`Feature file not found: ${this.featureFilePath}`);
      }
      
      // Parse feature file content
      const featureContent = fs.readFileSync(this.featureFilePath, 'utf-8');
      console.log(`📋 Reading feature file: ${this.featureFilePath}`);
      
      // Parse feature content
      const feature = this.parseFeatureContent(featureContent);
      console.log(`📝 Feature: ${feature.name || 'Unnamed feature'}`);
      
      if (!feature.scenarios || feature.scenarios.length === 0) {
        throw new Error('No scenarios found in feature file');
      }
      
      // Launch browser for dynamic crawling
      const browser = await chromium.launch({ 
        headless: process.env.HEADLESS === 'true',
        slowMo: 100,
        args: [
          '--start-maximized',  // Maximize browser window on launch
          '--disable-web-security',
          '--disable-dev-shm-usage'
        ]
      });
      
      try {
        console.log('🔍 Starting dynamic application crawling...');
        await this.crawlApplicationScreens(browser, feature.scenarios);
        console.log('✅ Dynamic crawling complete');

        // Generate test content based on captured elements
        console.log('🧠 Generating step definitions from captured elements...');
        const testContent = this.generateStepDefinitionsFromCrawledData(feature.scenarios);
        
        // Generate the test file
        const generatedTestContent = this.buildTestFile(testContent);
        
        // Create target directory if it doesn't exist
        const targetDir = path.dirname(this.outputFilePath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        
        // Write the generated test
        fs.writeFileSync(this.outputFilePath, generatedTestContent);
        
        console.log(`✅ Generated test file: ${this.outputFilePath}`);
        
      } finally {
        await browser.close();
      }
      
    } catch (error) {
      console.error('❌ Error during dynamic scanning:', error);
      throw error;
    }
  }

  private async crawlApplicationScreens(browser: any, scenarios: Array<{ name: string; steps: Array<{ keyword: string; text: string }> }>) {
  const context = await browser.newContext({
    viewport: null, // 🔧 CHANGED: Remove viewport constraint to allow maximization
    recordVideo: process.env.RECORD_VIDEO === 'true' ? {
      dir: 'reports/videos/'
    } : undefined
  });
  
  const page = await context.newPage();
  
  // 🔧 ADDED: Maximize the browser window after page creation
  await page.setViewportSize({ width: 1920, height: 1080 });
  console.log('🖥️ Browser maximized to 1920x1080');
  
  const baseUrl = process.env.BASE_URL || "https://stardust.integration.endpointclosing.com/endpoint/consumer-app";
  
  try {
    // Navigate to login page and capture elements
    await this.crawlLoginScreen(page, baseUrl);
    
    // Try to login and crawl authenticated screens
    await this.crawlAuthenticatedScreens(page);
    
    // Crawl forgot password screens if needed
    const hasResetScenario = scenarios.some(s => 
      s.name.toLowerCase().includes('reset') || 
      s.name.toLowerCase().includes('forgot')
    );
    
    if (hasResetScenario) {
      await this.crawlForgotPasswordScreens(page, baseUrl);
    }
    
  } catch (error) {
    console.error('Error during screen crawling:', error);
  } finally {
    await context.close();
  }
}

  private async crawlLoginScreen(page: Page, baseUrl: string) {
    console.log('🔍 Crawling login screen...');
    
    try {
      await page.goto(`${baseUrl}/sign-in`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);
      
      // Create screenshots directory
      const screenshotDir = 'src/screenshots';
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      
      // Capture screenshot with error handling
      try {
        await page.screenshot({ 
          path: 'src/screenshots/login-screen.png', 
          fullPage: true,
          timeout: 10000
        });
        console.log('📸 Login screen screenshot captured');
      } catch (screenshotError) {
        console.warn('⚠️ Could not capture screenshot:', screenshotError);
      }
      
      // Dynamically capture all interactive elements - FIXED VERSION
      const loginElements = await page.evaluate(() => {
        const elements: any = {};
        
        try {
          // Capture input fields
          const inputs = Array.from(document.querySelectorAll('input'));
          inputs.forEach((input, index) => {
            const inputData = {
              index,
              id: input.id || null,
              name: input.name || null,
              type: input.type || null,
              placeholder: input.placeholder || null,
              className: input.className || null,
              dataTestId: input.getAttribute('data-testid') || input.getAttribute('data-test-id') || null,
              ariaLabel: input.getAttribute('aria-label') || null,
              value: input.value || null,
              selectors: [] as string[]
            };
            
            // Build selectors array
            if (input.id) inputData.selectors.push(`#${input.id}`);
            if (input.name) inputData.selectors.push(`[name="${input.name}"]`);
            if (input.type) inputData.selectors.push(`input[type="${input.type}"]`);
            if (input.placeholder) inputData.selectors.push(`[placeholder="${input.placeholder}"]`);
            if (inputData.dataTestId) inputData.selectors.push(`[data-testid="${inputData.dataTestId}"]`);
            
            // Identify specific input types
            if (input.type === 'email' || input.name === 'email' || input.id === 'email' || 
                (input.placeholder && input.placeholder.toLowerCase().includes('email'))) {
              elements.emailInput = inputData;
            } else if (input.type === 'password') {
              elements.passwordInput = inputData;
            }
          });
          
          // Capture buttons
          const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
          elements.buttons = [];
          buttons.forEach((button, index) => {
            const buttonData = {
              index,
              id: button.id || null,
              type: button.getAttribute('type') || null,
              textContent: button.textContent ? button.textContent.trim() : null,
              className: button.className || null,
              dataTestId: button.getAttribute('data-testid') || button.getAttribute('data-test-id') || null,
              disabled: button.hasAttribute('disabled'),
              selectors: [] as string[]
            };
            
            // Build selectors array
            if (button.id) buttonData.selectors.push(`#${button.id}`);
            if (buttonData.textContent) buttonData.selectors.push(`button:has-text("${buttonData.textContent}")`);
            if (buttonData.dataTestId) buttonData.selectors.push(`[data-testid="${buttonData.dataTestId}"]`);
            if (buttonData.type) buttonData.selectors.push(`[type="${buttonData.type}"]`);
            
            // Identify sign in button
            if (buttonData.textContent && buttonData.textContent.toLowerCase().includes('sign in')) {
              elements.signInButton = buttonData;
            }
            
            elements.buttons.push(buttonData);
          });
          
          // Capture links
          const links = Array.from(document.querySelectorAll('a'));
          elements.links = [];
          links.forEach((link, index) => {
            const linkData = {
              index,
              text: link.textContent ? link.textContent.trim() : null,
              href: (link as HTMLAnchorElement).href || null,
              id: link.id || null,
              className: link.className || null,
              selectors: [] as string[]
            };
            
            // Build selectors array
            if (link.id) linkData.selectors.push(`#${link.id}`);
            if (linkData.text) linkData.selectors.push(`a:has-text("${linkData.text}")`);
            if (linkData.href) linkData.selectors.push(`a[href*="${linkData.href.split('/').pop()}"]`);
            
            // Identify forgot password link
            if (linkData.text && linkData.text.toLowerCase().includes('forgot')) {
              elements.forgotPasswordLink = linkData;
            }
            
            elements.links.push(linkData);
          });
          
          // Look for user avatar elements
          const avatars = Array.from(document.querySelectorAll('[data-testid*="avatar"], [data-test-id*="avatar"], .avatar, [class*="avatar"]'));
          if (avatars.length > 0) {
            const avatar = avatars[0];
            elements.userAvatar = {
              id: avatar.id || null,
              className: avatar.className || null,
              dataTestId: avatar.getAttribute('data-testid') || avatar.getAttribute('data-test-id') || null,
              selectors: [] as string[]
            };
            
            if (avatar.id) elements.userAvatar.selectors.push(`#${avatar.id}`);
            if (elements.userAvatar.dataTestId) elements.userAvatar.selectors.push(`[data-testid="${elements.userAvatar.dataTestId}"]`);
            if (avatar.className) elements.userAvatar.selectors.push(`.${avatar.className.split(' ')[0]}`);
            elements.userAvatar.selectors.push('[data-testid*="avatar"]');
          }
          
        } catch (error) {
          console.error('Error in page evaluation:', error);
        }
        
        return elements;
      });
      
      this.capturedScreens.set('login', loginElements);
      console.log('✅ Login screen elements captured:', Object.keys(loginElements));
      
    } catch (error) {
      console.error('Error crawling login screen:', error);
    }
  }

  private async crawlAuthenticatedScreens(page: Page) {
    console.log('🔍 Attempting to crawl authenticated screens...');
    
    const email = process.env.TEST_EMAIL || 'qa+automation@endpointclosing.com';
    const password = process.env.TEST_PASSWORD || 'Q-X4WLvH6mAnsaZCBpm';
    
    try {
      const loginElements = this.capturedScreens.get('login');
      if (!loginElements) return;
      
      // Fill login form
      if (loginElements.emailInput && loginElements.emailInput.selectors.length > 0) {
        const emailSelector = loginElements.emailInput.selectors[0];
        await page.fill(emailSelector, email);
        console.log(`✅ Filled email using: ${emailSelector}`);
      }
      
      if (loginElements.passwordInput && loginElements.passwordInput.selectors.length > 0) {
        const passwordSelector = loginElements.passwordInput.selectors[0];
        await page.fill(passwordSelector, password);
        console.log(`✅ Filled password using: ${passwordSelector}`);
      }
      
      // Click sign in
      if (loginElements.signInButton && loginElements.signInButton.selectors.length > 0) {
        const signInSelector = loginElements.signInButton.selectors[0];
        await page.click(signInSelector);
        console.log(`✅ Clicked sign in using: ${signInSelector}`);
        await page.waitForTimeout(5000);
        
        // Check if login was successful
        const currentUrl = page.url();
        if (!currentUrl.includes('sign-in')) {
          console.log('✅ Login successful, capturing authenticated screen');
          
          // Capture screenshot with error handling
          try {
            await page.screenshot({ 
              path: 'src/screenshots/authenticated-screen.png', 
              fullPage: true,
              timeout: 10000
            });
          } catch (screenshotError) {
            console.warn('⚠️ Could not capture authenticated screenshot:', screenshotError);
          }
          
          // Capture authenticated elements
          const authenticatedElements = await page.evaluate(() => {
            const elements: any = {};
            
            try {
              // Look for navigation links
              const links = Array.from(document.querySelectorAll('a, button'));
              links.forEach(link => {
                const text = link.textContent ? link.textContent.trim() : '';
                if (text.toLowerCase().includes('transaction')) {
                  elements.transactionsLink = {
                    text: text,
                    href: (link as HTMLAnchorElement).href || null,
                    selectors: [`a:has-text("${text}")`, `button:has-text("${text}")`]
                  };
                }
              });
              
              // Look for user avatar/dropdown
              const avatars = Array.from(document.querySelectorAll('[data-testid*="avatar"], [data-test-id*="avatar"], .avatar, [class*="avatar"], [class*="user"]'));
              if (avatars.length > 0) {
                const avatar = avatars[0];
                elements.userAvatar = {
                  id: avatar.id || null,
                  className: avatar.className || null,
                  dataTestId: avatar.getAttribute('data-testid') || avatar.getAttribute('data-test-id') || null,
                  selectors: []
                };
                
                if (avatar.id) elements.userAvatar.selectors.push(`#${avatar.id}`);
                if (elements.userAvatar.dataTestId) elements.userAvatar.selectors.push(`[data-testid="${elements.userAvatar.dataTestId}"]`);
                elements.userAvatar.selectors.push('[data-testid*="avatar"]');
                elements.userAvatar.selectors.push('[data-test-id="user-avatar"]');
              }
              
              // Look for sign out link (might be in dropdown)
              const signOutElements = Array.from(document.querySelectorAll('a, button'));
              signOutElements.forEach(element => {
                const text = element.textContent ? element.textContent.trim() : '';
                if (text.toLowerCase().includes('sign out') || text.toLowerCase().includes('logout')) {
                  elements.signOutLink = {
                    text: text,
                    selectors: [`a:has-text("${text}")`, `button:has-text("${text}")`]
                  };
                }
              });
              
            } catch (error) {
              console.error('Error capturing authenticated elements:', error);
            }
            
            return elements;
          });
          
          this.capturedScreens.set('authenticated', authenticatedElements);
          console.log('✅ Authenticated screen elements captured:', Object.keys(authenticatedElements));
        }
      }
      
    } catch (error) {
      console.warn('⚠️ Could not crawl authenticated screens:', error);
    }
  }

  private async crawlForgotPasswordScreens(page: Page, baseUrl: string) {
    console.log('🔍 Crawling forgot password screens...');
    
    try {
      // Navigate back to login page
      await page.goto(`${baseUrl}/sign-in`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      
      const loginElements = this.capturedScreens.get('login');
      if (loginElements?.forgotPasswordLink?.selectors.length > 0) {
        const forgotSelector = loginElements.forgotPasswordLink.selectors[0];
        await page.click(forgotSelector);
        await page.waitForTimeout(3000);
        
        // Capture forgot password elements
        const forgotPasswordElements = await page.evaluate(() => {
          const elements: { 
            radioButtons?: any[]; 
            forgotEmailRadio?: any;
            nextButton?: any;
          } = {};
          
          try {
            // Capture radio buttons
            const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
            
            // Ensure radioButtons is initialized as an array
            if (!elements.radioButtons) {
              elements.radioButtons = [];
            }
            
            radios.forEach((radio, index) => {
              const label = document.querySelector(`label[for="${radio.id}"]`) || 
                           radio.closest('label');
              
              const radioData = {
                index,
                id: radio.id || null,
                name: (radio as HTMLInputElement).name || null,
                value: (radio as HTMLInputElement).value || null,
                labelText: label && label.textContent ? label.textContent.trim() : null,
                selectors: [] as string[]
              };
              
              if (radio.id) radioData.selectors.push(`#${radio.id}`);
              if ((radio as HTMLInputElement).name) radioData.selectors.push(`[name="${(radio as HTMLInputElement).name}"]`);
              if (radioData.labelText) {
                // Escape the label text before adding to selectors
                const escapedLabelText = radioData.labelText.replace(/'/g, "\\'");
                radioData.selectors.push(`label:has-text("${escapedLabelText}")`);
              }
              
              if (radioData.labelText && radioData.labelText.toLowerCase().includes('email address')) {
                elements.forgotEmailRadio = radioData;
              }
              
              // Ensure radioButtons is initialized as an array before pushing
              if (!elements.radioButtons) {
                elements.radioButtons = [];
              }
              elements.radioButtons.push(radioData);
            });
            
            // Capture next button
            const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
            buttons.forEach(button => {
              const text = button.textContent ? button.textContent.trim() : '';
              if (text.toLowerCase().includes('next') || button.getAttribute('type') === 'submit') {
                elements.nextButton = {
                  text: text,
                  type: button.getAttribute('type'),
                  disabled: button.hasAttribute('disabled'),
                  selectors: [] as string[]
                };
                
                if (button.id) elements.nextButton.selectors.push(`#${button.id}`);
                if (text) {
                  const escapedText = text.replace(/'/g, "\\'");
                  elements.nextButton.selectors.push(`button:has-text("${escapedText}")`);
                }
                elements.nextButton.selectors.push('button[type="submit"]');
              }
            });
            
          } catch (error) {
            console.error('Error capturing forgot password elements:', error);
          }
          
          return elements;
        });
        
        this.capturedScreens.set('forgot-password', forgotPasswordElements);
        
        // Try to complete the flow
        if (forgotPasswordElements.forgotEmailRadio?.selectors.length > 0) {
          await page.click(forgotPasswordElements.forgotEmailRadio.selectors[0]);
          await page.waitForTimeout(1000);
          
          if (forgotPasswordElements.nextButton?.selectors.length > 0 && !forgotPasswordElements.nextButton.disabled) {
            await page.click(forgotPasswordElements.nextButton.selectors[0]);
            await page.waitForTimeout(3000);
            
            // **UPDATED: Capture success message with proper escaping**
            const successElements = await page.evaluate(() => {
              const elements: Record<string, any> = {};
              
              try {
                const textElements = Array.from(document.querySelectorAll('p, div, h1, h2, h3, span, [class*="message"]'));
                textElements.forEach(element => {
                  const text = element.textContent ? element.textContent.trim() : '';
                  if (text.includes("We've got you covered")) {
                    // Escape the text for use in selectors
                    const escapedText = text.replace(/'/g, "\\'");
                    
                    elements.successMessage = {
                      text: text,
                      escapedText: escapedText,
                      tagName: element.tagName.toLowerCase(),
                      className: element.className || null,
                      selectors: [
                        `${element.tagName.toLowerCase()}:has-text("${escapedText}")`,
                        `text="${escapedText}"`,
                        `:text("${escapedText}")`
                      ]
                    };
                  }
                });
              } catch (error) {
                console.error('Error capturing success elements:', error);
              }
              
              return elements;
            });
            
            this.capturedScreens.set('success', successElements);
          }
        }
      }
      
    } catch (error) {
      console.error('Error crawling forgot password screens:', error);
    }
  }

  private generateStepDefinitionsFromCrawledData(scenarios: Array<{ name: string; steps: Array<{ keyword: string; text: string }> }>) {
    let stepDefinitions = '';
    
    scenarios.forEach(scenario => {
      stepDefinitions += `// ${scenario.name}\n`;
      
      scenario.steps.forEach(step => {
        stepDefinitions += this.generateDynamicStepImplementation(step, scenario.name);
        stepDefinitions += '\n\n';
      });
    });
    
    return stepDefinitions;
  }

  // Add this helper method to escape text for selectors
  private escapeTextForSelector(text: string): string {
    return text
      .replace(/'/g, "\\'")        // Escape single quotes: ' → \'
      .replace(/"/g, '\\"')        // Escape double quotes: " → \"
      .replace(/\\/g, '\\\\')      // Escape backslashes: \ → \\
      .replace(/\n/g, '\\n')       // Escape newlines
      .replace(/\r/g, '\\r')       // Escape carriage returns
      .replace(/\t/g, '\\t');      // Escape tabs
  }

  // Add this method to your RealDOMScanner class
  private escapeStepText(text: string): string {
    return text.replace(/'/g, "\\'");
  }

  private generateDynamicStepImplementation(step: { keyword: string; text: string }, scenarioName: string): string {
    const { keyword, text } = step;
    
    // Get captured elements
    const loginElements = this.capturedScreens.get('login');
    const forgotPasswordElements = this.capturedScreens.get('forgot-password');  
    const successElements = this.capturedScreens.get('success');
    const authenticatedElements = this.capturedScreens.get('authenticated');
    
    // Generate based on step text and captured elements
    if (text.includes('navigates to the application login page')) {
      return `${keyword}('${text}', async function (this: any) {
  const page = this.page;
  await page.goto(BASE_URL + '/sign-in', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  console.log('✅ Navigated to login page');
})`;
    }
    
    if (text.includes('fills in email address and password')) {
      const emailSelector = loginElements?.emailInput?.selectors?.[0] || 'input[type="email"]';
      const passwordSelector = loginElements?.passwordInput?.selectors?.[0] || 'input[type="password"]';
      
      return `${keyword}('${text}', async function (this: any) {
  const page = this.page;
  
  console.log('🔐 Filling login credentials...');
  
  // Fill email
  const emailSelectors = ['${emailSelector}', 'input[type="email"]', '#email', '[name="email"]'];
  let emailFilled = false;
  for (const selector of emailSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      await page.fill(selector, TEST_EMAIL);
      console.log(\`✅ Filled email using: \${selector}\`);
      emailFilled = true;
      break;
    } catch (error) {
      continue;
    }
  }
  
  // Fill password
  const passwordSelectors = ['${passwordSelector}', 'input[type="password"]', '#password', '[name="password"]'];
  let passwordFilled = false;
  for (const selector of passwordSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      await page.fill(selector, TEST_PASSWORD);
      console.log(\`✅ Filled password using: \${selector}\`);
      passwordFilled = true;
      break;
    } catch (error) {
      continue;
    }
  }
  
  if (!emailFilled || !passwordFilled) {
    throw new Error('Could not fill login credentials');
  }
})`;
    }
    
    if (text.includes('clicks on the "Sign In" button')) {
      const signInSelector = loginElements?.signInButton?.selectors?.[0] || 'button:has-text("Sign In")';
      
      return `${keyword}('${text}', async function (this: any) {
  const page = this.page;
  
  console.log('🖱️ Clicking Sign In button...');
  
  const signInSelectors = ['${signInSelector}', 'button:has-text("Sign In")', 'button[type="submit"]', 'input[type="submit"]'];
  let clicked = false;
  for (const selector of signInSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      await page.click(selector);
      console.log(\`✅ Clicked sign in using: \${selector}\`);
      clicked = true;
      break;
    } catch (error) {
      continue;
    }
  }
  
  if (!clicked) {
    throw new Error('Could not find Sign In button');
  }
  
  await page.waitForTimeout(5000);
})`;
    }
    
    if (text.includes('Transactions page orders screen') && text.includes('Transactions') && text.includes('link')) {
      const transactionsSelector = authenticatedElements?.transactionsLink?.selectors?.[0] || 'a:has-text("Transactions")';
      
      return `${keyword}('${text}', async function (this: any) {
  const page = this.page;
  
  console.log('🔍 Verifying Transactions page...');
  
  // Wait for page to load after login
  await page.waitForTimeout(3000);
  
  // Check for Transactions link
  const transactionSelectors = ['${transactionsSelector}', 'a:has-text("Transactions")', 'a:has-text("Transaction")', '[href*="transaction"]'];
  let found = false;
  for (const selector of transactionSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 10000 });
      const element = await page.locator(selector);
      await expect(element).toBeVisible();
      console.log(\`✅ Found Transactions link using: \${selector}\`);
      found = true;
      break;
    } catch (error) {
      continue;
    }
  }
  
  if (!found) {
    throw new Error('Transactions link not found');
  }
})`;
    }
    
    if (text.includes('logged in and on the Transactions page')) {
      return `${keyword}('${text}', async function (this: any) {
  const page = this.page;
  
  console.log('🔐 Setting up authenticated state...');
  
  // Navigate to login page
  await page.goto(BASE_URL + '/sign-in', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Login
  await page.fill('input[type="email"], #email', TEST_EMAIL);
  await page.fill('input[type="password"], #password', TEST_PASSWORD);
  await page.click('button:has-text("Sign In"), button[type="submit"]');
  await page.waitForTimeout(5000);
  
  console.log('✅ User logged in and ready');
})`;
    }
    
    if (text.includes('maximizes the screen')) {
      return `${keyword}('${text}', async function (this: any) {
  const page = this.page;
  
  console.log('🖥️ Maximizing screen...');
  await page.setViewportSize({ width: 1920, height: 1080 });
  console.log('✅ Screen maximized');
})`;
    }
    
    if (text.includes('clicks on the "user-avatar"')) {      
      return `${keyword}('${text}', async function (this: any) {
  const page = this.page;
  
    // Click user avatar using scanned selector
  await page.waitForSelector('[data-test-id="user-avatar"], .avatar', { timeout: 10000 });
  await page.click('[data-test-id="user-avatar"], .avatar');
  console.log('✅ Clicked user avatar/menu');
  
  // Wait for dropdown to appear
  await page.waitForTimeout(2000);
})`;
    }

    if (text.includes('clicks on the "Sign Out" button')) {
      const signOutSelector = 'button:has-text("Sign Out")';
      
      return `${keyword}('${text}', async function (this: any) {
  const page = this.page;
  
   // Click on Sign Out link in the dropdown menu
  await page.waitForSelector('[role="menuitem"]:has-text("Sign Out"), button:has-text("Sign Out")', { timeout: 10000 });
  await page.click('[role="menuitem"]:has-text("Sign Out"), button:has-text("Sign Out")');
  console.log('✅ Clicked Sign Out link');
  
  // Wait for logout process to complete
  await page.waitForTimeout(3000);
  })`;
    }
    
    if (text.includes('logged out and redirected to the login page')) {
      return `${keyword}('${text}', async function (this: any) {
  const page = this.page;
  
  console.log('🔍 Verifying logout and redirect...');
  
  // Check URL contains sign-in
  await page.waitForFunction(() => window.location.href.includes('sign-in'), { timeout: 15000 });
  
  // Check for Sign In button
  const signInSelectors = ['button:has-text("Sign In")', 'button[type="submit"]', 'input[type="submit"]'];
  let found = false;
  for (const selector of signInSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 10000 });
      const element = await page.locator(selector);
      await expect(element).toBeVisible();
      console.log(\`✅ Found Sign In button using: \${selector}\`);
      found = true;
      break;
    } catch (error) {
      continue;
    }
  }
  
  if (!found) {
    throw new Error('Sign In button not found after logout');
  }
  
  console.log('✅ Successfully logged out and redirected to login page');
})`;
    }
    
    // Handle forgot password steps
    if (text.includes('Forgot email or password')) {
      const forgotSelector = loginElements?.forgotPasswordLink?.selectors?.[0] || 'a:has-text("Forgot email or password?")';
      
      return `${keyword}('${text}', async function (this: any) {
  const page = this.page;
  
  console.log('🖱️ Clicking forgot password link...');
  
  const forgotSelectors = ['${forgotSelector}', 'a:has-text("Forgot email or password?")', 'a:has-text("Forgot password")', 'a:has-text("Forgot")'];
  let clicked = false;
  for (const selector of forgotSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 10000 });
      await page.click(selector);
      console.log(\`✅ Clicked forgot password link using: \${selector}\`);
      clicked = true;
      break;
    } catch (error) {
      continue;
    }
  }
  
  if (!clicked) {
    throw new Error('Forgot password link not found');
  }
  
  await page.waitForTimeout(3000);
})`;
    }
    
    if (text.includes('I forgot my email address') && text.includes('radio')) {
      const radioSelector = forgotPasswordElements?.forgotEmailRadio?.selectors?.[0] || 'label:has-text("I forgot my email address")';
      
      return `${keyword}('${text}', async function (this: any) {
  const page = this.page;
  
  console.log('🖱️ Clicking forgot email radio button...');
  
  const radioSelectors = ['${radioSelector}', 'label:has-text("I forgot my email address")', '[value*="email"]', 'input[type="radio"] + label:has-text("email")'];
  let clicked = false;
  for (const selector of radioSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 10000 });
      await page.click(selector);
      console.log(\`✅ Clicked forgot email radio using: \${selector}\`);
      clicked = true;
      break;
    } catch (error) {
      continue;
    }
  }
  
  if (!clicked) {
    throw new Error('Forgot email radio button not found');
  }
})`;
    }
    
    if (text.includes('Next button')) {
      const nextSelector = forgotPasswordElements?.nextButton?.selectors?.[0] || 'button:has-text("Next")';
      
      return `${keyword}('${text}', async function (this: any) {
  const page = this.page;
  
  console.log('🖱️ Clicking Next button...');
  
  const nextSelectors = ['${nextSelector}', 'button:has-text("Next")', 'button[type="submit"]', 'input[type="submit"]'];
  let clicked = false;
  for (const selector of nextSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 10000 });
      await page.click(selector);
      console.log(\`✅ Clicked Next button using: \${selector}\`);
      clicked = true;
      break;
    } catch (error) {
      continue;
    }
  }
  
  if (!clicked) {
    throw new Error('Next button not found');
  }
  
  await page.waitForTimeout(3000);
})`;
    }
    
    // **FIXED: Handle "We've got you covered" with proper escaping**
    if (text.includes("We've got you covered")) {
      const originalText = "We've got you covered";
      const escapedText = this.escapeStepText(originalText);
      const messageSelector = successElements?.successMessage?.selectors?.[0] || `text="${escapedText}"`;
      
      return `${keyword}('${this.escapeStepText(text)}', async function (this: any) {
  const page = this.page;
  
  console.log('🔍 Verifying success message...');
  
  const messageSelectors = ['text="${escapedText}"', 'text="${escapedText}"', ':text("${escapedText}")', '[class*="message"]:has-text("covered")'];
  let found = false;
  for (const selector of messageSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 15000 });
      const element = await page.locator(selector);
      await expect(element).toBeVisible();
      console.log(\`✅ Found success message using: \${selector}\`);
      found = true;
      break;
    } catch (error) {
      continue;
    }
  }
  
  if (!found) {
    throw new Error('Success message not found');
  }
})`;
    }
    
    // Default fallback
    return `${keyword}('${text}', async function (this: any) {
  const page = this.page;
  console.log('⚠️ Default implementation for: ${text}');
  await page.waitForTimeout(1000);
})`;
  }

  private parseFeatureContent(content: string): any {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    const feature: any = { scenarios: [] };
    let currentScenario: any = null;

    for (const line of lines) {
      if (line.startsWith('Feature:')) {
        feature.name = line.replace('Feature:', '').trim();
      } else if (line.startsWith('Scenario:')) {
        if (currentScenario) {
          feature.scenarios.push(currentScenario);
        }
        currentScenario = {
          name: line.replace('Scenario:', '').trim(),
          steps: []
        };
      } else if (line.match(/^\s*(Given|When|Then|And|But)\s/)) {
        if (currentScenario) {
          const match = line.match(/^\s*(Given|When|Then|And|But)\s(.+)/);
          if (match) {
            currentScenario.steps.push({
              keyword: match[1],
              text: match[2]
            });
          }
        }
      }
    }

    if (currentScenario) {
      feature.scenarios.push(currentScenario);
    }

    return feature;
  }

  private buildTestFile(stepDefinitions: string): string {
    return `// Generated test with REAL selectors from DOM analysis
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL;

// Test data from environment variables
const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;

${stepDefinitions}
`;
  }
}

// Export for use
export default RealDOMScanner;