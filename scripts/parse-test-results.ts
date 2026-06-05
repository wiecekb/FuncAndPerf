import * as fs from 'fs';
import * as path from 'path';
import { parseStringPromise } from 'xml2js';

const TEST_RESULTS_DIR: string = 'test-results';
const SCENARIOS_DIR: string = 'tests/scenarios';

interface ScenarioRaw {
  scenarioName: string;
  azureTestCaseId?: number | null;

  [key: string]: unknown;
}

interface ParsedTestCase {
  name: string;
  azureTestCaseId: number | undefined;
  status: 'passed' | 'fail' | 'skipped';
  duration: number;
  errorMessage: string | null;
}

interface XmlTestCaseAttribute {
  name?: string;
  classname?: string;
  time?: string;
}

interface XmlFailureOrError {
  _?: string;
  $?: { message?: string };
}

interface XmlTestCase {
  $: XmlTestCaseAttribute;
  failure?: XmlFailureOrError;
  error?: XmlFailureOrError;
  skipped?: unknown;
}

interface XmlTestSuite {
  testcase?: XmlTestCase | XmlTestCase[];

  [key: string]: unknown;
}

interface XmlTestSuites {
  testsuite?: XmlTestSuite | XmlTestSuite[];

  [key: string]: unknown;
}

interface XmlParseResult {
  testsuite?: XmlTestSuite | XmlTestSuite[];
  testsuites?: XmlTestSuites;

  [key: string]: unknown;
}

function loadScenarioMappings(): Map<string, number> {
  const mappings: Map<string, number> = new Map<string, number>();

  const tempFile: string = 'test-scenarios-temp.json';
  if (fs.existsSync(tempFile)) {
    console.log('Loading scenarios from test-scenarios-temp.json');
    try {
      const content: string = fs.readFileSync(tempFile, 'utf-8');
      const scenarios: ScenarioRaw[] = JSON.parse(content);
      for (const scenario of scenarios) {
        if (scenario.azureTestCaseId) {
          mappings.set(scenario.scenarioName, scenario.azureTestCaseId);
          console.log(`  From temp: "${scenario.scenarioName}" -> ${scenario.azureTestCaseId}`);
        }
      }
    } catch (error) {
      const msg: string = error instanceof Error ? error.message : String(error);
      console.warn(`Failed to parse ${tempFile}: ${msg}`);
    }
  }

  if (fs.existsSync(SCENARIOS_DIR)) {
    console.log('Loading scenarios from tests/scenarios/*.json');
    const files: string[] = fs.readdirSync(SCENARIOS_DIR);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath: string = path.join(SCENARIOS_DIR, file);
        try {
          const content: string = fs.readFileSync(filePath, 'utf-8');
          const scenarios: ScenarioRaw[] = JSON.parse(content);

          for (const scenario of scenarios) {
            if (scenario.azureTestCaseId && !mappings.has(scenario.scenarioName)) {
              mappings.set(scenario.scenarioName, scenario.azureTestCaseId);
              console.log(`  From file: "${scenario.scenarioName}" -> ${scenario.azureTestCaseId}`);
            }
          }
        } catch (error) {
          const msg: string = error instanceof Error ? error.message : String(error);
          console.warn(`Failed to parse ${file}: ${msg}`);
        }
      }
    }
  }

  console.log(`Total mappings loaded: ${mappings.size}`);
  return mappings;
}

