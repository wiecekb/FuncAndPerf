import { JSONPath } from 'jsonpath-plus';
import { expectWithDescription } from '../utils/logging-expect';

/**
 * Asserts that `actual` matches `expected` using the given comparison strategy,
 * wrapping the assertion in a described Playwright step so it is visible in the
 * Allure report.
 *
 * @param actual - Value obtained from the response.
 * @param expected - Expected value declared in the scenario.
 * @param description - Human-readable description used as the step name.
 * @param validationType - `'equal'` (default) for strict equality or `'include'` for substring containment.
 */
export async function assertValidation(
  actual: unknown,
  expected: unknown,
  description: string,
  validationType: 'equal' | 'include' = 'equal'
): Promise<void> {
  const exp = expectWithDescription(description, actual);
  if (validationType === 'include') {
    await exp.toContain(expected);
  } else {
    await exp.toEqual(expected);
  }
}

/**
 * Evaluates a JSONPath expression against `json` and returns the first match.
 *
 * @param jsonPath - JSONPath expression to evaluate.
 * @param json - Object to query.
 * @returns The matched value.
 * @throws {Error} When the expression is invalid or resolves to no element.
 */
export function validateJsonPath(jsonPath: string, json: object): unknown {
  let result: unknown;
  try {
    result = JSONPath({ path: jsonPath, json, wrap: false });
  } catch (error) {
    const message: string = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid jsonPath "${jsonPath}": ${message}`, { cause: error });
  }

  if (result === undefined) {
    throw new Error(`jsonPath did not find any element: ${jsonPath}`);
  }

  return result;
}

/**
 * Converts any value to its string representation, preserving `null`/`undefined`
 * as the literal strings `'null'`/`'undefined'` rather than the empty string.
 *
 * @param value - Value to stringify.
 * @returns Stringified value.
 */
export function valueToString(value: unknown): string {
  return value === null || value === undefined ? String(value) : String(value);
}

/**
 * Declarative response validation entry used by scenario steps.
 *
 * Either `validatedParameter` (resolved per test module) or `jsonPath` must be
 * provided to select the value being compared against `validatedParameterValue`.
 */
export type BaseValidation = {
  /** Parameter name resolved by the test module to a concrete path/field. */
  validatedParameter?: string;
  /** Expected value, compared as a string. */
  validatedParameterValue: string;
  /** Comparison strategy: strict equality (default) or substring inclusion. */
  validationType?: 'equal' | 'include';
  /** Optional JSONPath evaluated directly against the response body. */
  jsonPath?: string;
  /** Optional human-readable description used in the report step name. */
  validatedParameterDescription?: string;
};

/**
 * Runs every validation in `validations` against `apiResponse`.
 *
 * For entries with a `jsonPath`, the value is extracted via {@link validateJsonPath}.
 * Otherwise the test-module-provided `validateParam` callback is invoked to
 * resolve and assert the named parameter.
 *
 * @typeParam T - Validation descriptor type (extends {@link BaseValidation}).
 * @typeParam R - Response type understood by `toJson` and `validateParam`.
 * @param validations - Validation entries declared in the scenario.
 * @param apiResponse - Raw response object produced by the test runner.
 * @param toJson - Converts the response into a JSON-serialisable object.
 * @param validateParam - Test-module callback asserting a named parameter.
 * @throws {Error} When a validation entry declares neither `validatedParameter` nor `jsonPath`.
 */
export async function validateApiResponse<T extends BaseValidation, R>(
  validations: T[],
  apiResponse: R,
  toJson: (response: R) => object,
  validateParam: (
    validatedParameter: string,
    value: string,
    description: string | undefined,
    validationType: 'equal' | 'include'
  ) => Promise<void>
): Promise<void> {
  for (const validation of validations) {
    const validationType: 'equal' | 'include' = validation.validationType || 'equal';
    const description: string | undefined = validation.validatedParameterDescription;

    if (validation.jsonPath) {
      const result: unknown = validateJsonPath(validation.jsonPath, toJson(apiResponse));
      const resultAsString: string = valueToString(result);
      await assertValidation(
        resultAsString,
        validation.validatedParameterValue,
        description
          ? `Validating JSON Path: ${validation.jsonPath} (${description})`
          : `Validating JSON Path: ${validation.jsonPath}`,
        validationType
      );
      continue;
    }

    if (!validation.validatedParameter) {
      throw new Error('Either validatedParameter or jsonPath must be provided');
    }

    await validateParam(validation.validatedParameter, validation.validatedParameterValue, description, validationType);
  }
}
