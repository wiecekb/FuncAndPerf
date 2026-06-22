import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {
  convertScenarioFile,
  resolveOutputPath,
  serializeScenarios,
} from '../../scripts/convert-scenario-format';
import { loadScenariosFromFilePath, type ScenarioData } from '../../src';
import { ScenarioType } from '../../src';

test.describe('Scenario format converter', (): void => {
  const tempDir = path.resolve('tests/unit/data/temp-convert-scenarios');

  const sampleScenarios: ScenarioData[] = [
    {
      scenarioName: 'Conversion test scenario',
      steps: [
        {
          stepType: ScenarioType.CALCULATOR,
          returnCode: 200,
          additionalData: {
            operation: 'add',
          },
          modifyRequests: [
            {
              jsonPath: '$.a',
              modifiedValue: '2',
            },
          ],
        },
      ],
    },
  ];

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

  test('resolveOutputPath derives sibling file with target extension', (): void => {
    expect(resolveOutputPath('/tmp/demo.json', 'yaml')).toBe('/tmp/demo.yaml');
    expect(resolveOutputPath('/tmp/demo.yaml', 'json')).toBe('/tmp/demo.json');
  });

  test('serializeScenarios emits YAML content', (): void => {
    const yamlContent = serializeScenarios(sampleScenarios, 'yaml');

    expect(yamlContent).toContain('- scenarioName: Conversion test scenario');
    expect(yamlContent).toContain('stepType: CALCULATOR');
  });

  test('convertScenarioFile converts JSON to YAML and back to JSON', (): void => {
    const jsonPath = path.join(tempDir, 'scenario.json');
    const roundTripJsonPath = path.join(tempDir, 'scenario.roundtrip.json');
    fs.writeFileSync(jsonPath, JSON.stringify(sampleScenarios, null, 2), 'utf-8');

    const yamlPath = convertScenarioFile(jsonPath, { format: 'yaml' });
    expect(fs.existsSync(yamlPath)).toBeTruthy();
    expect(path.extname(yamlPath)).toBe('.yaml');
    expect(loadScenariosFromFilePath(yamlPath)[0].scenarioName).toBe('Conversion test scenario');

    const secondJsonPath = convertScenarioFile(yamlPath, { format: 'json', outputPath: roundTripJsonPath });
    expect(secondJsonPath).toBe(roundTripJsonPath);
    expect(loadScenariosFromFilePath(secondJsonPath)[0].scenarioName).toBe('Conversion test scenario');
  });
});
