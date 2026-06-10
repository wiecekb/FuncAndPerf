import type { ModifyRequest } from '../scenario/modify';

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

export function jsonPathReadCode(jsonPath: string): string {
  const cleanPath: string = jsonPath.replace(/^\$\./, '');
  const keys: string[] = cleanPath.split('.');
  const chain: string = keys.map((k: string) => `?.['${escapeJsString(k)}']`).join('');
  return `JSON.parse(r.body)${chain}`;
}

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

export interface ValidationDescriptor {
  validatedParameter?: string;
  validatedParameterValue: string;
  validationType?: 'equal' | 'include';
  jsonPath?: string;
}

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
