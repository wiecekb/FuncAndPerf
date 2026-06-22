import { JSONPath } from 'jsonpath-plus';
import { StepDataRecord, stepDataRegistry } from './registry';

const REFERENCE_WITH_PATH_PATTERN = /^([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\.(\$\..+)$/;
const REFERENCE_WHOLE_SOURCE_PATTERN = /^([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)$/;

type ParsedReference = {
  handlerName: string;
  source: string;
  jsonPath?: string;
};

function parseReference(value: string): ParsedReference | null {
  const withPathMatch: RegExpMatchArray | null = value.match(REFERENCE_WITH_PATH_PATTERN);
  if (withPathMatch) {
    return {
      handlerName: withPathMatch[1],
      source: withPathMatch[2],
      jsonPath: withPathMatch[3],
    };
  }

  const wholeSourceMatch: RegExpMatchArray | null = value.match(REFERENCE_WHOLE_SOURCE_PATTERN);
  if (wholeSourceMatch) {
    return {
      handlerName: wholeSourceMatch[1],
      source: wholeSourceMatch[2],
    };
  }

  return null;
}

/**
 * Returns whether `value` matches the inter-step data reference syntax
 * (`<handler>.<source>` or `<handler>.<source>$.<jsonPath>`).
 *
 * @param value - Candidate string to test.
 */
export function isReference(value: string): boolean {
  return parseReference(value) !== null;
}

/**
 * Resolves an inter-step data reference into the underlying value.
 *
 * When `value` is not a reference it is returned unchanged. Otherwise the
 * referenced source is fetched from {@link stepDataRegistry} and, when a
 * JSONPath is present, evaluated against it.
 *
 * @param value - Reference string (or literal value).
 * @returns The resolved value, or the input unchanged when it is not a reference.
 * @throws {Error} When the referenced handler or source is missing, or when the
 *   JSONPath evaluation fails or resolves to `null`/`undefined`.
 */
export function resolveReference(value: string): unknown {
  const reference: ParsedReference | null = parseReference(value);
  if (!reference) {
    return value;
  }

  const { handlerName, source, jsonPath } = reference;
  const record: StepDataRecord | undefined = stepDataRegistry.get(handlerName);
  if (!record) {
    throw new Error(
      `Step data handler "${handlerName}" not found. ` +
        `Make sure a step with dataHandlerName="${handlerName}" executed before this step.`
    );
  }

  const sourceData: unknown = record.sources[source];
  if (sourceData === undefined || sourceData === null) {
    throw new Error(
      `Reference "${value}" resolved to undefined/null. ` + `Source "${source}" not found in step "${handlerName}".`
    );
  }

  if (!jsonPath) {
    return sourceData;
  }

  let result: unknown;
  try {
    result = JSONPath({ path: jsonPath, json: sourceData, wrap: false });
  } catch (error) {
    throw new Error(
      `Failed to resolve reference "${value}": ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }

  if (result === undefined || result === null) {
    throw new Error(
      `Reference "${value}" resolved to undefined/null. ` +
        `Path "${jsonPath}" not found in source "${source}" of step "${handlerName}".`
    );
  }

  return result;
}

/**
 * Returns a copy of `modifyRequests` where every reference used as a
 * `modifiedValue` is resolved against {@link stepDataRegistry}.
 *
 * For `modifiedParameter` modifications the resolved value is stringified;
 * for `jsonPath` modifications the typed value is preserved.
 *
 * @typeParam T - Modification type carrying a `modifiedValue` field.
 * @param modifyRequests - Modifications to resolve.
 * @returns New array with resolved values; non-reference entries are passed through.
 */
export function resolveModifyReferences<T extends { modifiedValue: unknown }>(modifyRequests: T[]): T[] {
  return modifyRequests.map((mod: T): T => {
    if (typeof mod.modifiedValue !== 'string' || !isReference(mod.modifiedValue)) {
      return mod;
    }

    const resolvedValue: unknown = resolveReference(mod.modifiedValue);
    if ('modifiedParameter' in mod) {
      return {
        ...mod,
        modifiedValue: String(resolvedValue),
      };
    }

    return {
      ...mod,
      modifiedValue: resolvedValue,
    };
  });
}
