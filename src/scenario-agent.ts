// src/scenario-agent.ts
// Add at the very top, before any imports
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
process.env.LANGCHAIN_TRACING_V2 = "false";
process.env.LANGCHAIN_DISABLE_SSL_VERIFICATION = "true";

//import { ChatAnthropic } from "@langchain/anthropic";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { AzureChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import "dotenv/config";
import fs from "fs";
import path from "path";
import gherkinParse from "gherkin-parse";

// Set up the Azure OpenAI LLM
const llm = new AzureChatOpenAI({
  // Optionally specify deploymentName, endpoint, etc. if needed
  // deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  // azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
  // azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_INSTANCE_NAME,
  // azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION,
  // azureOpenAIApiEndpoint: process.env.AZURE_OPENAI_API_ENDPOINT,
  timeout: 60000,
});

// Prompt template for Playwright code generation
const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a helpful assistant that writes Playwright test code in TypeScript for each described step.",
  ],
  new MessagesPlaceholder("messages"),
]);

// Compose the agent as a simple runnable sequence
export const app = RunnableSequence.from([
  prompt,
  llm,
  // Ensure the output is always in the expected format for [generate-from-feature.ts](http://_vscodecontentref_/2)
  async (msg) => {
    // msg is an AIMessage or similar
    // Wrap in array for compatibility with [generate-from-feature.ts](http://_vscodecontentref_/3)
    return { messages: [msg] };
  },
]);

// Example usage: call the agent with some input and handle the response
async function runAgent() {
  const input = {
    messages: [
      { role: "user", content: "Write a Playwright test that logs into a website." }
    ]
  };
  const response = await app.invoke(input);

  console.log("Agent response:", JSON.stringify(response, null, 2));
  let code = "// No code generated\n";
  if (response && response.messages && response.messages[0] && response.messages[0].content) {
    code = response.messages[0].content;
    // Optionally strip code fences
    if (typeof code === "string" && code.startsWith("```")) {
      code = code.replace(/^```[a-z]*\n?/, "").replace(/```$/, "");
    }
  }
  console.log("Extracted code:", code);

  const outputFilePath = "output.ts"; // Specify your output file path here
  fs.writeFileSync(outputFilePath, code, "utf-8");
}

runAgent().catch(console.error);

// For generating code from scenarios
export async function generateCodeFromScenarios(
  scenarios: Array<{ title?: string; steps: Array<{ keyword: string; text: string }> }>,
  language: string
) {
  let generatedCode = "";
  for (const scenario of scenarios) {
    generatedCode += `// Scenario: ${scenario.title || "Unnamed"}\n`;
    for (const step of scenario.steps) {
      const input = {
        messages: [
          {
            role: "user",
            content: `Generate Playwright test code in TypeScript for this step: "${step.keyword} ${step.text}"`,
          },
        ],
        language,
      };
      const config = { configurable: { thread_id: "feature-gen" } };
      const response = await app.invoke(input, config);

      // Extract code as you do in runAgent
      let code = "// No code generated\n";
      if (response && response.messages && response.messages[0] && response.messages[0].content) {
        const content = response.messages[0].content;

        // Extract all code blocks (```...```)
        const codeBlocks: string[] = [];
        const codeBlockRegex = /```(?:typescript|ts)?\s*([\s\S]*?)```/g;
        let match: RegExpExecArray | null;
        while ((match = codeBlockRegex.exec(content)) !== null) {
          codeBlocks.push(match[1].trim());
        }
        if (codeBlocks.length > 0) {
          code = codeBlocks.join('\n\n');
        } else {
          // Fallback: keep only lines that look like Playwright code
          code = content
            .split('\n')
            .filter((line: string) =>
              line.trim().startsWith("import ") ||
              line.trim().startsWith("export ") ||
              line.trim().startsWith("test(") ||
              line.trim().startsWith("async ") ||
              line.trim().startsWith("await ") ||
              line.trim().startsWith("const ") ||
              line.trim().startsWith("let ") ||
              line.trim().startsWith("function ") ||
              line.trim().startsWith("{") ||
              line.trim().startsWith("}") ||
              line.trim().startsWith("page.") ||
              line.trim().startsWith("expect(") ||
              line.trim().startsWith("await expect(")
            )
            .join('\n');
        }
      }
      generatedCode += `${code}\n\n`;
    }
  }
  console.log("Final generatedCode:\n", generatedCode);
  return generatedCode;
}

