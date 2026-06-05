import { test } from '@playwright/test';
import { attachment } from 'allure-js-commons';

const REDACTED_VALUE = '[REDACTED]';
const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'proxy-authorization',
]);

export function redactSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]: [string, string]): [string, string] => [
      name,
      SENSITIVE_HEADER_NAMES.has(name.toLowerCase()) ? REDACTED_VALUE : value,
    ])
  );
}

export async function attachScenarioInfo(scenarios: unknown[], isFullList: boolean): Promise<void> {
  const title: string = isFullList ? 'All Scenarios - Full JSON' : 'This Scenario - JSON';

  await attachment(title, JSON.stringify(scenarios, null, 2), 'application/json');
}

export async function attachApiRequest(
  apiName: string,
  url: string,
  method: string,
  headers: Record<string, string>,
  multipart?: {
    data?: {
      name?: string;
      mimeType?: string;
      buffer?: string | null;
    };
    metadata: {
      name: string;
      mimeType: string;
      content: unknown;
    };
  }
): Promise<void> {
  await attachment(
    `Request - ${apiName}`,
    JSON.stringify(
      {
        url,
        method,
        headers: redactSensitiveHeaders(headers),
        multipart,
      },
      null,
      2
    ),
    'application/json'
  );
}

export async function attachApiResponse(
  apiName: string,
  status: number,
  statusText: string,
  headers: Record<string, string>,
  responseText: string
): Promise<void> {
  await test.step('Attach API Response', async () => {
    // Try to parse response as JSON
    let responseBody: unknown;
    let isJson: boolean = true;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      isJson = false;
      responseBody = { rawText: responseText };
    }

    const responseSummary = {
      status: status,
      statusText: statusText,
      headers: redactSensitiveHeaders(headers),
      isJson: isJson,
      body: isJson ? responseBody : { note: 'Response is not valid JSON', rawLength: responseText.length },
    };

    await attachment(`Response - ${apiName}`, JSON.stringify(responseSummary, null, 2), 'application/json');

    if (!isJson) {
      await attachment('Response Raw Text', responseText, 'text/plain');
    }
  });
}

export async function attachScreenshot(name: string, pngBuffer: Buffer): Promise<void> {
  await attachment(name, pngBuffer, 'image/png');
}
