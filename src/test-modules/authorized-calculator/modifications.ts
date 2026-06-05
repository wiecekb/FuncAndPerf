import type { ModifyRequest } from '../../scenario/modify';
import { setByJsonPath } from '../../scenario/modify';
import { AuthorizedCalcRequestBuilder } from './builder';

export function splitAuthorizedCalcModifyRequests(modifyRequests: ModifyRequest[]): {
  builderMods: ModifyRequest[];
  jsonPathMods: ModifyRequest[];
} {
  const builderMods: ModifyRequest[] = modifyRequests.filter(
    (mod: ModifyRequest): boolean =>
      'modifiedParameter' in mod && (mod.modifiedParameter === 'a' || mod.modifiedParameter === 'b')
  );
  const jsonPathMods: ModifyRequest[] = modifyRequests.filter(
    (mod: ModifyRequest): boolean => !('modifiedParameter' in mod)
  );
  return { builderMods, jsonPathMods };
}

export function applyAuthorizedCalcModifications(mods: ModifyRequest[], builder: AuthorizedCalcRequestBuilder): void {
  for (const mod of mods) {
    if (!('modifiedParameter' in mod)) {
      continue;
    }
    const value: number = parseInt(mod.modifiedValue, 10);
    if (mod.modifiedParameter === 'a') builder.withA(value);
    if (mod.modifiedParameter === 'b') builder.withB(value);
  }
}

export function applyAuthorizedCalcJsonPathModifications(
  mods: ModifyRequest[],
  requestBody: Record<string, unknown>
): void {
  for (const mod of mods) {
    if (!('jsonPath' in mod)) {
      continue;
    }
    setByJsonPath(requestBody, mod.jsonPath, mod.modifiedValue);
  }
}
