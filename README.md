# AI-Playwright-POC
# Author: Shreeharsha M N

A proof-of-concept Node.js/TypeScript project for building and running agents using Open AI and Lang Chain

## Project Details
1. # Automated Playwright Test Code Generation from Gherkin Features
Reads Gherkin .feature files (using gherkin-parse).
Extracts scenarios and steps from each feature file.
For each step, prompts an LLM (Azure OpenAI via LangChain) to generate Playwright test code in TypeScript.
Writes the generated code into corresponding .ts files in a generated folder.

2. # Agentic AI Orchestration with LangChain
Uses LangChain’s RunnableSequence to compose a pipeline:
Prompt template: Instructs the LLM to act as a Playwright code generator.
LLM node: Calls Azure OpenAI with the prompt and user message.
Output formatting node: Ensures the response is always in a consistent { messages: [...] } format for downstream processing.
This agentic setup allows for flexible, modular, and reusable AI workflows.

3. # Environment and Extensibility
Environment variables are used for secure LLM API configuration.
The system is extensible: you can add more feature files, change the prompt, or swap out the LLM with minimal code changes.

# In a nutshell:
Project POC uses LangChain’s agentic AI to automate the translation of Gherkin feature steps into Playwright test code, orchestrated through a modular, prompt-driven pipeline, and outputs the results as ready-to-use TypeScript test files.

## Getting Started

### Prerequisites

- Node.js (v20 or higher required)
- yarn

### Installation

1.  Clone the repository
2.  Create the `.env` file, then update required API keys, base url and credentials.
3.  Install dependencies

```
npm install 
```

```
npx playwright install
```

### Usage

clean the generated reports
```
npm run reports:clean
```

scan the features
```
npm run scan:features
```

Run the tests
```
npm run test:generated-with-reports
```

Open the reports
```
npm run reports:open
```

