# FunPerf — API Test Automation & Performance Testing Framework

A flexible, scenario-driven test automation framework for both **API** and **frontend/browser** testing. Tests are configured via JSON or YAML files, allowing flexible test case management without modifying source code. It includes performance test generators for **k6**, **k6/browser**, and **Gatling**.

The **Calculator** module serves as a demo/test module. The **Browser** module demonstrates frontend UI testing with Playwright selectors, assertions, and configurable screenshots.

Key features:

- **Step Instances** — share browser contexts or API state across steps using `stepInstanceName`
- **Cross-Step Data References** — read and inject any value type (string, number, object, array) between steps via the `dataHandlerName.source.$.jsonPath` syntax
- **Modification API** — modify request payloads by parameter name or JSON Path
- **Validation API** — validate responses by parameter name or JSON Path, with `equal` or `include` modes
- **Attachments** — attach files (e.g. screenshots) to Allure reports from any step
- **Host Resolution** — resolve host aliases from `config.yaml` via `hostRef`
- **Performance Generators** — generate k6, k6/browser, and Gatling scripts from the same JSON/YAML scenarios
- **BDD Feature Generator** — generate Cucumber/Gherkin `.feature` files from JSON/YAML scenarios
- **Allure Reporting** — detailed test reports with assertion-level logging

## Technologies

- **Playwright** — test automation framework
- **TypeScript** — programming language
- **k6** — load testing (generated scripts)
- **k6/browser** — browser load testing (generated scripts)
- **Gatling** — load testing (generated TypeScript simulations)
- **Allure Report** — test reporting
- **Azure DevOps** — CI/CD and Test Plans integration
- **JUnit XML** — reporting format for pipelines

## Documentation

