import { expect, test } from '@playwright/test';
import { escapeJsString, generateModification, jsonPathReadCode, setNestedValueCode } from '../../src/common/codegen';

test.describe('Codegen helpers', (): void => {
  test('escapeJsString escapes JavaScript string control characters', (): void => {
    expect(escapeJsString('a\'b"c\\d\ne\rf\tg\u0008h\fi\u0000')).toBe('a\\\'b\\"c\\\\d\\ne\\rf\\tg\\bh\\fi\\x00');
  });

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