function extractTestCases(testsuite: XmlTestSuite, scenarioMappings: Map<string, number>): ParsedTestCase[] {
  const testCases: ParsedTestCase[] = [];

  if (!testsuite) {
    return testCases;
  }

  const cases: XmlTestCase | XmlTestCase[] | undefined = testsuite.testcase;
  if (!cases) {
    return testCases;
  }

  const caseArray: XmlTestCase[] = (Array.isArray(cases) ? cases : [cases]) as XmlTestCase[];

  for (const testcase of caseArray) {
    const name: string = testcase.$.name || testcase.$.classname || '';
    const duration: number = parseFloat(testcase.$.time || '0') || 0;

    let status: ParsedTestCase['status'] = 'passed';
    let errorMessage: string | null = null;

    if (testcase.failure) {
      status = 'fail';
      errorMessage = testcase.failure._ || testcase.failure.$?.message || 'Test failed';
    } else if (testcase.error) {
      status = 'fail';
      errorMessage = testcase.error._ || testcase.error.$?.message || 'Test error';
    } else if (testcase.skipped) {
      status = 'skipped';
    }

    let azureTestCaseId: number | undefined = scenarioMappings.get(name);

    if (!azureTestCaseId) {
      for (const [scenarioName, tcId] of scenarioMappings.entries()) {
        if (name.includes(scenarioName) || scenarioName.includes(name)) {
          azureTestCaseId = tcId;
          break;
        }
      }
    }

    testCases.push({
      name,
      azureTestCaseId,
      status,
      duration: Math.round(duration * 1000), // Convert to milliseconds
      errorMessage,
    });

    console.log(`DEBUG: Parsed test case: ${name}, status: ${status}, azureTestCaseId: ${azureTestCaseId}`);
  }

  return testCases;
}

async function parseJUnitXml(filePath: string, scenarioMappings: Map<string, number>): Promise<ParsedTestCase[]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const result: XmlParseResult = await parseStringPromise(content, { explicitArray: false });
  console.log(`DEBUG: Parsing ${filePath}`);
  console.log(`DEBUG: result keys = ${Object.keys(result)}`);
  console.log(`DEBUG: result = ${JSON.stringify(result).substring(0, 500)}`);

  const testsuite = result.testsuite || result.testsuites?.testsuite;

  if (!testsuite) {
    console.warn(`No testsuite found in ${filePath}`);
    console.warn(`DEBUG: result.testsuite = ${result.testsuite}`);
    console.warn(`DEBUG: result.testsuites = ${result.testsuites}`);
    return [];
  }

  if (Array.isArray(testsuite)) {
    const allCases: ParsedTestCase[] = [];
    for (const suite of testsuite) {
      const cases: ParsedTestCase[] = extractTestCases(suite, scenarioMappings);
      allCases.push(...cases);
    }
    return allCases;
  }

  return extractTestCases(testsuite, scenarioMappings);
}

function findJUnitXmlFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const items: fs.Dirent[] = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath: string = path.join(dir, item.name);

    if (item.isDirectory()) {
      files.push(...findJUnitXmlFiles(fullPath));
    } else if (item.name.endsWith('.xml')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main(): Promise<void> {
  console.log('Starting test results parser...');

  const scenarioMappings: Map<string, number> = loadScenarioMappings();
  console.log(`Loaded ${scenarioMappings.size} scenario -> azureTestCaseId mappings`);

  const xmlFiles: string[] = findJUnitXmlFiles(TEST_RESULTS_DIR);
  console.log(`Found ${xmlFiles.length} JUnit XML files`);

  if (xmlFiles.length === 0) {
    console.log('No JUnit XML files found. Exiting.');
    process.exit(0);
  }

  const allResults: ParsedTestCase[] = [];

  for (const file of xmlFiles) {
    console.log(`Parsing: ${file}`);
    try {
      const results: ParsedTestCase[] = await parseJUnitXml(file, scenarioMappings);
      allResults.push(...results);
    } catch (error) {
      const msg: string = error instanceof Error ? error.message : String(error);
      console.error(`Failed to parse ${file}: ${msg}`);
    }
  }

  const outputPath: string = 'test-results-parsed.json';
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
  console.log(`\nParsed ${allResults.length} test cases`);
  console.log(`Results written to: ${outputPath}`);

  // Summary
  const passed: number = allResults.filter((r) => r.status === 'passed').length;
  const failed: number = allResults.filter((r) => r.status === 'fail').length;
  const withAzureId: number = allResults.filter((r) => r.azureTestCaseId).length;
  console.log(`\nSummary:`);
  console.log(`  Total: ${allResults.length}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  With Azure TestCase ID: ${withAzureId}`);

  if (failed > 0) {
    console.log('\nSome tests failed!');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
