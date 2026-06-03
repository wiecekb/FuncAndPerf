import {expect, test} from '@playwright/test';
import {stepDataRegistry} from '../../src/scenario/data/registry';
import {isReference, resolveModifyReferences, resolveReference} from '../../src/scenario/data/resolve';

test.describe('Step Data Registry - Unit Tests', (): void => {

    test('5.1.1 Registry stores and retrieves data', (): void => {
        stepDataRegistry.clear();
        stepDataRegistry.set('step1', {
            sources: {
                request: {system: {location: 'ESP'}},
                response: {system: {resultCode: 201}}
            }
        });

        const record = stepDataRegistry.get('step1');
        expect(record).toBeDefined();
        expect(record!.sources.request).toEqual({system: {location: 'ESP'}});
        expect(record!.sources.response).toEqual({system: {resultCode: 201}});
    });

    test('5.1.2 Registry returns undefined for unknown handler', (): void => {
        stepDataRegistry.clear();
        expect(stepDataRegistry.get('nonExistent')).toBeUndefined();
    });

    test('5.1.3 Registry has() returns correct status', (): void => {
        stepDataRegistry.clear();
        stepDataRegistry.set('myStep', {sources: {request: {}, response: {}}});
        expect(stepDataRegistry.has('myStep')).toBe(true);
        expect(stepDataRegistry.has('otherStep')).toBe(false);
    });

    test('5.1.4 Registry clear removes all data', (): void => {
        stepDataRegistry.clear();
        stepDataRegistry.set('stepA', {sources: {request: {}, response: {}}});
        stepDataRegistry.set('stepB', {sources: {request: {}, response: {}}});
        expect(stepDataRegistry.has('stepA')).toBe(true);
        expect(stepDataRegistry.has('stepB')).toBe(true);

        stepDataRegistry.clear();
        expect(stepDataRegistry.has('stepA')).toBe(false);
        expect(stepDataRegistry.has('stepB')).toBe(false);
    });

    test('5.1.5 Registry overwrites existing handler name', (): void => {
        stepDataRegistry.clear();
        stepDataRegistry.set('dup', {sources: {request: {a: 1}, response: {}}});
        stepDataRegistry.set('dup', {sources: {request: {b: 2}, response: {}}});

        const record = stepDataRegistry.get('dup');
        expect(record!.sources.request).toEqual({b: 2});
    });
});

test.describe('Resolve References - Unit Tests', (): void => {

    test.beforeEach((): void => {
        stepDataRegistry.clear();
        stepDataRegistry.set('step1', {
            sources: {
                request: {
                    system: {location: 'ESP', messageGUID: 'guid-abc'},
                    domain: {namespace: 'Test.NS'}
                },
                response: {
                    system: {resultCode: 201, returnMode: 'guidsOnly', messageGUID: 'guid-xyz'},
                    domain: {createdGuids: ['g-1', 'g-2']}
                },
                context: {
                    meta: {source: 'calc', valid: true}
                }
            }
        });
    });

    test('5.2.1 isReference returns true for valid response reference', (): void => {
        expect(isReference('step1.response.$.system.resultCode')).toBe(true);
    });

    test('5.2.2 isReference returns true for valid request reference', (): void => {
        expect(isReference('step1.request.$.system.location')).toBe(true);
    });

    test('5.2.3 isReference returns true for whole-source reference', (): void => {
        expect(isReference('step1.context')).toBe(true);
    });

    test('5.2.4 isReference returns false for plain string', (): void => {
        expect(isReference('ESP')).toBe(false);
    });

    test('5.2.5 isReference returns false for invalid pattern', (): void => {
        expect(isReference('step1..$.path')).toBe(false);
        expect(isReference('step1.response.')).toBe(false);
        expect(isReference('step1.')).toBe(false);
    });

    test('5.2.6 resolveReference resolves response jsonpath', (): void => {
        const result = resolveReference('step1.response.$.system.resultCode');
        expect(result).toBe(201);
    });

    test('5.2.7 resolveReference resolves request jsonpath', (): void => {
        const result = resolveReference('step1.request.$.system.location');
        expect(result).toBe('ESP');
    });

    test('5.2.8 resolveReference resolves whole source object', (): void => {
        const result = resolveReference('step1.context');
        expect(result).toEqual({meta: {source: 'calc', valid: true}});
    });

    test('5.2.9 resolveReference returns plain value for non-reference', (): void => {
        const result = resolveReference('plainValue');
        expect(result).toBe('plainValue');
    });

    test('5.2.10 resolveReference throws for unknown handler', (): void => {
        expect(() => resolveReference('unknownStep.response.$.system.resultCode'))
            .toThrow(/Step data handler "unknownStep" not found/);
    });

    test('5.2.11 resolveReference throws for unknown source', (): void => {
        expect(() => resolveReference('step1.auth.$.token'))
            .toThrow(/Source "auth" not found/);
    });

    test('5.2.12 resolveReference throws for non-existent jsonpath', (): void => {
        expect(() => resolveReference('step1.response.$.nonExistent.path'))
            .toThrow(/resolved to undefined\/null/);
    });

    test('5.2.13 resolveModifyReferences resolves string modifiers as strings', (): void => {
        const result = resolveModifyReferences([
            {modifiedParameter: 'messageGUID', modifiedValue: 'step1.response.$.system.messageGUID'},
            {modifiedParameter: 'location', modifiedValue: 'step1.request.$.system.location'}
        ]);

        expect(result).toHaveLength(2);
        expect(result[0].modifiedValue).toBe('guid-xyz');
        expect(result[1].modifiedValue).toBe('ESP');
    });

    test('5.2.14 resolveModifyReferences resolves jsonPath modifiers as typed values', (): void => {
        const result = resolveModifyReferences([
            {jsonPath: '$.a', modifiedValue: 'step1.response.$.system.resultCode'},
            {jsonPath: '$.meta', modifiedValue: 'step1.context.$.meta'}
        ]);

        expect(result[0].modifiedValue).toBe(201);
        expect(result[1].modifiedValue).toEqual({source: 'calc', valid: true});
    });

    test('5.2.15 resolveModifyReferences leaves non-references unchanged', (): void => {
        const result = resolveModifyReferences([
            {modifiedParameter: 'location', modifiedValue: 'FRA'},
            {jsonPath: '$.count', modifiedValue: 5}
        ]);

        expect(result[0].modifiedValue).toBe('FRA');
        expect(result[1].modifiedValue).toBe(5);
    });

    test('5.2.16 resolveReference resolves nested arrays from response', (): void => {
        const result = resolveReference('step1.response.$.domain.createdGuids[0]');
        expect(result).toBe('g-1');
    });

    test('5.2.17 resolveReference resolves nested arrays from response with index', (): void => {
        const result = resolveReference('step1.response.$.domain.createdGuids[1]');
        expect(result).toBe('g-2');
    });
});
