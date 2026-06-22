import { expect, test } from '@playwright/test';
import { Scenario } from '../../src';
import { ScenarioType } from '../../src';
import { escapeGherkinString, toValidFilename, generateFeatureFile } from '../../scripts/generate-cucumber';

test.describe('Cucumber Generator - Unit Tests', (): void => {
  test.describe('toValidFilename', (): void => {
    test('should convert name to valid kebab-case filename', (): void => {
      expect(toValidFilename('My Scenario Name.json')).toBe('my-scenario-name');
    });

    test('should strip YAML extensions as well', (): void => {
      expect(toValidFilename('My Scenario Name.yaml')).toBe('my-scenario-name');
      expect(toValidFilename('My Scenario Name.yml')).toBe('my-scenario-name');
    });

    test('should remove special characters and normalize whitespace', (): void => {
      expect(toValidFilename('My Scenario & Test #1!!!')).toBe('my-scenario-test-1-');
    });
  });

  test.describe('escapeGherkinString', (): void => {
    test('should escape double quotes', (): void => {
      expect(escapeGherkinString('Click "Submit" button')).toBe('Click \\"Submit\\" button');
    });

    test('should escape backslashes, newlines, carriage returns and tabs', (): void => {
      expect(escapeGherkinString('Line1\nLine2\r\tPath\\to\\file')).toBe('Line1\\nLine2\\r\\tPath\\\\to\\\\file');
    });

    test('should return empty string for nullish values', (): void => {
      expect(escapeGherkinString(null)).toBe('');
      expect(escapeGherkinString(undefined)).toBe('');
    });
  });

  test.describe('generateFeatureFile', (): void => {
    test('should generate valid Gherkin feature file for calculator scenario', (): void => {
      const mockScenarios = [
        Scenario.fromJson({
          scenarioName: 'Test Calculator Flow',
          steps: [
            {
              stepName: 'Calculate addition',
              stepType: ScenarioType.CALCULATOR,
              returnCode: 200,
              additionalData: {
                operation: 'add',
              },
              modifyRequests: [
                {
                  modifiedParameter: 'a',
                  modifiedValue: '10',
                },
              ],
            },
          ],
        }),
      ];

      const gherkin = generateFeatureFile(mockScenarios, 'calc-test.json');

      // Weryfikacja nagłówka Feature
      expect(gherkin).toContain('Feature: Calc Test');
      expect(gherkin).toContain('As a system user');

      // Weryfikacja kroku Scenario
      expect(gherkin).toContain('Scenario: Test Calculator Flow');
      expect(gherkin).toContain("Given parameter 'a' is set to '10'");
      expect(gherkin).toContain("When 'add' operation is performed");
      expect(gherkin).toContain('Then response should have status code 200');
    });

    test('should generate valid Gherkin feature file for browser scenario', (): void => {
      const mockScenarios = [
        Scenario.fromJson({
          scenarioName: 'Test Browser Flow',
          steps: [
            {
              stepName: 'Open docs page',
              stepType: ScenarioType.BROWSER,
              returnCode: 200,
              additionalData: {
                instructions: [
                  {
                    kind: 'action',
                    action: 'goto',
                    value: '/docs',
                  },
                  {
                    kind: 'assertion',
                    assertion: 'toHaveURL',
                    expected: 'https://example.test/docs',
                  },
                ],
              },
            },
          ],
        }),
      ];

      const gherkin = generateFeatureFile(mockScenarios, 'browser-test.json');

      expect(gherkin).toContain('Feature: Browser Test');
      expect(gherkin).toContain('Scenario: Test Browser Flow');
      expect(gherkin).toContain("When user navigates to '/docs'");
      expect(gherkin).toContain("Then URL should be 'https://example.test/docs'");
    });

    test('should derive feature name from YAML file name', (): void => {
      const mockScenarios = [
        Scenario.fromJson({
          scenarioName: 'Test Browser Flow',
          steps: [
            {
              stepName: 'Open docs page',
              stepType: ScenarioType.BROWSER,
              returnCode: 200,
              additionalData: {
                instructions: [],
              },
            },
          ],
        }),
      ];

      const gherkin = generateFeatureFile(mockScenarios, 'browser-test.yaml');

      expect(gherkin).toContain('Feature: Browser Test');
    });
  });
});
