import type {ModifyRequest} from '../../scenario/modify';
import {setByJsonPath} from '../../scenario/modify';
import {CalcRequestBuilder} from './builder';
import {modifierRegistry} from '../../common/modifications';

export enum CalcModifiedParameter {
    A = 'a',
    B = 'b'
}

modifierRegistry.register<CalcRequestBuilder>(CalcModifiedParameter.A, (b, v) => b.withA(parseInt(v, 10)));
modifierRegistry.register<CalcRequestBuilder>(CalcModifiedParameter.B, (b, v) => b.withB(parseInt(v, 10)));

export function applyCalcModifications(
    modifyRequests: ModifyRequest[],
    builder: CalcRequestBuilder
): CalcRequestBuilder {
    return modifierRegistry.apply(modifyRequests, builder) as CalcRequestBuilder;
}

export function applyCalcJsonPathModifications(
    modifyRequests: ModifyRequest[],
    requestBody: Record<string, unknown>
): Record<string, unknown> {
    for (const mod of modifyRequests) {
        if ('jsonPath' in mod) {
            setByJsonPath(requestBody, mod.jsonPath, mod.modifiedValue);
        }
    }
    return requestBody;
}

export function splitCalcModifyRequests(
    modifyRequests: ModifyRequest[]
): { builderMods: ModifyRequest[]; jsonPathMods: ModifyRequest[] } {
    const builderMods: ModifyRequest[] = [];
    const jsonPathMods: ModifyRequest[] = [];

    for (const mod of modifyRequests) {
        if ('modifiedParameter' in mod) {
            builderMods.push(mod);
        } else {
            jsonPathMods.push(mod);
        }
    }

    return {builderMods, jsonPathMods};
}
