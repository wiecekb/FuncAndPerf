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
  });

  test('should throw an aggregate error when loading invalid scenarios', (): void => {
    // 1. Zapisanie poprawnego scenariusza
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

    // 2. Zapisanie pliku z niepoprawnym JSON (błąd składni)
    fs.writeFileSync(path.join(tempDir, 'invalid-syntax.json'), 'invalid json string {', 'utf-8');

    // 3. Zapisanie pliku niezgodnego ze schematem (brak wymaganej tablicy steps)
    const invalidSchemaJson = JSON.stringify([
      {
        scenarioName: 'Missing Steps',
      },
    ]);
    fs.writeFileSync(path.join(tempDir, 'invalid-schema.json'), invalidSchemaJson, 'utf-8');

    // Sprawdzamy, czy funkcja rzuci zbiorczy błąd z informacją o 2 błędnych plikach
    expect((): void => {
      loadAllScenarios(tempDir);
    }).toThrow(/Failed to load 2 scenario file\(s\)/);
  });
});
