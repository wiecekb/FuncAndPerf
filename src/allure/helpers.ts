import { test } from '@playwright/test';
import { attachment } from 'allure-js-commons';
import * as yaml from 'js-yaml';
import type { ScenarioDocumentFormat } from '../scenario/loader';

const REDACTED_VALUE = '[REDACTED]';
const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'proxy-authorization',
]);

/**
 * Returns a copy of `headers` with values of sensitive headers (authorization,
 * cookies, API keys) replaced by a redaction marker, so they can be safely
 * attached to the Allure report.
 *
 * @param headers - Raw request/response headers.
 * @returns Redacted copy of the headers.
 */
export function redactSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]: [string, string]): [string, string] => [
      name,
      SENSITIVE_HEADER_NAMES.has(name.toLowerCase()) ? REDACTED_VALUE : value,
    ])
  );
}

/**
 * Serialises scenario payload(s) according to the source document format.
 *
 * @param scenarios - Scenario payload(s) to serialise.
 * @param format - Source document format (`'json'` or `'yaml'`). Defaults to `'json'`.
 * @returns Serialised representation of the payload.
 */
export function serializeScenarios(scenarios: unknown[], format: ScenarioDocumentFormat = 'json'): string {
  return format === 'yaml'
    ? yaml.dump(scenarios, { indent: 2, lineWidth: -1, noRefs: true })
    : JSON.stringify(scenarios, null, 2);
}

/**
 * Returns the MIME type associated with a scenario document format.
 *
 * @param format - Source document format (`'json'` or `'yaml'`). Defaults to `'json'`.
 * @returns `'text/yaml'` for YAML, otherwise `'application/json'`.
 */
export function scenarioMimeType(format: ScenarioDocumentFormat = 'json'): string {
  return format === 'yaml' ? 'text/yaml' : 'application/json';
}

/**
 * Attaches the scenario list (or the current scenario) to the Allure report,
 * preserving the format of the source scenario file.
 *
 * When `format` is `'yaml'` the payload is serialised with `js-yaml` and
 * attached with a `text/yaml` MIME type; otherwise it is serialised as JSON.
 *
 * @param scenarios - Scenario payload(s) to attach.
 * @param isFullList - When true, labels the attachment as the full list; otherwise as the current scenario.
 * @param format - Source document format (`'json'` or `'yaml'`). Defaults to `'json'`.
 */
export async function attachScenarioInfo(
  scenarios: unknown[],
  isFullList: boolean,
  format: ScenarioDocumentFormat = 'json'
): Promise<void> {
  const formatLabel: string = format.toUpperCase();
  const title: string = isFullList ? `All Scenarios - Full ${formatLabel}` : `This Scenario - ${formatLabel}`;
  const content: string = serializeScenarios(scenarios, format);
  const mimeType: string = scenarioMimeType(format);

  await attachment(title, content, mimeType);
}

/**
 * Attaches the details of an API request (URL, method, redacted headers and
 * optional multipart body) to the Allure report as JSON.
 *
 * @param apiName - Label used in the attachment title.
 * @param url - Request URL.
 * @param method - HTTP method.
 * @param headers - Request headers (sensitive values are redacted).
 * @param multipart - Optional multipart body metadata.
 */
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

/**
 * Attaches the details of an API response (status, redacted headers and body)
 * to the Allure report. The body is parsed as JSON when possible; otherwise it
 * is attached as raw text.
 *
 * @param apiName - Label used in the attachment title.
 * @param status - HTTP status code.
 * @param statusText - HTTP status text.
 * @param headers - Response headers (sensitive values are redacted).
 * @param responseText - Raw response body text.
 */
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

/**
 * Attaches a PNG screenshot to the Allure report.
 *
 * @param name - Attachment title.
 * @param pngBuffer - PNG image buffer.
 */
export async function attachScreenshot(name: string, pngBuffer: Buffer): Promise<void> {
  await attachment(name, pngBuffer, 'image/png');
}
