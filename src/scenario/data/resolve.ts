import {JSONPath} from 'jsonpath-plus';
import {StepDataRecord, stepDataRegistry} from './registry';

const REFERENCE_WITH_PATH_PATTERN = /^([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\.(\$\..+)$/;
const REFERENCE_WHOLE_SOURCE_PATTERN = /^([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)$/;

type ParsedReference = {
    handlerName: string;
    source: string;
    jsonPath?: string;
};

function parseReference(value: string): ParsedReference | null {
    const withPathMatch: RegExpMatchArray | null = value.match(REFERENCE_WITH_PATH_PATTERN);
    if (withPathMatch) {
        return {
            handlerName: withPathMatch[1],
            source: withPathMatch[2],
            jsonPath: withPathMatch[3]
        };
    }

    const wholeSourceMatch: RegExpMatchArray | null = value.match(REFERENCE_WHOLE_SOURCE_PATTERN);
    if (wholeSourceMatch) {
        return {
            handlerName: wholeSourceMatch[1],
            source: wholeSourceMatch[2]
        };
    }

    return null;
}

export function isReference(value: string): boolean {
    return parseReference(value) !== null;
}

export function resolveReference(value: string): unknown {
    const reference: ParsedReference | null = parseReference(value);
    if (!reference) {
        return value;
    }

    const {handlerName, source, jsonPath} = reference;
    const record: StepDataRecord | undefined = stepDataRegistry.get(handlerName);
    if (!record) {
        throw new Error(
            `Step data handler "${handlerName}" not found. ` +
            `Make sure a step with dataHandlerName="${handlerName}" executed before this step.`
        );
    }

    const sourceData: unknown = record.sources[source];
    if (sourceData === undefined || sourceData === null) {
        throw new Error(
            `Reference "${value}" resolved to undefined/null. ` +
            `Source "${source}" not found in step "${handlerName}".`
        );
    }

    if (!jsonPath) {
        return sourceData;
    }

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
            `Path "${jsonPath}" not found in source "${source}" of step "${handlerName}".`
        );
    }

    return result;
}

export function resolveModifyReferences<T extends { modifiedValue: unknown }>(
    modifyRequests: T[]
): T[] {
    return modifyRequests.map((mod: T): T => {
        if (typeof mod.modifiedValue !== 'string' || !isReference(mod.modifiedValue)) {
            return mod;
        }

        const resolvedValue: unknown = resolveReference(mod.modifiedValue);
        if ('modifiedParameter' in mod) {
            return {
                ...mod,
                modifiedValue: String(resolvedValue)
            };
        }

        return {
            ...mod,
            modifiedValue: resolvedValue
        };
    });
}
