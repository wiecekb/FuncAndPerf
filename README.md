# FunPerf — API Test Automation & Performance Testing Framework

A flexible, scenario-driven API test automation and performance testing framework built on Playwright, k6, and Gatling.

## Description

This project provides a framework for verifying API endpoints through JSON-defined scenarios. Tests are configured via JSON files, allowing flexible test case management without modifying source code. It includes performance test generators for both **k6** and **Gatling**.

The **Calculator** module serves as a demo/test module showing how to add new step types to the framework.

## Technologies

- **Playwright** — test automation framework
- **TypeScript** — programming language
- **k6** — load testing (generated scripts)
- **Gatling** — load testing (generated TypeScript simulations)
- **Allure Report** — test reporting
- **Azure DevOps** — CI/CD and Test Plans integration
- **JUnit XML** — reporting format for pipelines

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
├── scripts/                  # Utility scripts
├── src/                      # Source code
│   ├── config.ts             # Configuration loader
│   ├── test-modules/         # Test module implementations
│   ├── scenario/             # Scenario loader & types
│   ├── common/               # Shared utilities
│   ├── gatling/              # Gatling generator framework
│   ├── k6/                   # k6 generator framework
│   ├── mock/                 # Mock server
│   ├── allure/               # Allure helpers
│   └── utils/                # General utilities
├── tests/                    # Test files
│   ├── scenarios/            # JSON scenario files
│   ├── unit/                 # Unit tests
│   └── scenario-loader.spec.ts   # Main test runner
└── performance_scripts/      # Generated performance test scripts
```

## Requirements

- Node.js 18.x or later
- npm or yarn
- Java JDK 17+ (required for Allure report generation and Gatling performance tests)

## Installation

```bash
npm install
```

## Configuration

Configuration is in [`config.yaml`](config.yaml):

```yaml
calculator:
  url: http://localhost:3000

test:
  file_path: tests/scenarios/calculator-demo.json
  timeout_ms: 30000
```

Environment variables can override YAML values (e.g. `calculator.url`, `TEST_FILE_PATH`, `TEST_TIMEOUT_MS`).

### Mock Server

The mock server runs on port 3000 by default. Override with `MOCK_PORT` environment variable.

```bash
MOCK_PORT=8080 npm run mock:start
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

The project includes performance test generators for both **k6** and **Gatling**. Both generators read the same JSON scenario files from `tests/scenarios/` and produce executable performance test scripts.

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
| | `calculator.url` | `http://localhost:3000` | Calculator API base URL |
| | `AUTH_TOKEN` | `''` | Authorization bearer token |
| | `GATLING_USERS_PER_SEC` | `5` | Constant users per second |
| | `GATLING_DURATION_SECONDS` | `60` | Test duration in seconds |
| | `GATLING_SCENARIO_INDEX` | `-1` | Run a specific scenario by index (-1 = all) |

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

## Adding a New Step Type

To add a new API step type to the framework:

1. Create a new module under `src/test-modules/<your-module>/`
2. Implement the required files: `builder.ts`, `config.ts`, `generator.ts`, `response.ts`, `validations.ts`, `modifications.ts`
3. Implement `k6.ts` (implements `K6StepGenerator`) and `gatling.ts` (implements `GatlingStepGenerator`)
4. Register your generators in `src/k6/registry.ts` and `src/gatling/registry.ts`
5. Add your step type to `ScenarioType` enum in `src/scenario/types.ts`
6. Update `src/scenario/loader.ts` to use your builder/response types
7. Create a JSON schema in `schemas/` and register it in `src/scenario/loader.ts`
8. Add scenario JSON files in `tests/scenarios/`

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
