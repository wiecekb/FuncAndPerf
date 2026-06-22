import { expect, test } from '@playwright/test';
import { redactSensitiveHeaders, serializeScenarios, scenarioMimeType } from '../../src';

test.describe('Allure helpers', (): void => {
  test('redactSensitiveHeaders masks sensitive headers case-insensitively', (): void => {
    const redacted: Record<string, string> = redactSensitiveHeaders({
      Authorization: 'Bearer secret-token',
      authorization: 'Bearer lower-secret-token',
      'X-API-Key': 'api-secret',
      Cookie: 'session=secret',
      'Set-Cookie': 'session=secret; HttpOnly',
      'Proxy-Authorization': 'Basic secret',
      'Content-Type': 'application/json',
    });

    expect(redacted.Authorization).toBe('[REDACTED]');
    expect(redacted.authorization).toBe('[REDACTED]');
    expect(redacted['X-API-Key']).toBe('[REDACTED]');
    expect(redacted.Cookie).toBe('[REDACTED]');
    expect(redacted['Set-Cookie']).toBe('[REDACTED]');
    expect(redacted['Proxy-Authorization']).toBe('[REDACTED]');
    expect(redacted['Content-Type']).toBe('application/json');
  });

  const sampleScenarios = [
    {
      scenarioName: 'Demo Scenario',
      steps: [{ stepType: 'CALCULATOR', returnCode: 200, additionalData: { operation: 'add' } }],
    },
  ];

  test('serializeScenarios produces JSON by default', (): void => {
    const content: string = serializeScenarios(sampleScenarios);
    const parsed = JSON.parse(content) as typeof sampleScenarios;
    expect(parsed[0].scenarioName).toBe('Demo Scenario');
  });

  test('serializeScenarios produces YAML when format is yaml', (): void => {
    const content: string = serializeScenarios(sampleScenarios, 'yaml');
    expect(content).toContain('scenarioName:');
    expect(content).toContain('operation: add');
    expect(content).not.toContain('{');
  });

  test('serializeScenarios produces JSON when format is json', (): void => {
    const content: string = serializeScenarios(sampleScenarios, 'json');
    expect(content.trim().startsWith('[')).toBe(true);
    expect(content).toContain('"scenarioName"');
  });

  test('scenarioMimeType returns text/yaml for yaml format', (): void => {
    expect(scenarioMimeType('yaml')).toBe('text/yaml');
  });

  test('scenarioMimeType returns application/json for json format', (): void => {
    expect(scenarioMimeType('json')).toBe('application/json');
    expect(scenarioMimeType()).toBe('application/json');
  });
});
