import type { ModifyRequest } from '../scenario/modify';
import { setByJsonPath } from '../scenario/modify';

/**
 * Applies every modification in `modifyRequests` to `requestBody`, resolving
 * logical parameter names through `paramToPath` and direct `jsonPath` entries
 * as-is. Intermediate objects are created on demand by {@link setByJsonPath}.
 *
 * Replaces the previous builder + registry approach: a single central mapping
 * (`paramToPath`) drives all writes, so adding a new modifiable field is a
 * one-line change in the test module's config.
 *
 * @param modifyRequests - Modifications declared on a step (already
 *   reference-resolved by the caller).
 * @param requestBody - Built request body to mutate in place.
 * @param paramToPath - Mapping from logical parameter name to JSONPath.
 * @returns The mutated request body (same reference).
 * @throws {Error} When a `modifiedParameter` is not present in `paramToPath`.
 */
export function applyJsonPathModifications(
  modifyRequests: ModifyRequest[],
  requestBody: Record<string, unknown>,
  paramToPath: Record<string, string>
): Record<string, unknown> {
  for (const mod of modifyRequests) {
    if ('jsonPath' in mod) {
      setByJsonPath(requestBody, mod.jsonPath, mod.modifiedValue);
      continue;
    }

    if ('modifiedParameter' in mod) {
      const path: string | undefined = paramToPath[mod.modifiedParameter];
      if (!path) {
        throw new Error(
          `Unknown modifiedParameter "${mod.modifiedParameter}". ` +
            `Add it to the test module's PARAMETER_TO_JSON_PATH mapping or use a direct "jsonPath" entry.`
        );
      }
      setByJsonPath(requestBody, path, mod.modifiedValue);
    }
  }
  return requestBody;
}
