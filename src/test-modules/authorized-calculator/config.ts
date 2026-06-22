import { config } from '../../config';
import { getStepInstanceName } from '../../scenario/instances';
import type { StepData } from '../../scenario/loader';

/**
 * Maps an {@link AuthorizedCalcOperation} to its REST endpoint path on the
 * authorized calculator service.
 */
export const AUTHORIZED_CALC_OPERATION_TO_ENDPOINT: Record<string, string> = {
  add: '/authorized/api/calc/add',
  multiply: '/authorized/api/calc/multiply',
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

/**
 * Token configuration resolved for a single authorized-calculator step, after
 * applying per-instance overrides on top of the global defaults.
 */
export interface ResolvedAuthorizedCalcConfig {
  /** Time-to-live (seconds) of the authorization token. */
  tokenTtlSeconds: number;
  /** Skew (seconds) applied when refreshing the token before it expires. */
  tokenRefreshSkewSeconds: number;
}

/**
 * Resolves the token configuration for a step, merging global defaults from
 * {@link config.authorized_calculator} with any per-instance override declared
 * under {@link AuthorizedCalculatorConfig.instances}.
 *
 * @param step - Step whose token configuration is requested.
 * @returns Resolved token TTL and refresh skew.
 */
export function resolveAuthorizedCalcConfigForStep(step: StepData): ResolvedAuthorizedCalcConfig {
  const globalTtl: number = config.authorized_calculator.token_ttl_seconds;
  const globalSkew: number = config.authorized_calculator.token_refresh_skew_seconds;
  const instanceName: string = getStepInstanceName(step);
  const instanceOverride: { token_ttl_seconds?: number; token_refresh_skew_seconds?: number } | undefined =
    config.authorized_calculator.instances?.[instanceName];

  return {
    tokenTtlSeconds: instanceOverride?.token_ttl_seconds ?? globalTtl,
    tokenRefreshSkewSeconds: instanceOverride?.token_refresh_skew_seconds ?? globalSkew,
  };
}
