import * as fs from 'fs';
import * as path from 'path';
import Ajv from 'ajv';
import {config} from '../config';
import type {AppConfig} from '../config';
import type {AddAttachment, ModifyRequest} from './modify';
import type {BaseValidation} from '../common/validations';
import {ScenarioType, HostRef} from './types';

export interface ScenarioData {
    scenarioName: string;
    azureTestCaseId?: number | null;
    steps: StepData[];
}

export interface StepData {
    stepName?: string;
    stepInstanceName?: string;
    stepType: ScenarioType;
    dataHandlerName?: string;
    returnCode: number;
    modifyRequests?: ModifyRequest[];
    addAttachments?: AddAttachment[];
    validateResponse?: BaseValidation[];
    additionalData?: Record<string, unknown>;
    hostRef?: HostRef;
}

export function resolveHostRef(hostRef: string | undefined, appConfig: AppConfig): string | undefined {
    if (!hostRef) {
        return undefined;
    }
    const resolved = appConfig.hosts?.[hostRef];
    if (!resolved) {
        throw new Error(`Host alias '${hostRef}' not found in config.yaml hosts map`);
    }
    return resolved;
}

const schemasDir = path.resolve('schemas');
const scenarioSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'scenario-schema.json'), 'utf-8')) as Record<string, unknown>;

// Load sub-schemas so AJV can resolve $ref references to them
const calculatorSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, '..', 'src', 'test-modules', 'calculator', 'step-calculator.json'), 'utf-8')) as Record<string, unknown>;
const authorizedCalculatorSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, '..', 'src', 'test-modules', 'authorized-calculator', 'step-authorized-calculator.json'), 'utf-8')) as Record<string, unknown>;
const browserSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, '..', 'src', 'test-modules', 'browser', 'step-browser.json'), 'utf-8')) as Record<string, unknown>;

const scenarioSchemaNormalized = JSON.parse(JSON.stringify(scenarioSchema)) as {
    definitions?: {
        Step?: {
            oneOf?: Array<{ $ref?: string }>;
        };
    };
};

for (const variant of scenarioSchemaNormalized.definitions?.Step?.oneOf ?? []) {
    if (typeof variant.$ref === 'string' && variant.$ref.startsWith('../src/')) {
        variant.$ref = variant.$ref.replace('../src/', 'src/');
    }
}

const calculatorSchemaForAjv: Record<string, unknown> = {...calculatorSchema};
const authorizedCalculatorSchemaForAjv: Record<string, unknown> = {...authorizedCalculatorSchema};
const browserSchemaForAjv: Record<string, unknown> = {...browserSchema};
delete calculatorSchemaForAjv.$id;
delete authorizedCalculatorSchemaForAjv.$id;
delete browserSchemaForAjv.$id;

const ajv = new Ajv({allErrors: true});
ajv.addSchema(calculatorSchemaForAjv, 'src/test-modules/calculator/step-calculator.json');
ajv.addSchema(authorizedCalculatorSchemaForAjv, 'src/test-modules/authorized-calculator/step-authorized-calculator.json');
ajv.addSchema(browserSchemaForAjv, 'src/test-modules/browser/step-browser.json');
const validateScenario = ajv.compile(scenarioSchemaNormalized);

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
