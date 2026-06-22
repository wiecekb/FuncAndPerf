/**
 * k6-specific re-export of the shared code-generation helpers from
 * {@link src/common/codegen}. Provided so k6 generators can import their
 * dependencies from a k6-namespaced entry point.
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
