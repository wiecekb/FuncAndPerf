import { expect, test } from '@playwright/test';
import { generateModification, jsonPathReadCode, setNestedValueCode } from '../../src/common/codegen';

test.describe('Codegen helpers', (): void => {
  test('setNestedValueCode uses bracket notation for single-segment paths', (): void => {
    expect(setNestedValueCode('payload', '$.user-id', '1')).toBe("payload['user-id'] = 1;");
  });

  test('setNestedValueCode escapes single quotes in single-segment paths', (): void => {
    expect(setNestedValueCode('payload', "$.user'name", '1')).toBe("payload['user\\'name'] = 1;");
  });

  test('generateModification uses bracket notation for modifiedParameter fallback', (): void => {
    const lines: string[] = generateModification(
      { modifiedParameter: 'user-id', modifiedValue: 'abc' },
      'payload',
      (value: unknown): string => `'${String(value)}'`
    );

    expect(lines).toEqual(["payload['user-id'] = 'abc';"]);
  });

  test('jsonPathReadCode escapes generated property reads', (): void => {
    expect(jsonPathReadCode("$.user'name.value")).toBe("JSON.parse(r.body)?.['user\\'name']?.['value']");
  });
});
