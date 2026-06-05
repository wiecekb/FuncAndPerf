import { config } from '../../config';
import { getStepInstanceName } from '../../scenario/instances';
import type { StepData } from '../../scenario/loader';

export const AUTHORIZED_CALC_OPERATION_TO_ENDPOINT: Record<string, string> = {
  add: '/authorized/api/calc/add',
  multiply: '/authorized/api/calc/multiply',
};

export interface ResolvedAuthorizedCalcConfig {
  tokenTtlSeconds: number;
  tokenRefreshSkewSeconds: number;
}

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
