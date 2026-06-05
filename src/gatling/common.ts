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
