/**
 * Gatling-specific re-export of the shared code-generation helpers, plus the
 * Gatling-native {@link generateGatlingCheck} helper that emits Scala DSL
 * `check` fragments.
 *
 * @packageDocumentation
 */
export {
  escapeJsString,
  jsonPathReadCode,
  setNestedValueCode,
  generateModification,
  generateValidationCheck,
  type ValidationDescriptor,
} from '../common/codegen';

import type { ValidationDescriptor } from '../common/codegen';
import { escapeJsString } from '../common/codegen';

/**
 * Emits a Gatling Scala `check` fragment for a single response validation.
 *
 * Resolves the JSONPath either from `v.jsonPath` directly or via the
 * `paramToPath` mapping, then renders an equality or substring check using the
 * Gatling `jsonPath(...).ofString()...` DSL.
 *
 * @param v - Validation descriptor.
 * @param paramToPath - Mapping from parameter name to JSONPath.
 * @returns Generated Scala check fragment, or `null` when no path can be resolved.
 */
export function generateGatlingCheck(v: ValidationDescriptor, paramToPath: Record<string, string>): string | null {
  const jsonPath: string | null = v.jsonPath
    ? v.jsonPath
    : v.validatedParameter
      ? paramToPath[v.validatedParameter] || `$.${v.validatedParameter}`
      : null;

  if (!jsonPath) return null;

  const val: string = escapeJsString(v.validatedParameterValue);

  if (v.validationType === 'include') {
    return `.check(jsonPath('${jsonPath}').ofString().transform(v => v.includes('${val}')).is(true))`;
  }

  return `.check(jsonPath('${jsonPath}').ofString().is('${val}'))`;
}
