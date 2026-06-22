import type { ModifyRequest } from '../../scenario/modify';
import { applyJsonPathModifications } from '../../common/modifications';
import { PARAMETER_TO_JSON_PATH } from './config';

/**
 * Applies all declared modifications to `requestBody`, resolving logical
 * parameter names through {@link PARAMETER_TO_JSON_PATH} and direct `jsonPath`
 * entries as-is.
 *
 * @param modifyRequests - Modifications declared on a step.
 * @param requestBody - Built request body to mutate in place.
 * @returns The mutated request body (same reference).
 */
export function applyCalcModifications(
  modifyRequests: ModifyRequest[],
  requestBody: Record<string, unknown>
): Record<string, unknown> {
  return applyJsonPathModifications(modifyRequests, requestBody, PARAMETER_TO_JSON_PATH);
}
