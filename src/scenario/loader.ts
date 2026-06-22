import * as fs from 'fs';
import * as path from 'path';
import Ajv from 'ajv';
import * as yaml from 'js-yaml';
import { config } from '../config';
import type { AppConfig } from '../config';
import type { AddAttachment, ModifyRequest } from './modify';
import type { BaseValidation } from '../common/validations';
import { ScenarioType, HostRef } from './types';

/**
 * Deserialised representation of a single scenario as authored in a JSON/YAML
 * scenario file. Wraps a name, optional Azure test case id and the ordered
 * list of steps to execute.
 */
export interface ScenarioData {
  /** Human-readable scenario name, surfaced in reports. */
  scenarioName: string;
  /** Optional Azure DevOps test case id for traceability. */
  azureTestCaseId?: number | null;
  /** Ordered steps that make up the scenario. */
  steps: StepData[];
}

/**
 * Single executable step inside a {@link ScenarioData}.
 *
 * The `stepType` discriminator selects which test-module generator handles
 * execution and code generation. All other fields are optional and interpreted
 * by the selected module.
 */
export interface StepData {
  /** Optional human-readable step name. */
  stepName?: string;
  /** Optional instance name isolating runtime state (see {@link getStepInstanceKey}). */
  stepInstanceName?: string;
  /** Discriminator selecting the test-module generator (see {@link ScenarioType}). */
  stepType: ScenarioType;
  /** Optional data-handler name enabling inter-step data references. */
  dataHandlerName?: string;
  /** Expected HTTP return code for the step. */
  returnCode: number;
  /** Optional payload modifications applied before the request is sent. */
  modifyRequests?: ModifyRequest[];
  /** Optional files to attach to the Allure report for this step. */
  addAttachments?: AddAttachment[];
  /** Optional response validations executed after the request completes. */
  validateResponse?: BaseValidation[];
  /** Free-form additional data consumed by specific test modules. */
  additionalData?: Record<string, unknown>;
  /** Optional alias of the target host (resolved via {@link resolveHostRef}). */
  hostRef?: HostRef;
}

/**
 * Resolves a {@link HostRef} against the configured hosts map.
 *
 * @param hostRef - Host alias declared on the step, or `undefined`.
 * @param appConfig - Application configuration providing the `hosts` map.
 * @returns Resolved base URL, or `undefined` when `hostRef` is absent.
 * @throws {Error} When `hostRef` is provided but not declared in `config.yaml`.
 */
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
const scenarioSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'scenario-schema.json'), 'utf-8')) as Record<
  string,
  unknown
>;

// Load sub-schemas so AJV can resolve $ref references to them
const calculatorSchema = JSON.parse(
  fs.readFileSync(path.join(schemasDir, '..', 'src', 'test-modules', 'calculator', 'step-calculator.json'), 'utf-8')
) as Record<string, unknown>;
const authorizedCalculatorSchema = JSON.parse(
  fs.readFileSync(
    path.join(schemasDir, '..', 'src', 'test-modules', 'authorized-calculator', 'step-authorized-calculator.json'),
    'utf-8'
  )
) as Record<string, unknown>;
const browserSchema = JSON.parse(
  fs.readFileSync(path.join(schemasDir, '..', 'src', 'test-modules', 'browser', 'step-browser.json'), 'utf-8')
) as Record<string, unknown>;

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

const calculatorSchemaForAjv: Record<string, unknown> = { ...calculatorSchema };
const authorizedCalculatorSchemaForAjv: Record<string, unknown> = { ...authorizedCalculatorSchema };
const browserSchemaForAjv: Record<string, unknown> = { ...browserSchema };
delete calculatorSchemaForAjv.$id;
delete authorizedCalculatorSchemaForAjv.$id;
delete browserSchemaForAjv.$id;

const ajv = new Ajv({ allErrors: true });
ajv.addSchema(calculatorSchemaForAjv, 'src/test-modules/calculator/step-calculator.json');
ajv.addSchema(
  authorizedCalculatorSchemaForAjv,
  'src/test-modules/authorized-calculator/step-authorized-calculator.json'
);
ajv.addSchema(browserSchemaForAjv, 'src/test-modules/browser/step-browser.json');
const validateScenario = ajv.compile(scenarioSchemaNormalized);

const SCENARIO_FILE_EXTENSIONS = new Set(['.json', '.yaml', '.yml']);

/**
 * Document format of a scenario source file, detected from its extension.
 *
 * - `'json'` for `.json` files (and inline `TEST_CASE_STRING` payloads).
 * - `'yaml'` for `.yaml` / `.yml` files.
 */
export type ScenarioDocumentFormat = 'json' | 'yaml';

function validateScenariosSchema(data: unknown[], source: string): void {
  const valid = validateScenario(data);
  if (!valid) {
    const errors = validateScenario.errors?.map((e) => `  ${e.instancePath || '/'}: ${e.message}`).join('\n');
    throw new Error(`Scenario schema validation failed for ${source}:\n${errors}`);
  }
}

export type { AddAttachment, ModifyRequest };

/**
 * Domain wrapper around a parsed {@link ScenarioData} providing typed accessors.
 *
 * Constructed via {@link Scenario.fromJson} after JSON-schema validation.
 */
export class Scenario {
  private readonly _data: ScenarioData;
  private readonly _sourceFormat: ScenarioDocumentFormat;