The framework ships with a [TypeDoc](https://typedoc.org/) API reference
covering every export in [`src/`](src/) and [`scripts/`](scripts/).

| Command | Description |
|---------|-------------|
| `npm run docs` | Build the HTML reference into `docs/` |
| `npm run docs:serve` | Serve the generated site locally on `http://localhost:8080` |
| `npm run docs:check` | CI gate: validate symbols without emitting files |

### GitHub Pages deployment

The [`.github/workflows/docs.yml`](.github/workflows/docs.yml) workflow builds the TypeDoc
site and deploys it to GitHub Pages on every push to `main`.

**One-time setup** (the workflow cannot enable Pages on its own — GitHub requires this
manual step, as the default `GITHUB_TOKEN` lacks admin permissions to create the Pages site):

1. Open **Settings → Pages** in the repository.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Save. The next workflow run will deploy to
   `https://<owner>.github.io/<repo>/`.

The generated `docs/` directory is git-ignored; the landing page
[`docs-index.md`](docs-index.md) is tracked and used by TypeDoc as the project
overview.

### Published reference (GitHub Pages)

Every push to `main` triggers the
[`docs.yml`](.github/workflows/docs.yml) workflow, which builds the TypeDoc site
and deploys it to GitHub Pages. Once enabled, the live reference is available at:

```
https://<owner>.github.io/<repo>/
```

**One-time setup** (repository administrator):

1. Go to **Settings → Pages** in the GitHub repository.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. (Optional) Trigger the workflow manually via the **Actions** tab using
   *Run workflow* on the `Build & Deploy TypeDoc to GitHub Pages` workflow.

The site rebuilds automatically on every change to `main`; no manual steps are
required afterwards.

## Project Structure

```
FunPerf/
├── .gitignore
├── .prettierrc.json
├── .prettierignore
├── azure-pipelines.yml           # CI/CD configuration
├── config.yaml                 # Default configuration
├── eslint.config.mjs          # ESLint configuration
├── LICENSE
├── package.json               # npm dependencies
├── playwright.config.ts       # Playwright configuration
├── playwright.unit.config.ts # Unit test configuration
├── README.md
├── tsconfig.json             # TypeScript configuration
├── schemas/                  # JSON Schemas for scenario validation
│   └── scenario-schema.json  # Main scenario schema referencing step sub-schemas
├── scripts/                  # Utility scripts
│   ├── generate-k6.ts        # k6 script generator
│   ├── generate-k6-browser.ts# k6/browser script generator
│   ├── generate-gatling.ts   # Gatling simulation generator
│   ├── generate-cucumber.ts  # Cucumber/Gherkin .feature file generator
│   ├── parse-test-results.ts # Parse JUnit results for Azure
│   ├── shared.ts             # Shared generator utilities
│   └── update-azure-test-results.ts # Update Azure Test Plans
├── src/                      # Source code
│   ├── config.ts             # Configuration loader from config.yaml + env vars
│   ├── test-modules/         # Test module implementations
│   │   ├── calculator/       # Calculator API step module
│   │   ├── authorized-calculator/  # OAuth2-authorized calculator module
│   │   └── browser/          # Browser UI step module (Playwright)
│   ├── scenario/             # Scenario loader & types
│   │   ├── data/             # Step data registry & cross-step reference resolution
│   │   │   ├── registry.ts   # In-memory store for step request/response data
│   │   │   └── resolve.ts    # Reference parser & resolver (e.g. stepName.response.$.path)
│   │   ├── loader.ts         # JSON/YAML file parsing, AJV schema validation, Scenario model
│   │   ├── instances.ts      # Step instance name/key utilities for multi-instance steps
│   │   ├── execution-context.ts # Runtime context: browser pages, hostRef state per instance
│   │   ├── modify.ts         # Modify request types & JSON path setter utility
│   │   └── types.ts          # ScenarioType enum (CALCULATOR, AUTHORIZED_CALCULATOR, BROWSER) & HostRef
│   ├── common/               # Shared utilities
│   │   ├── codegen.ts        # Code generation helpers for k6/Gatling output
│   │   ├── modifications.ts  # Modifier registry for in-flight payload changes
│   │   └── validations.ts    # Response validation (JSON path, parameter, equal/include)
│   ├── gatling/              # Gatling generator framework
│   │   ├── interface.ts      # GatlingStepGenerator interface
│   │   ├── common.ts         # Shared TypeScript code generation utilities
│   │   └── registry.ts       # Generator registry singleton
│   ├── k6/                   # k6 generator framework
│   │   ├── interface.ts      # K6StepGenerator interface
│   │   ├── common.ts         # Shared JavaScript code generation utilities
│   │   └── registry.ts       # Generator registry singleton
│   ├── mock/                 # Mock server (Express) for calculator & auth endpoints
│   ├── allure/               # Allure helpers
│   └── utils/                # Utilities
│       └── logging-expect.ts # Allure-aware Playwright expect wrapper with JSON attachments
├── tests/                    # Test files
│   ├── scenarios/            # JSON/YAML scenario files (demo scenarios)
│   ├── data/                 # Test data files (e.g. authorized-users.txt)
│   ├── unit/                 # Unit tests
│   │   ├── resolve-references.spec.ts  # Step data registry & reference resolution
│   │   └── step-instances.spec.ts      # Step instance isolation tests
│   └── scenario-loader.spec.ts   # Main integration test runner
├── performance_scripts/      # Generated performance test scripts (k6 JS, Gatling TS)
│   └── gatling/
│       └── performance-test.gatling.ts
├── features/                 # Generated Cucumber/Gherkin .feature files
└── plans/                    # Architecture & design documents
    └── 2026-06-01-funperf-review.md
```

## Requirements

- Node.js 18.x or later
- npm or yarn
- Java JDK 17+ (required for Allure report generation and Gatling performance tests)
- k6/browser requires k6 0.0.0+ with browser support

## Installation

```bash
npm install
```

## Configuration

Configuration is in [`config.yaml`](config.yaml):

```yaml
calculator:
  url: http://localhost:3000

hosts:
  frontendMain: https://playwright.dev
  frontendDocs: https://playwright.dev
  calcApi: http://localhost:3000

test:
  file_path: tests/scenarios/calculator-demo.yaml
  timeout_ms: 30000
```

Environment variables can override YAML values (e.g. `calculator.url`, `TEST_FILE_PATH`, `TEST_TIMEOUT_MS`).

`test.file_path` and `TEST_FILE_PATH` can point to either `.json`, `.yaml`, or `.yml` scenario files.

Step-level host selection:

- Use `hostRef` on a step (`CALCULATOR` and `BROWSER`) to select host alias from `hosts` map.
- Relative browser paths (like `/docs`) and calculator endpoints are resolved as `hostname + path`.
- Absolute URLs still work and bypass host composition.
- Legacy `additionalData.baseUrl` for browser remains as fallback when `hostRef` is not provided.

### Mock Server

The mock server runs on port 3000 by default. Override with `MOCK_PORT` environment variable.

```bash
MOCK_PORT=8080 npm run mock:start
```

## Verification & Compilation

### TypeScript Type Check (no output files)

```bash
npx tsc --noEmit
```

This checks the entire project for type errors without generating files, using [`tsconfig.json`](tsconfig.json).

### Full Compilation (generate dist/)

```bash
npx tsc
```

Output goes to the `dist/` directory as configured in [`tsconfig.json`](tsconfig.json:10).

### Lint & Format Check

```bash
npm run lint
npm run format:check
```

### Full Project Verification

```bash
npm run lint && npm run format:check && npx tsc --noEmit
```

### Generate Performance Scripts (verifies generators)

```bash
npm run k6:generate
npm run k6:browser:generate
npm run gatling:generate
npm run cucumber:generate
```

## Running Tests

### Locally

```bash
# Run all tests
npx playwright test

# Run calculator tests with mock server
npm run test:calc

# Run with cleanup and Allure report generation
npm run test:allure
```

### Unit Tests

```bash
# Run all unit tests
npx playwright test tests/unit/ --reporter=list

# Run a specific unit test file
npx playwright test tests/unit/resolve-references.spec.ts --reporter=list

# Run step instances unit tests
npx playwright test tests/unit/step-instances.spec.ts --reporter=list
```

### In CI/CD Mode

```bash
npm run test:ci
```

## Reporting

### Allure Report

```bash
# Generate report
npm run allure:generate

# Open report in browser
npm run allure:open
```

### JUnit XML

Reports in JUnit format are generated in the `test-results/` directory and can be used by CI/CD tools (e.g., Azure DevOps, Jenkins).

## Azure DevOps Integration

The project includes full Azure DevOps integration:

- **Azure Pipelines** — automatic test execution on each build
- **Azure Test Plans** — synchronization of test results with test cases
- **Publish Test Results** — publishing results in JUnit format
- **Allure Reports** — artifacts with detailed reports

### Pipeline Environment Variables

- `calculator.url` — Calculator API base URL
- `AZURE_DEVOPS_ORG_URL` — Azure DevOps organization URL
- `AZURE_DEVOPS_PROJECT` — project name
- `AZURE_DEVOPS_TEST_PLAN_ID` — test plan ID
- `AZURE_DEVOPS_TEST_SUITE_ID` — test suite ID

### TEST_CASE_STRING Environment Variable

The `TEST_CASE_STRING` environment variable allows passing test scenarios as a JSON string directly, without a file. This is useful for:
- Quick testing without file I/O
- CI/CD pipelines with dynamic test selection
- Command-line test execution

Example usage in CI/CD:
```bash
TEST_CASE_STRING='[{"scenarioName":"Test 1","steps":[]}]' npm run test:ci
```

## Performance Testing

The project includes performance test generators for both **k6**, **k6/browser**, and **Gatling**. All generators read the same scenario files from `tests/scenarios/` (`.json`, `.yaml`, `.yml`) and produce executable performance test scripts.

### Authorized Calculator Demo

The repository now includes an OAuth2-like auth demo for an independent calculator module.

- Scenario file: [`tests/scenarios/authorized-calculator-demo.json`](tests/scenarios/authorized-calculator-demo.json)
- Demo credentials: [`tests/data/authorized-users.txt`](tests/data/authorized-users.txt)
- Mock token endpoint: `POST /oauth/token`
- Authorized endpoints: `/authorized/api/calc/add` and `/authorized/api/calc/multiply`

The demo scenario is designed to:

- pick a random user from the credentials file
- reuse a cached token when it is still active
- request a fresh token when the cached token is missing or expired
- run calculator operations with `Authorization: Bearer <token>`

Environment variables for the mock server:

| Variable | Default | Description |
|---|---|---|
| `MOCK_USERS_FILE` | `tests/data/authorized-users.txt` | Path to the `username:password` credentials file |
| `MOCK_TOKEN_TTL_SECONDS` | `3600` | Token lifetime in seconds |

### Gatling (TypeScript SDK)

Generates a TypeScript simulation file using the `@gatling.io/core` and `@gatling.io/http` SDKs.

```bash
# Generate the simulation from scenario JSON files
npm run gatling:generate

# Run the simulation
npm run gatling:run

# Generate and run together
npm run gatling:all
```

**Configuration (environment variables):**

| Variable | Default | Description |
|---|---|---|
| `calculator.url` | `http://localhost:3000` | Calculator API base URL |
| `AUTH_TOKEN` | `''` | Authorization bearer token |
| `GATLING_USERS_PER_SEC` | `5` | Constant users per second |
| `GATLING_DURATION_SECONDS` | `60` | Test duration in seconds |
| `GATLING_SCENARIO_INDEX` | `-1` | Run a specific scenario by index (-1 = all) |

**Architecture:**

The Gatling generator follows the same registry pattern as the k6 generator:

- `src/gatling/interface.ts` — `GatlingStepGenerator` interface
- `src/gatling/common.ts` — Shared utilities for TypeScript code generation
- `src/gatling/registry.ts` — Registry singleton
- `src/test-modules/*/gatling.ts` — Per-step-type generators
- `scripts/generate-gatling.ts` — Main generator script

To add a new step type, implement `GatlingStepGenerator` and register it in `src/gatling/registry.ts`.

### k6

Generates a JavaScript k6 script from scenario JSON files.

```bash
# Generate the k6 script
npm run k6:generate

# Run with k6
npm run k6:run

# Run with JSON output
npm run k6:run:json

# Run with web dashboard
npm run k6:dashboard

# Generate and run together
npm run k6:all
```

The generated script is located at `performance_scripts/k6/performance-test.js`.

### k6/browser

Generates a JavaScript k6/browser script from scenario JSON files containing browser steps.

```bash
# Generate the browser script
npm run k6:browser:generate

# Run with k6/browser
npm run k6:browser:run

# Run with web dashboard
npm run k6:browser:run:live

# Generate and run together
npm run k6:browser:all
```

**Configuration (environment variables):**

| Variable | Default | Description |
|---|---|---|
| `K6_BROWSER_SCENARIO_INDEX` | `0` | Choose one generated scenario by index (0 = run all) |
| `K6_BROWSER_VUS` | `1` | Number of VUs |
| `K6_BROWSER_ITERATIONS` | `1` | Iterations count |
| `K6_BROWSER_MAX_DURATION` | `10m` | Max scenario duration |
| `K6_BROWSER_BASE_URL` | `http://localhost:3000` | Fallback base URL when step has no additionalData.baseUrl |
| `K6_BROWSER_SCREENSHOTS` | `on` | Global screenshots switch: `on` (default) or `off` |

**Architecture:**

The k6/browser generator follows the same registry pattern as the k6 generator:

- `src/k6/interface.ts` — `K6StepGenerator` interface
- `src/k6/common.ts` — Shared utilities for JavaScript code generation
- `src/k6/registry.ts` — Registry singleton
- `src/test-modules/*/k6.ts` — Per-step-type generators
- `scripts/generate-k6.ts` — Main generator script
- `scripts/generate-k6-browser.ts` — Browser-specific generator script

To add a new step type, implement `K6StepGenerator` and register it in `src/k6/registry.ts`.

### Cucumber / Gherkin (.feature files)

Generates human-readable BDD-style `.feature` files (Gherkin syntax) from the same scenario files. One `.feature` file is produced per scenario file. The generated files are saved in the `features/` directory.

```bash
# Generate .feature files
npm run cucumber:generate
```

**Example output** (from `calculator-demo.yaml`):

```gherkin
Feature: Calculator Demo
  As a system user
  I want to test the system functionality
  So that I can verify the system works correctly

  Scenario: Basic addition: 3 + 5 = 8 (jsonPath style)
    Given field at '$.a' is set to '3'
    Given field at '$.b' is set to '5'
    When 'add' operation is performed
    Then response should have status code 200
    And field at '$.result' should be equal to '8'
```

**Supported step types:**

| Step type | Generated Gherkin |
|---|---|
| `CALCULATOR` / `AUTHORIZED_CALCULATOR` | `Given parameter/field …`, `When operation is performed`, `Then status code …`, `And field should be …` |
| `BROWSER` | `When user navigates/clicks/fills/presses …`, `Then URL/element should …`, `When user extracts …` |

Cross-step data references (e.g. `firstAdd.response.$.result`) are automatically recognised and rendered as readable `Given parameter … is set to value from step '…' field '…'` lines.

**Generator source:** [`scripts/generate-cucumber.ts`](scripts/generate-cucumber.ts)

### Scenario Format Conversion

You can convert scenario files between JSON and YAML with:

```bash
npm run scenario:convert -- --input tests/scenarios/calculator-demo.yaml --to json
npm run scenario:convert -- --input tests/scenarios/browser-demo.json --to yaml
```

By default, the converter writes a sibling file with the target extension. Use `--output <path>` to control the destination path explicitly.

## Scenario Schema Validation

Every scenario file (`.json`, `.yaml`, `.yml`) is parsed into the same in-memory structure and then validated against a JSON Schema before execution.

- **Main schema**: [`schemas/scenario-schema.json`](schemas/scenario-schema.json) — defines the `Scenario` and `Step` structures
- **Step-type sub-schemas**: referenced via `$ref` from each test module's `step-*.json` file:
  - `src/test-modules/calculator/step-calculator.json`
  - `src/test-modules/authorized-calculator/step-authorized-calculator.json`
  - `src/test-modules/browser/step-browser.json`

Validation is performed by [`src/scenario/loader.ts`](src/scenario/loader.ts:69) using the AJV library. Sub-schemas are loaded at startup and registered by their normalized internal paths.

## Framework Features

### Step Instances

By default, each step type shares a single runtime state (browser page, hostRef). To isolate state, use the `stepInstanceName` property on a step:

```json
{
  "stepName": "First calculator",
  "stepType": "CALCULATOR",
  "stepInstanceName": "instanceA",
  "hostRef": "calcApi",
  "returnCode": 200,
  "additionalData": { "operation": "add" },
  "modifyRequests": [
    { "jsonPath": "$.a", "modifiedValue": 5 },
    { "jsonPath": "$.b", "modifiedValue": 3 }
  ]
}
```

- Steps with the same `stepType` + `stepInstanceName` share the same state (browser page, `currentHostRef`).
- A missing `stepInstanceName` defaults to `"default"` per [`src/scenario/instances.ts`](src/scenario/instances.ts:1).
- For the `BROWSER` step type, a non-default `stepInstanceName` creates a **new browser context** (isolated cookies, localStorage, etc.) via [`src/scenario/execution-context.ts`](src/scenario/execution-context.ts:66).

### Cross-Step Data References

Steps can read data from **earlier steps** and inject it into payloads or browser instructions. The syntax is:

```
<dataHandlerName>.<source>.<jsonPath>
```

The reference **preserves the original value type** — if it points to a number, object, array, boolean, or null, that exact typed value is injected (not coerced to string). This works because [`resolveReference()`](src/scenario/data/resolve.ts:83) returns the value directly through `jsonpath-plus`, and [`resolveModifyReferences()`](src/scenario/data/resolve.ts:85) assigns `modifiedValue` without string casting for `jsonPath`-based modifications.

**Typing rules:**
- Reference used via `jsonPath` → original type is preserved (number, object, array, boolean, string, null)
- Reference used via `modifiedParameter` → value is coerced to string (see [`resolveModifyReferences()`](src/scenario/data/resolve.ts:94-98))
- Reference used in a browser instruction `value` → value is coerced to string

Steps can reference data from **earlier steps** using the syntax:

```
<dataHandlerName>.<source>.<jsonPath>
```

Where:

- `dataHandlerName` — the `dataHandlerName` value of a previous step
- `source` — one of `request`, `response`, or `context`
- `jsonPath` — optional JSON path expression starting with `$.`

#### Examples

Reference a specific response value:
```json
{
  "stepName": "Multiply previous result",
  "stepType": "CALCULATOR",
  "hostRef": "calcApi",
  "returnCode": 200,
  "additionalData": { "operation": "multiply" },
  "modifyRequests": [
    { "jsonPath": "$.a", "modifiedValue": "calcSeed.response.$.result" },
    { "modifiedParameter": "b", "modifiedValue": "10" }
  ]
}
```

Reference the whole response object (injects as a nested object):
```json
{ "jsonPath": "$.meta.previousStep", "modifiedValue": "calcMul.response" }
```

Reference browser-extracted data:
```json
{ "kind": "action", "action": "goto", "value": "browserDocs.response.$.extracted.docsUrl" }
```

The reference resolver is implemented in [`src/scenario/data/resolve.ts`](src/scenario/data/resolve.ts). It uses `jsonpath-plus` for JSON path evaluation and supports array indexing (e.g. `$.domain.createdGuids[0]`).

The `StepDataRegistry` in [`src/scenario/data/registry.ts`](src/scenario/data/registry.ts) stores `request`, `response`, and `context` data for each `dataHandlerName` during test execution.

### Modification API

Steps can modify request payloads using the `modifyRequests` array. Two formats are supported:

**By parameter name** (legacy, string value only):
```json
{ "modifiedParameter": "a", "modifiedValue": "12" }
```

**By JSON Path** (supports typed values: number, boolean, object, array):
```json
{ "jsonPath": "$.b", "modifiedValue": 8 }
{ "jsonPath": "$.meta.tags", "modifiedValue": ["smoke", "regression"] }
{ "jsonPath": "$.enabled", "modifiedValue": true }
```

The modification logic is handled by:
- [`src/scenario/modify.ts`](src/scenario/modify.ts) — `setByJsonPath()` utility
- [`src/common/codegen.ts`](src/common/codegen.ts) — `generateModification()` for performance script generation
- [`src/common/modifications.ts`](src/common/modifications.ts) — `ModifierRegistry` for runtime `modifiedParameter` lookups

### Validation API

Response validation is configured via the `validateResponse` array on each step:

```json
"validateResponse": [
  { "validatedParameter": "result", "validatedParameterValue": "20" },
  { "jsonPath": "$.operation", "validatedParameterValue": "add", "validationType": "equal" }
]
```

**Options:**

| Field | Required | Description |
|---|---|---|
| `validatedParameter` | conditional | Parameter name (for simple top-level checks) |
| `jsonPath` | conditional | JSON path expression |
| `validatedParameterValue` | yes | Expected value as string |
| `validationType` | no | `"equal"` (default) or `"include"` |
| `validatedParameterDescription` | no | Custom description for Allure reporting |

The validation engine is in [`src/common/validations.ts`](src/common/validations.ts):

- `validateApiResponse()` — iterates over all validation entries
- `validateJsonPath()` — evaluates a JSON path against a response
- `assertValidation()` — delegates to Allure-aware `expectWithDescription` from [`src/utils/logging-expect.ts`](src/utils/logging-expect.ts)

### Attachments

Steps can attach files to the Allure report using the `addAttachments` array:

```json
{
  "stepName": "Screenshot step",
  "stepType": "BROWSER",
  "returnCode": 200,
  "addAttachments": [
    { "path": "screenshots/example.png" }
  ]
}
```

The `hasStepAttachments()` function in [`src/scenario/loader.ts`](src/scenario/loader.ts:115) checks for attachments before processing.

### Step Data (context)

The `data` module supports a third source — `context` — which stores step-level metadata:
- `currentUrl` — current browser URL (set after browser actions)
- `extracted` — values extracted via browser `extract` instructions

Browser extraction example:
```json
{
  "kind": "extract",
  "extract": "url",
  "saveAs": "docsUrl"
},
{
  "kind": "extract",
  "extract": "textContent",
  "selector": { "kind": "css", "value": "h1" },
  "saveAs": "docsHeading"
}
```

These can be referenced as `dataHandler.response.$.extracted.docsUrl` or `dataHandler.response.$.currentUrl`.

## Scenario Runner Details

### StepData Interface

Each step in a scenario file maps to the `StepData` type defined in [`src/scenario/loader.ts`](src/scenario/loader.ts:16):

| Property | Type | Description |
|---|---|---|
| `stepName` | `string` | Human-readable step name (displayed in Allure) |
| `stepInstanceName` | `string?` | Instance key for state isolation |
| `stepType` | `ScenarioType` | One of `CALCULATOR`, `AUTHORIZED_CALCULATOR`, `BROWSER` |
| `dataHandlerName` | `string?` | Name for cross-step data references |
| `returnCode` | `number` | Expected HTTP status code |
| `modifyRequests` | `ModifyRequest[]?` | Payload modifications |
| `addAttachments` | `AddAttachment[]?` | Files to attach to Allure report |
| `validateResponse` | `BaseValidation[]?` | Response validation rules |
| `additionalData` | `object?` | Step-type-specific configuration (e.g. `operation`, `instructions`) |
| `hostRef` | `HostRef?` | Host alias from `config.yaml` |

## Adding a New Step Type

To add a new API step type to the framework:

1. Create a new module under `src/test-modules/<your-module>/`
2. Implement the required files: `builder.ts`, `config.ts`, `generator.ts`, `response.ts`, `validations.ts`, `modifications.ts`
3. Implement `k6.ts` (implements `K6StepGenerator`) and `gatling.ts` (implements `GatlingStepGenerator`)
4. Register your generators in `src/k6/registry.ts` and `src/gatling/registry.ts`
5. Add your step type to `ScenarioType` enum in `src/scenario/types.ts`
6. Update `src/scenario/loader.ts` to use your builder/response types
7. Create a JSON schema in `schemas/` and register it in `src/scenario/loader.ts`
8. Add scenario files (`.json` or `.yaml`) in `tests/scenarios/`

## Helper Scripts

### Parsing Test Results

```bash
npx tsx scripts/parse-test-results.ts
```

Parses JUnit XML results and maps them to Azure Test Plan scenarios.

### Updating Azure Test Plans

```bash
npx tsx scripts/update-azure-test-results.ts
```

Updates test results in Azure DevOps Test Plans based on parsed results.
## Classic Playwright Browser Tests

Besides JSON/YAML-driven scenarios, the project also supports classic Playwright frontend tests written directly in TypeScript.

These tests live in `tests/e2e/` and use a dedicated config file: `playwright.e2e.config.ts`. They are intentionally isolated from the scenario runner, so `npm test` does not execute them.

### Run classic frontend tests

```bash
npm run test:e2e
```

Run only Chromium:

```bash
npm run test:e2e:chromium
```

Open Playwright UI mode:

```bash
npm run test:e2e:ui
```

Debug mode:

```bash
npm run test:e2e:debug
```

Run with visible browser and generate Allure report (full pipeline: clean → headed tests → generate → open):

```bash
npm run test:e2e:allure
```

This one-liner cleans `allure-results`, `allure-report`, `playwright-report-e2e`, runs the Chromium e2e tests with `--headed`, generates the Allure report and opens it in your browser.

### Structure

```text
tests/e2e/
├── fixtures.ts
├── pages/
│   ├── base.page.ts
│   └── playwright-docs.page.ts
├── homepage.spec.ts
└── docs.spec.ts
```

The shared fixture in `tests/e2e/fixtures.ts` exposes:

- `frontendBaseUrl` resolved from `config.hosts.frontendMain` in `config.yaml`
- `loggedExpect`, backed by the framework assertion logger
- `captureScreenshot`, helper that attaches a page screenshot to Allure when the strategy is active

Use this import style in classic frontend tests:

```ts
import { test, expect } from './fixtures';
```

This keeps regular Playwright tests independent from scenario YAML/JSON while reusing the framework's existing configuration and Allure reporting helpers.

### Conditional screenshots

Screenshots are captured only when they are useful for debugging — never during quiet headless CI runs.

The strategy is resolved, in priority order, from:

1. `E2E_SCREENSHOTS` environment variable (explicit override).
2. Playwright `--debug` / `--headed` flags (auto-detected).
3. Default: disabled.

| Run mode                                            | Screenshots |
|----------------------------------------------------|-------------|
| `npm run test:e2e:chromium` (headless)            | disabled    |
| `npm run test:e2e:headed` (`--headed`)            | enabled     |
| `npm run test:e2e:debug` (`--debug`)              | enabled     |
| `E2E_SCREENSHOTS=on npm run test:e2e:chromium`    | enabled     |
| `E2E_SCREENSHOTS=off npm run test:e2e:headed`     | disabled    |

Accepted values for `E2E_SCREENSHOTS`: `on` / `off`, `always` / `never`, `1` / `0`, `true` / `false`.

Capture a screenshot from any classic test:

```ts
test('my test', async ({ page, captureScreenshot }) => {
  await page.goto('/');
  await captureScreenshot('After navigation');
  await captureScreenshot('After action', false); // second arg = fullPage
});
```

When the strategy is disabled, `captureScreenshot` is a no-op, so the same test code runs unchanged in both modes.

### Allure report

Classic E2E tests share the same `allure-results/` directory as scenario tests, so a single Allure report contains both when executed together. To get a clean report containing only classic E2E results:

```bash
rm -rf allure-results allure-report && npm run test:e2e:chromium && npm run allure:report
```

