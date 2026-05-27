import {expect, test} from '@playwright/test';
import {stepDataRegistry} from '../../src/scenario/data/registry';
import {isReference, resolveModifyReferences, resolveReference} from '../../src/scenario/data/resolve';

test.describe('Step Data Registry - Unit Tests', ():void => {

    test('5.1.1 Registry stores and retrieves data', ():void  => {
        stepDataRegistry.clear();
        stepDataRegistry.set('step1', {
            requestBody: {system: {location: 'ESP'}},
            responseBody: {system: {resultCode: 201}}
        });

        const record = stepDataRegistry.get('step1');
        expect(record).toBeDefined();
        expect(record!.requestBody).toEqual({system: {location: 'ESP'}});
        expect(record!.responseBody).toEqual({system: {resultCode: 201}});
    });

    test('5.1.2 Registry returns undefined for unknown handler', ():void  => {
        stepDataRegistry.clear();
        expect(stepDataRegistry.get('nonExistent')).toBeUndefined();
    });

    test('5.1.3 Registry has() returns correct status', ():void  => {
        stepDataRegistry.clear();
        stepDataRegistry.set('myStep', {requestBody: {}, responseBody: {}});
        expect(stepDataRegistry.has('myStep')).toBe(true);
        expect(stepDataRegistry.has('otherStep')).toBe(false);
    });

    test('5.1.4 Registry clear removes all data', ():void  => {
        stepDataRegistry.clear();
        stepDataRegistry.set('stepA', {requestBody: {}, responseBody: {}});
        stepDataRegistry.set('stepB', {requestBody: {}, responseBody: {}});
        expect(stepDataRegistry.has('stepA')).toBe(true);
        expect(stepDataRegistry.has('stepB')).toBe(true);

        stepDataRegistry.clear();
        expect(stepDataRegistry.has('stepA')).toBe(false);
        expect(stepDataRegistry.has('stepB')).toBe(false);
    });

    test('5.1.5 Registry overwrites existing handler name', ():void  => {
        stepDataRegistry.clear();
        stepDataRegistry.set('dup', {requestBody: {a: 1}, responseBody: {}});
        stepDataRegistry.set('dup', {requestBody: {b: 2}, responseBody: {}});

        const record = stepDataRegistry.get('dup');
        expect(record!.requestBody).toEqual({b: 2});
    });
});

test.describe('Resolve References - Unit Tests', ():void  => {

    test.beforeEach(():void  => {
        stepDataRegistry.clear();
        stepDataRegistry.set('step1', {
            requestBody: {
                system: {location: 'ESP', messageGUID: 'guid-abc'},
                domain: {namespace: 'Test.NS'}
            },
            responseBody: {
                system: {resultCode: 201, returnMode: 'guidsOnly', messageGUID: 'guid-xyz'},
                domain: {createdGuids: ['g-1', 'g-2']}
            }
        });
    });

    test('5.2.1 isReference returns true for valid response reference', ():void  => {
        expect(isReference('step1.response.$.system.resultCode')).toBe(true);
    });

    test('5.2.2 isReference returns true for valid request.body reference', ():void  => {
        expect(isReference('step1.request.body.$.system.location')).toBe(true);
    });

    test('5.2.3 isReference returns false for plain string', ():void  => {
        expect(isReference('ESP')).toBe(false);
    });

    test('5.2.4 isReference returns false for empty string', ():void  => {
        expect(isReference('')).toBe(false);
    });

    test('5.2.5 isReference returns false for similar but invalid pattern', ():void  => {
        expect(isReference('step1.invalid.$.path')).toBe(false);
        expect(isReference('step1.response')).toBe(false);
        expect(isReference('step1.response.')).toBe(false);
    });

    test('5.2.6 resolveReference resolves response jsonpath', ():void  => {
        const result = resolveReference('step1.response.$.system.resultCode');
        expect(result).toBe(201);
    });

    test('5.2.7 resolveReference resolves response string value', ():void  => {
        const result = resolveReference('step1.response.$.system.returnMode');
        expect(result).toBe('guidsOnly');
    });

    test('5.2.8 resolveReference resolves request.body jsonpath', ():void  => {
        const result = resolveReference('step1.request.body.$.system.location');
        expect(result).toBe('ESP');
    });

    test('5.2.9 resolveReference resolves request.body domain value', ():void  => {
        const result = resolveReference('step1.request.body.$.domain.namespace');
        expect(result).toBe('Test.NS');
    });

    test('5.2.10 resolveReference returns plain value for non-reference', ():void  => {
        const result = resolveReference('plainValue');
        expect(result).toBe('plainValue');
    });

    test('5.2.11 resolveReference throws for unknown handler', ():void  => {
        expect(() => resolveReference('unknownStep.response.$.system.resultCode'))
            .toThrow(/Step data handler "unknownStep" not found/);
    });

    test('5.2.12 resolveReference throws for non-existent jsonpath', ():void  => {
        expect(() => resolveReference('step1.response.$.nonExistent.path'))
            .toThrow(/resolved to undefined\/null/);
    });

    test('5.2.13 resolveModifyReferences resolves all references in array', ():void  => {
        const result = resolveModifyReferences([
            {modifiedParameter: 'messageGUID', modifiedValue: 'step1.response.$.system.messageGUID'},
            {modifiedParameter: 'location', modifiedValue: 'step1.request.body.$.system.location'}
        ]);

        expect(result).toHaveLength(2);
        expect(result[0].modifiedValue).toBe('guid-xyz');
        expect(result[1].modifiedValue).toBe('ESP');
    });

    test('5.2.14 resolveModifyReferences leaves non-references unchanged', ():void  => {
        const result = resolveModifyReferences([
            {modifiedParameter: 'location', modifiedValue: 'FRA'},
            {modifiedParameter: 'dataFormat', modifiedValue: 'json'}
        ]);

        expect(result[0].modifiedValue).toBe('FRA');
        expect(result[1].modifiedValue).toBe('json');
    });

    test('5.2.15 resolveModifyReferences mixes references and plain values', ():void  => {
        const result = resolveModifyReferences([
            {modifiedParameter: 'messageGUID', modifiedValue: 'step1.response.$.system.messageGUID'},
            {modifiedParameter: 'dataFormat', modifiedValue: 'json'},
            {modifiedParameter: 'namespace', modifiedValue: 'step1.request.body.$.domain.namespace'}
        ]);

        expect(result[0].modifiedValue).toBe('guid-xyz');
        expect(result[1].modifiedValue).toBe('json');
        expect(result[2].modifiedValue).toBe('Test.NS');
    });

    test('5.2.16 resolveReference resolves nested arrays from response', ():void  => {
        const result = resolveReference('step1.response.$.domain.createdGuids[0]');
        expect(result).toBe('g-1');
    });

    test('5.2.17 resolveReference resolves nested arrays from response with index', ():void  => {
        const result = resolveReference('step1.response.$.domain.createdGuids[1]');
        expect(result).toBe('g-2');
    });
});
