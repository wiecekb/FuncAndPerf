export type ModifyRequest = {
    modifiedParameter: string;
    modifiedValue: string;
} | {
    jsonPath: string;
    modifiedValue: unknown;
};

export type AddAttachment = {
    path: string;
};

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
