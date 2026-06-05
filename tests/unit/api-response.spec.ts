import { expect, test } from '@playwright/test';
import { JsonApiResponseLike, parseJsonResponseOrThrow } from '../../src/common/api-response';

function responseLike(body: string, status: number = 200, headers: Record<string, string> = {}): JsonApiResponseLike {
  return {
    async text(): Promise<string> {
      return body;
    },
    status(): number {
      return status;
    },
    headers(): Record<string, string> {
      return headers;
    },
  };
}

test.describe('API response helpers', (): void => {
  test('parseJsonResponseOrThrow parses JSON object', async (): Promise<void> => {
    const parsed: Record<string, unknown> = await parseJsonResponseOrThrow(
      responseLike('{"result":3,"operation":"add"}', 200, { 'content-type': 'application/json' }),
      'Calculator endpoint'
    );

    expect(parsed).toEqual({ result: 3, operation: 'add' });
  });

  test('parseJsonResponseOrThrow throws diagnostic error for non-JSON response', async (): Promise<void> => {
    await expect(
      parseJsonResponseOrThrow(
        responseLike('<html>Server error</html>', 502, { 'content-type': 'text/html' }),
        'Calculator endpoint: http://localhost:3000/api/calc/add'
      )
    ).rejects.toThrow(
      'Calculator endpoint: http://localhost:3000/api/calc/add returned non-JSON response (status 502, content-type: text/html). Body preview: <html>Server error</html>'
    );
  });
});
