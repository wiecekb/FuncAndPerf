import type { ModifyRequest } from '../scenario/modify';

/**
 * Escapes a string so it can be safely embedded inside a generated JavaScript
 * single- or double-quoted literal. Handles backslash, quotes, common escape
 * sequences (`\n`, `\r`, `\t`, `\b`, `\f`) and any remaining ASCII control
 * characters via `\xNN`.
 *
 * @param value - Raw string to escape.
 * @returns The escaped string, safe for inline embedding in generated code.
 */
export function escapeJsString(value: string): string {
  return (
    value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      // eslint-disable-next-line no-control-regex -- Intentionally matching control character \x08 (backspace) to escape it
      .replace(/\u0008/g, '\\b')
      .replace(/\f/g, '\\f')
      // eslint-disable-next-line no-control-regex -- Intentionally matching control characters range (ASCII 0-31) to escape them
      .replace(/[\u0000-\u001f]/g, (character: string): string => {
        const code: string = character.charCodeAt(0).toString(16).padStart(2, '0');
        return `\\x${code}`;
      })
  );
}

/**
 * Produces a JavaScript expression that reads the value at `jsonPath` from a k6
 * response variable `r` whose body is JSON. Returns optional-chaining member
 * access, e.g. `JSON.parse(r.body)?.['foo']?.['bar']`.
 *
 * @param jsonPath - JSONPath expression starting with `$.`.
 * @returns Generated JavaScript read expression.
 */
export function jsonPathReadCode(jsonPath: string): string {
  const cleanPath: string = jsonPath.replace(/^\$\./, '');
  const keys: string[] = cleanPath.split('.');
  const chain: string = keys.map((k: string) => `?.['${escapeJsString(k)}']`).join('');
  return `JSON.parse(r.body)${chain}`;
}

/**
 * Produces a JavaScript statement that assigns `formattedValue` to a nested
 * path on object `objVar`, creating intermediate objects as needed.
 *
 * @param objVar - Name of the target object variable in the generated code.
 * @param path - JSONPath-style path starting with `$.` (the leading `$.` is stripped).
 * @param formattedValue - Already-formatted value expression to assign.
 * @returns Generated assignment statement.
 */
export function setNestedValueCode(objVar: string, path: string, formattedValue: string): string {
  const cleanPath: string = path.replace(/^\$\./, '');
  const keys: string[] = cleanPath.split('.');
  if (keys.length === 1) {
    return `${objVar}['${escapeJsString(keys[0])}'] = ${formattedValue};`;
  }
  const parentInitializers: string = keys
    .slice(0, -1)
    .map((key: string): string => {
      const escapedKey: string = escapeJsString(key);
      return `target = Reflect.get(target, '${escapedKey}') ?? (Reflect.set(target, '${escapedKey}', {}), Reflect.get(target, '${escapedKey}'));`;
    })
    .join(' ');
  const lastKey: string = escapeJsString(keys[keys.length - 1]);
  return `{ let target = ${objVar}; ${parentInitializers} Reflect.set(target, '${lastKey}', ${formattedValue}); }`;
}

/**
 * Generates one or more JavaScript statements that apply a single
 * {@link ModifyRequest} to a payload variable.
 *
 * Behaviour:
 * - For `jsonPath` modifications, emits a nested assignment via {@link setNestedValueCode}.
 * - For `modifiedParameter` modifications with a `paramToPath` mapping, maps the
 *   parameter name to its JSONPath; unknown parameters produce no output.
 * - For `modifiedParameter` modifications without a mapping, emits a direct
 *   bracket assignment on the payload variable.
 *
 * @param mod - The modification to translate.
 * @param payloadVarName - Name of the payload variable in the generated code.
 * @param formatValue - Formats the raw `modifiedValue` into a JavaScript literal.
 * @param paramToPath - Optional mapping from parameter name to JSONPath.
 * @returns Array of generated JavaScript statements.
 */
export function generateModification(
  mod: ModifyRequest,
  payloadVarName: string,
  formatValue: (value: unknown) => string,
  paramToPath?: Record<string, string>
): string[] {
  if ('jsonPath' in mod) {
    return [setNestedValueCode(payloadVarName, mod.jsonPath, formatValue(mod.modifiedValue))];
  }

  if ('modifiedParameter' in mod) {
    if (paramToPath) {
      const jsonPath: string = paramToPath[mod.modifiedParameter];
      if (jsonPath) {
        return [setNestedValueCode(payloadVarName, jsonPath, formatValue(mod.modifiedValue))];
      }
      return [];
    }
    return [`${payloadVarName}['${escapeJsString(mod.modifiedParameter)}'] = ${formatValue(mod.modifiedValue)};`];
  }

  return [];
}

/**
 * Minimal descriptor for a single response validation as understood by the
 * code-generation layer. Mirrors the relevant subset of {@link BaseValidation}.
 */
export interface ValidationDescriptor {
  /** Optional parameter name resolved through `paramToPath`. */
  validatedParameter?: string;
  /** Expected value, compared as a string. */
  validatedParameterValue: string;
  /** Comparison strategy: strict equality (default) or substring inclusion. */
  validationType?: 'equal' | 'include';
  /** Optional JSONPath used directly when `validatedParameter` is absent. */
  jsonPath?: string;
}

/**
 * Generates a k6-style check callback that asserts a response value against the
 * descriptor. Returns `null` when neither `jsonPath` nor `validatedParameter`
 * resolves to a readable path.
 *
 * @param v - Validation descriptor.
 * @param paramToPath - Mapping from parameter name to JSONPath.
 * @returns Generated k6 check line, or `null` if nothing can be generated.
 */
export function generateValidationCheck(v: ValidationDescriptor, paramToPath: Record<string, string>): string | null {
  const val: string = escapeJsString(v.validatedParameterValue);
  const readCode: string | null = v.jsonPath
    ? jsonPathReadCode(v.jsonPath)
    : v.validatedParameter
      ? jsonPathReadCode(paramToPath[v.validatedParameter] || `$.${v.validatedParameter}`)
      : null;

  if (!readCode) return null;

  const description: string = v.jsonPath
    ? `${escapeJsString(v.jsonPath)}`
    : v.validatedParameter
      ? `${escapeJsString(v.validatedParameter)}`
      : 'validation';

  if (v.validationType === 'include') {
    return `  '${description} includes ${val}': (r) => { try { return String(${readCode}).includes('${val}'); } catch { return false; } }`;
  }

  return `  '${description} equals ${val}': (r) => { try { return String(${readCode}) === '${val}'; } catch { return false; } }`;
}
