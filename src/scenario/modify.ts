/**
 * A single modification applied to a request payload before it is sent.
 *
 * Two variants are supported:
 * - `modifiedParameter` - names a field understood by the test module (e.g.
 *   `leftOperand`) whose value is provided as a string.
 * - `jsonPath` - an arbitrary JSONPath (`$.foo.bar`) whose value is set to the
 *   provided (typed) value.
 */
export type ModifyRequest =
  | {
      modifiedParameter: string;
      modifiedValue: string;
    }
  | {
      jsonPath: string;
      modifiedValue: unknown;
    };

/**
 * Declares an attachment to be added to the Allure report for a step.
 */
export type AddAttachment = {
  /** Path (relative to the project root) of the file to attach. */
  path: string;
};

/**
 * Sets a value at a dotted JSONPath inside `obj`, creating intermediate objects
 * as needed. The leading `$.` of `path` is stripped before traversal.
 *
 * @param obj - Target object to mutate.
 * @param path - JSONPath-style path starting with `$.`.
 * @param value - Value to assign at the terminal key.
 */
export function setByJsonPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const cleanPath: string = path.replace(/^\$\./, '');
  const keys: string[] = cleanPath.split('.');

  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key: string = keys[i];
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}
