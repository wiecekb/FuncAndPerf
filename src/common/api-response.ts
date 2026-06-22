/**
 * Minimal shape of an HTTP response capable of providing its body text, status
 * code and headers. Implemented by Playwright's `APIResponse` and by the mock
 * server response wrapper.
 */
export interface JsonApiResponseLike {
  /** Async accessor for the raw response body as text. */
  text(): Promise<string>;
  /** HTTP status code of the response. */
  status(): number;
  /** Response headers keyed by lower-cased header name. */
  headers(): Record<string, string>;
}

/**
 * Parses the body of an HTTP response as JSON, throwing a descriptive error on
 * failure so callers can surface the problematic payload in test reports.
 *
 * @param response - Response object implementing {@link JsonApiResponseLike}.
 * @param contextName - Human-readable label of the calling step, used in the error message.
 * @returns The parsed JSON object.
 * @throws {Error} When the body cannot be parsed as JSON; the original parse
 *   error is attached via `cause` and a body preview is included.
 */
export async function parseJsonResponseOrThrow(
  response: JsonApiResponseLike,
  contextName: string
): Promise<Record<string, unknown>> {
  const rawBody: string = await response.text();
  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch (error) {
    const contentType: string = response.headers()['content-type'] || 'unknown';
    const preview: string = rawBody.slice(0, 300).replace(/\s+/g, ' ').trim();
    throw new Error(
      `${contextName} returned non-JSON response (status ${response.status()}, content-type: ${contentType}). ` +
        `Body preview: ${preview}`,
      { cause: error }
    );
  }
}
