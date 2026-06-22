/**
 * Maps a calculator operation name to its REST endpoint path on the
 * unauthenticated calculator service.
 */
export const OPERATION_TO_ENDPOINT: Record<string, string> = {
  add: '/api/calc/add',
  multiply: '/api/calc/multiply',
};

/**
 * Maps a logical modification-parameter name (declared in scenario files as
 * `modifiedParameter`) to the JSONPath inside the request payload where the
 * value should be written.
 *
 * To support a new modifiable field, add one entry here — no builder, setter
 * or registry registration is required.
 */
export const PARAMETER_TO_JSON_PATH: Record<string, string> = {
  a: '$.a',
  b: '$.b',
};
