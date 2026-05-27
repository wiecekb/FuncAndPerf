import {JSONPath} from 'jsonpath-plus';
import {StepDataRecord, stepDataRegistry} from './registry';

const REFERENCE_PATTERN = /^([a-zA-Z0-9_]+)\.(request\.body|response)\.(\$\..+)$/;

export function isReference(value: string): boolean {
    return REFERENCE_PATTERN.test(value);
}

export function resolveReference(value: string): unknown {
    const match: RegExpMatchArray | null = value.match(REFERENCE_PATTERN);
    if (!match) {
        return value;
    }

    const [, handlerName, source, jsonPath] = match;

    const record: StepDataRecord | undefined = stepDataRegistry.get(handlerName);
    if (!record) {
        throw new Error(
            `Step data handler "${handlerName}" not found. ` +
            `Make sure a step with dataHandlerName="${handlerName}" executed before this step.`
        );
    }

    const sourceData = source === 'request.body' ? record.requestBody : record.responseBody;

    let result: unknown;
    try {
        result = JSONPath({path: jsonPath, json: sourceData, wrap: false});
    } catch (error) {
        throw new Error(
            `Failed to resolve reference "${value}": ${error instanceof Error ? error.message : String(error)}`,
            {cause: error}
        );
    }

    if (result === undefined || result === null) {
        throw new Error(
            `Reference "${value}" resolved to undefined/null. ` +
            `Path "${jsonPath}" not found in ${source} of step "${handlerName}".`
        );
    }

    return result;
}

export function resolveModifyReferences<T extends { modifiedValue: string }>(
    modifyRequests: T[]
): T[] {
    return modifyRequests.map(mod => ({
        ...mod,
        modifiedValue: isReference(mod.modifiedValue)
            ? String(resolveReference(mod.modifiedValue))
            : mod.modifiedValue
    }));
}
