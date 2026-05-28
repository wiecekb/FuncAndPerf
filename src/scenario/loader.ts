import * as fs from 'fs';
import * as path from 'path';
import Ajv from 'ajv';
import {config} from '../config';
import type {AddAttachment, ModifyRequest} from './modify';
import type {BaseValidation} from '../common/validations';
import {ScenarioType} from './types';

export interface ScenarioData {
    scenarioName: string;
    azureTestCaseId?: number | null;
    steps: StepData[];
}

export interface StepData {
    stepName?: string;
    stepType: ScenarioType;
    dataHandlerName?: string;
    returnCode: number;
    modifyRequests?: ModifyRequest[];
    addAttachments?: AddAttachment[];
    validateResponse?: BaseValidation[];
    additionalData?: Record<string, unknown>;
}

const schemasDir = path.resolve('schemas');
const scenarioSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'scenario-schema.json'), 'utf-8'));

// Load sub-schemas so AJV can resolve $ref references to them
const calculatorSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'test-modules', 'calculator', 'step-calculator.json'), 'utf-8'));
const browserSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'test-modules', 'browser', 'step-browser.json'), 'utf-8'));

const ajv = new Ajv({allErrors: true});
ajv.addSchema(calculatorSchema, 'test-modules/calculator/step-calculator.json');
ajv.addSchema(browserSchema, 'test-modules/browser/step-browser.json');
const validateScenario = ajv.compile(scenarioSchema);

function validateScenariosSchema(data: unknown[], source: string): void {
    const valid = validateScenario(data);
    if (!valid) {
        const errors = validateScenario.errors
            ?.map(e => `  ${e.instancePath || '/'}: ${e.message}`)
            .join('\n');
        throw new Error(`Scenario schema validation failed for ${source}:\n${errors}`);
    }
}

export type {AddAttachment, ModifyRequest};

export class Scenario {
    private readonly _data: ScenarioData;

    constructor(data: ScenarioData) {
        this._data = data;
    }

    get rawData(): ScenarioData {
        return this._data;
    }

    get scenarioName(): string {
        return this._data.scenarioName;
    }

    get azureTestCaseId(): number | undefined {
        return this._data.azureTestCaseId ?? undefined;
    }

    get steps(): StepData[] {
        return this._data.steps;
    }

    static fromJson(data: ScenarioData): Scenario {
        return new Scenario(data);
    }
}

export function hasStepAttachments(step: StepData): boolean {
    const attachments = step.addAttachments;
    return Array.isArray(attachments) && attachments.length > 0;
}

function readScenariosFile(jsonPath: string): unknown[] {
    if (!fs.existsSync(jsonPath)) {
        throw new Error(`Scenarios file not found: ${jsonPath}`);
    }

    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const parsed = JSON.parse(rawData);

    if (!Array.isArray(parsed)) {
        throw new Error(`Scenarios file must contain a JSON array: ${jsonPath}`);
    }

    return parsed;
}

function loadScenariosFromFile(jsonPath: string): Scenario[] {
    const parsed = readScenariosFile(jsonPath);
    validateScenariosSchema(parsed, `file: ${jsonPath}`);
    return parsed.map(item => Scenario.fromJson(item as ScenarioData));
}

function loadScenariosFromString(jsonString: string): Scenario[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonString);
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        throw new Error(`Invalid JSON in testCaseString: ${errorMessage}`, {cause: e});
    }
    if (!Array.isArray(parsed)) {
        throw new Error('testCaseString must contain a JSON array');
    }
    validateScenariosSchema(parsed, 'TEST_CASE_STRING environment variable');
    return parsed.map(item => Scenario.fromJson(item as ScenarioData));
}

export function loadScenarios(filePath?: string): Scenario[] {
    const stringData = process.env.TEST_CASE_STRING;
    const resolvedPath = filePath || process.env.TEST_FILE_PATH || config.test.file_path;

    if (stringData) {
        return loadScenariosFromString(stringData);
    }

    return loadScenariosFromFile(resolvedPath);
}
