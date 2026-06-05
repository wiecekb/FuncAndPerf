import { expect, test } from '@playwright/test';
import { redactSensitiveHeaders } from '../../src/allure/helpers';

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
});