  /**
   * @param data - Validated scenario payload.
   * @param sourceFormat - Format of the source file the scenario was loaded from.
   */
  constructor(data: ScenarioData, sourceFormat: ScenarioDocumentFormat = 'json') {
    this._data = data;
    this._sourceFormat = sourceFormat;
  }

  /** Raw underlying scenario data. */
  get rawData(): ScenarioData {
    return this._data;
  }

  /** Format of the source file (`'json'` or `'yaml'`) the scenario was loaded from. */
  get sourceFormat(): ScenarioDocumentFormat {
    return this._sourceFormat;
  }

  /** Human-readable scenario name. */
  get scenarioName(): string {
    return this._data.scenarioName;
  }

  /** Optional Azure DevOps test case id, normalised to `undefined` when absent. */
  get azureTestCaseId(): number | undefined {
    return this._data.azureTestCaseId ?? undefined;
  }

  /** Ordered steps of the scenario. */
  get steps(): StepData[] {
    return this._data.steps;
  }

  /**
   * Builds a {@link Scenario} from already-parsed data.
   *
   * @param data - Scenario payload conforming to {@link ScenarioData}.
   * @param sourceFormat - Format of the source file the scenario was loaded from.
   * @returns A new {@link Scenario} instance.
   */
  static fromJson(data: ScenarioData, sourceFormat: ScenarioDocumentFormat = 'json'): Scenario {
    return new Scenario(data, sourceFormat);
  }
}

/**
 * Returns whether the step declares at least one attachment.
 *
 * @param step - Step to inspect.
 */
export function hasStepAttachments(step: StepData): boolean {
  const attachments = step.addAttachments;
  return Array.isArray(attachments) && attachments.length > 0;
}

/**
 * Returns whether `filePath` has a supported scenario file extension
 * (`.json`, `.yaml` or `.yml`).
 *
 * @param filePath - Path to inspect.
 */
export function isScenarioFilePath(filePath: string): boolean {
  return SCENARIO_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function detectScenarioDocumentFormat(filePath: string): ScenarioDocumentFormat {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.json') {
    return 'json';
  }
  if (extension === '.yaml' || extension === '.yml') {
    return 'yaml';
  }

  throw new Error(
    `Unsupported scenarios file extension for ${filePath}. Supported extensions: ${Array.from(SCENARIO_FILE_EXTENSIONS).join(', ')}`
  );
}

function assertScenarioArray(parsed: unknown, source: string): unknown[] {
  if (!Array.isArray(parsed)) {
    throw new Error(`Scenarios source must contain an array: ${source}`);
  }

  return parsed;
}

function parseScenarioText(rawData: string, source: string, format: ScenarioDocumentFormat): unknown[] {
  let parsed: unknown;

  try {
    parsed = format === 'json' ? JSON.parse(rawData) : yaml.load(rawData, { schema: yaml.JSON_SCHEMA });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    const formatLabel = format.toUpperCase();
    throw new Error(`Invalid ${formatLabel} in ${source}: ${errorMessage}`, { cause: e });
  }

  return assertScenarioArray(parsed, source);
}

function readScenariosFile(filePath: string): unknown[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Scenarios file not found: ${filePath}`);
  }

  const rawData = fs.readFileSync(filePath, 'utf-8');
  const format = detectScenarioDocumentFormat(filePath);
  return parseScenarioText(rawData, `file: ${filePath}`, format);
}

/**
 * Loads, validates and wraps all scenarios contained in a JSON/YAML file.
 *
 * @param filePath - Path to the scenario file.
 * @returns Array of {@link Scenario} instances, one per scenario entry.
 * @throws {Error} When the file is missing, cannot be parsed or fails schema validation.
 */
export function loadScenariosFromFilePath(filePath: string): Scenario[] {
  const format = detectScenarioDocumentFormat(filePath);
  const parsed = readScenariosFile(filePath);
  validateScenariosSchema(parsed, `file: ${filePath}`);
  return parsed.map((item) => Scenario.fromJson(item as ScenarioData, format));
}

function loadScenariosFromString(jsonString: string): Scenario[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid JSON in testCaseString: ${errorMessage}`, { cause: e });
  }
  const scenarios = assertScenarioArray(parsed, 'TEST_CASE_STRING environment variable');
  validateScenariosSchema(scenarios, 'TEST_CASE_STRING environment variable');
  return scenarios.map((item) => Scenario.fromJson(item as ScenarioData));
}

/**
 * Top-level scenario loader used by the Playwright entrypoint.
 *
 * Resolution order:
 * 1. `TEST_CASE_STRING` environment variable - inline JSON scenario payload.
 * 2. `filePath` argument.
 * 3. `TEST_FILE_PATH` environment variable.
 * 4. {@link config.test.file_path} default.
 *
 * @param filePath - Optional explicit path to a scenario file.
 * @returns Array of loaded and validated {@link Scenario} instances.
 */
export function loadScenarios(filePath?: string): Scenario[] {
  const stringData = process.env.TEST_CASE_STRING;
  const resolvedPath = filePath || process.env.TEST_FILE_PATH || config.test.file_path;

  if (stringData) {
    return loadScenariosFromString(stringData);
  }

  return loadScenariosFromFilePath(resolvedPath);
}
