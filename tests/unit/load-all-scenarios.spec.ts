import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { loadAllScenarios } from '../../scripts/shared';

test.describe('loadAllScenarios - Error Aggregation', (): void => {
  const tempDir = path.resolve('tests/unit/data/temp-load-all');

  test.beforeEach((): void => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
  });

  test.afterEach((): void => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should load valid scenarios successfully', (): void => {
    const validJson = JSON.stringify([
      {
        scenarioName: 'Valid Scenario',
        steps: [
          {
            stepName: 'Step 1',
            stepType: 'CALCULATOR',
            returnCode: 200,
            additionalData: {
              operation: 'add',
            },
          },
        ],
      },
    ]);
    fs.writeFileSync(path.join(tempDir, 'valid.json'), validJson, 'utf-8');

    const result = loadAllScenarios(tempDir);
    expect(result.size).toBe(1);
    expect(result.get('valid.json')?.[0].scenarioName).toBe('Valid Scenario');
    expect(result.get('valid.json')?.[0].sourceFormat).toBe('json');
  });

  test('should load valid YAML scenarios successfully', (): void => {
    const validYaml = `- scenarioName: Valid YAML Scenario
  steps:
    - stepName: Step 1
      stepType: CALCULATOR
      returnCode: 200
      additionalData:
        operation: add
`;
    fs.writeFileSync(path.join(tempDir, 'valid.yaml'), validYaml, 'utf-8');

    const result = loadAllScenarios(tempDir);
    expect(result.size).toBe(1);
    expect(result.get('valid.yaml')?.[0].scenarioName).toBe('Valid YAML Scenario');
    expect(result.get('valid.yaml')?.[0].sourceFormat).toBe('yaml');
  });

  test('should load mixed JSON and YAML scenario files', (): void => {
    const validJson = JSON.stringify([
      {
        scenarioName: 'Valid JSON Scenario',
        steps: [
          {
            stepName: 'Step 1',
            stepType: 'CALCULATOR',
            returnCode: 200,
            additionalData: {
              operation: 'add',
            },
          },
        ],
      },
    ]);
    const validYaml = `- scenarioName: Valid YAML Scenario
  steps:
    - stepName: Step 1
      stepType: CALCULATOR
      returnCode: 200
      additionalData:
        operation: multiply
`;
    fs.writeFileSync(path.join(tempDir, 'valid.json'), validJson, 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'valid.yml'), validYaml, 'utf-8');

    const result = loadAllScenarios(tempDir);
    expect(result.size).toBe(2);
    expect(result.get('valid.json')?.[0].scenarioName).toBe('Valid JSON Scenario');
    expect(result.get('valid.json')?.[0].sourceFormat).toBe('json');
    expect(result.get('valid.yml')?.[0].scenarioName).toBe('Valid YAML Scenario');
    expect(result.get('valid.yml')?.[0].sourceFormat).toBe('yaml');
  });

  test('should throw an aggregate error when loading invalid scenarios', (): void => {
    const validJson = JSON.stringify([
      {
        scenarioName: 'Valid Scenario',
        steps: [
          {
            stepName: 'Step 1',
            stepType: 'CALCULATOR',
            returnCode: 200,
            additionalData: {
              operation: 'add',
            },
          },
        ],
      },
    ]);
    fs.writeFileSync(path.join(tempDir, 'valid.json'), validJson, 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'invalid-syntax.yaml'), 'steps: [unclosed', 'utf-8');
    const invalidSchemaYaml = `- scenarioName: Missing Steps`;
    fs.writeFileSync(path.join(tempDir, 'invalid-schema.yml'), invalidSchemaYaml, 'utf-8');
    expect((): void => {
      loadAllScenarios(tempDir);
    }).toThrow(/Failed to load 2 scenario file\(s\)/);
  });
});
