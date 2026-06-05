export interface JsonApiResponseLike {
  text(): Promise<string>;
  status(): number;
  headers(): Record<string, string>;
}

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