// For generating code from feature files
export async function generateCodeFromFeatureFiles(
  files: string[],
  featuresDir: string,
  outputDir: string,
  language: string
) {
  for (const file of files) {
    const filePath = path.join(featuresDir, file);
    const gherkinDoc = parseFeatureFile(filePath);
    const scenarios = gherkinDoc.scenarios || [];

    let generatedCode = `// Auto-generated from ${file}\n\n`;

    // Collect all code blocks from all steps
    let allCodeBlocks: string[] = [];

    for (const scenario of scenarios) {
      for (const step of scenario.steps) {
        const input = {
          messages: [
            {
              role: "user",
              content: `Generate Playwright test code in TypeScript for this step: "${step.keyword} ${step.text}"`,
            },
          ],
          language,
        };
        const config = { configurable: { thread_id: "feature-gen" } };
        const response = await app.invoke(input, config);

        if (response && response.messages && response.messages[0] && response.messages[0].content) {
          const content = response.messages[0].content;

          // Extract code blocks
          const codeBlockRegex = /```(?:typescript|ts)?\s*([\s\S]*?)```/g;
          let match: RegExpExecArray | null;
          let foundBlock = false;
          while ((match = codeBlockRegex.exec(content)) !== null) {
            allCodeBlocks.push(match[1].trim());
            foundBlock = true;
          }
          // If no code block, fallback: keep only lines that look like Playwright code
          if (!foundBlock) {
            allCodeBlocks.push(
              content
                .split('\n')
                .filter((line: string) =>
                  line.trim().startsWith("import ") ||
                  line.trim().startsWith("export ") ||
                  line.trim().startsWith("test(") ||
                  line.trim().startsWith("async ") ||
                  line.trim().startsWith("await ") ||
                  line.trim().startsWith("const ") ||
                  line.trim().startsWith("let ") ||
                  line.trim().startsWith("function ") ||
                  line.trim().startsWith("{") ||
                  line.trim().startsWith("}") ||
                  line.trim().startsWith("page.") ||
                  line.trim().startsWith("expect(") ||
                  line.trim().startsWith("await expect(")
                )
                .join('\n')
            );
          }
        }
      }
    }

    // Combine all code blocks into one string
    const allCode = allCodeBlocks.join('\n\n');

    // Split into lines for processing
    const lines = allCode.split('\n');

    // Separate and deduplicate imports
    const importSet = new Set<string>();
    const codeLines: string[] = [];
    for (const line of lines) {
      if (line.trim().startsWith('import ')) {
        importSet.add(line.trim());
      } else if (
        !line.trim().startsWith('export ') && // Optionally allow exports if needed
        !line.trim().startsWith('//') &&      // Remove comments
        line.trim().startsWith('Explanation of') &&
        line.trim().startsWith('Here’s') &&
        line.trim().startsWith('1.') &&
        line.trim().startsWith('2.') &&
        line.trim().startsWith('3.') &&
        line.trim().startsWith('```') &&
        line.trim() !== ""
      ) {
        codeLines.push(line);
      }
    }

    // Compose the final code: imports at the top, then code
    const finalCode =
      Array.from(importSet).join('\n') +
      '\n\n' +
      codeLines.join('\n') +
      '\n';

    // Log before writing
    console.log("Final generatedCode for", file, ":\n", finalCode);

    const baseName = path.basename(file, ".feature");
    const outputFilePath = path.join(outputDir, `${baseName}.ts`);
    fs.writeFileSync(outputFilePath, finalCode, "utf-8");
    console.log(`Generated code saved to: ${outputFilePath}`);
  }
}

function parseFeatureFile(filePath: string) {
  return gherkinParse.convertFeatureFileToJSON(filePath);
}

// Add this to your system prompt
const systemPrompt = `You are an expert Playwright test automation assistant.

NAVIGATION RULES:
- Login page navigation: ALWAYS use BASE_URL + '/signin'
- Never use BASE_URL + '/login'
- All navigation should follow BASE_URL + '/path' pattern

When generating step definitions:
1. Use proper navigation URLs (signin not login)
2. Include proper waits before assertions
3. Use consistent 'page' reference
4. Generate TypeScript with proper types
5. Follow Cucumber step definition format
`;
