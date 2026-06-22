/**
 * Shared code-generation utilities used by every CLI generator script.
 *
 * Provides abstractions over the k6/Gatling/browser generator contracts
 * (contexts, registries, option types), reusable emit helpers for the
 * generated performance scripts (runtime helpers, scenario metadata, step
 * blocks) and data-reference resolution utilities consumed across
 * `generate-k6*.ts`, `generate-gatling.ts` and `generate-cucumber.ts`.
 *
 * @packageDocumentation
 */
import { isScenarioFilePath, loadScenariosFromFilePath, Scenario, type StepData } from '../src';
import * as fs from 'fs';
import * as path from 'path';
import { escapeJsString } from '../src';
import type { BrowserAdditionalData, BrowserInstruction } from '../src';
import { generateInstructionLines as _generateInstructionLines } from '../src/test-modules/browser/generate-instruction-lines';
import { getStepInstanceKey } from '../src';
import type { DefaultPayloadResult, K6GeneratorContext, K6StepGenerator } from '../src';
import type { ModifyRequest } from '../src';
import type { BaseValidation } from '../src';

export interface ScriptGeneratorContext {
  declaredAttachments: Set<string>;
  stepVarName(stepIndex: number): string;
  currentHostRef?: string;
  stepInstanceHostRefs?: Map<string, string>;
}

export interface ScriptStepGenerator<TContext extends ScriptGeneratorContext> {
  readonly stepType: string;
  generatePreamble?(step: StepData, ctx: TContext): string[];
}

export interface ScriptStepGeneratorRegistry<TContext extends ScriptGeneratorContext> {
  get(stepType: string): ScriptStepGenerator<TContext> | undefined;
}

export interface K6StepCodeOptions {
  blockIndent: string;
  innerIndent: string;
  stepCommentIndent?: string;
  includeBlockScope: boolean;
  includeTrailingBlockEnd: boolean;
  checkIndent?: string;
  useSetNestedValueCode: boolean;
  setNestedValueCode?: (payloadVarName: string, jsonPath: string, valueExpression: string) => string;
  preferSourceReferences: boolean;
  fallbackToGeneratorModification: boolean;
}

export function emitBrowserRuntimeHelpers(emit: (line?: string) => unknown, includeStepDataResolution: boolean): void {
  emit('function resolveValue(value) {');
  emit('  if (!value) return value;');
  emit('  const refMatch = value.match(/^\\$\\{ctx\\.([a-zA-Z0-9_]+)\\}$/);');
  emit('  if (refMatch && globalThis.__ctx && Object.prototype.hasOwnProperty.call(globalThis.__ctx, refMatch[1])) {');
  emit('    return String(globalThis.__ctx[refMatch[1]]);');
  emit('  }');
  if (includeStepDataResolution) {
    emit(
      '  const stepRefMatch = value.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\\.([a-zA-Z_][a-zA-Z0-9_]*)(?:\\.(\\$\\..+))?$/);'
    );
    emit('  if (stepRefMatch && globalThis.__stepData) {');
    emit('    const record = globalThis.__stepData[stepRefMatch[1]];');
    emit('    const source = record && record[stepRefMatch[2]];');
    emit('    if (source !== undefined && source !== null) {');
    emit('      const resolved = stepRefMatch[3] ? readJsonPath(source, stepRefMatch[3]) : source;');
    emit('      if (resolved !== undefined && resolved !== null) return String(resolved);');
    emit('    }');
    emit('  }');
  }
  emit('  return value;');
  emit('}');
  emit('');

  if (includeStepDataResolution) {
    emit('function readJsonPath(source, jsonPath) {');
    emit('  const cleanPath = String(jsonPath).replace(/^\\$\\./, "");');
    emit('  if (!cleanPath) return source;');
    emit('  return cleanPath.split(".").reduce((current, key) => current == null ? undefined : current[key], source);');
    emit('}');
    emit('');
  }

  emit('function resolveUrl(value, stepBaseUrl) {');
  emit('  if (!value) return value;');
  emit('  if (/^https?:\\/\\//.test(value)) return value;');
  emit("  const base = stepBaseUrl || __ENV.K6_BROWSER_BASE_URL || 'http://localhost:3000';");
  emit("  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;");
  emit("  const normalizedPath = value.startsWith('/') ? value : `/${value}`;");
  emit('  return `${normalizedBase}${normalizedPath}`;');
  emit('}');
  emit('');

  emit('function urlMatches(actual, expected) {');
  emit('  if (!actual || !expected) return actual === expected;');
  emit("  const a = String(actual).replace(/\\/+$/, '');");
  emit("  const e = String(expected).replace(/\\/+$/, '');");
  emit('  return a === e || a.startsWith(`${e}/`) || a.startsWith(`${e}#`) || a.startsWith(`${e}?`);');
  emit('}');
  emit('');

  emit('function screenshotsEnabled() {');
  emit("  return String(__ENV.K6_BROWSER_SCREENSHOTS || 'on').toLowerCase() !== 'off';");
  emit('}');
  emit('');
}

export function emitK6BrowserSharedIterationsOptions(emit: (line?: string) => unknown, scenarioName: string): void {
  emit('export const options = {');
  emit('  scenarios: {');
  emit(`    ${scenarioName}: {`);
  emit("      executor: 'shared-iterations',");
  emit("      vus: parseInt(__ENV.K6_BROWSER_VUS || '1'),");
  emit("      iterations: parseInt(__ENV.K6_BROWSER_ITERATIONS || '1'),");
  emit("      maxDuration: __ENV.K6_BROWSER_MAX_DURATION || '10m',");
  emit('      options: { browser: { type: "chromium" } }');
  emit('    }');
  emit('  }');
  emit('};');
  emit('');
}

export function emitK6BrowserScenarioSetup(emit: (line?: string) => unknown, includeStepDataStore: boolean): void {
  emit('  const pageInstances = {};');
  emit('  const browserContext = await browser.newContext();');
  emit('  async function getPageForStepInstance(instanceName) {');
  emit('    if (pageInstances[instanceName]) return pageInstances[instanceName].page;');
  emit('    const page = await browserContext.newPage();');
  emit('    pageInstances[instanceName] = { page };');
  emit('    return page;');
  emit('  }');
  emit('  const ctx = globalThis.__ctx || {};');
  emit('  globalThis.__ctx = ctx;');

  if (includeStepDataStore) {
    emit('  const stepData = globalThis.__stepData || {};');
    emit('  globalThis.__stepData = stepData;');
  }
}

export function emitSimpleScenarioBannerHelper(
  emit: (line?: string) => unknown,
  title: string,
  totalStepsExpression: string
): void {
  emit('function printScenarioBanner(index, name, stepCount) {');
  emit("  console.log('');");
  emit("  console.log('='.repeat(60));");
  emit(`  console.log('  ${escapeJsString(title)}');`);
  emit("  console.log('='.repeat(60));");
  emit("  console.log('  Scenario Index: ' + index);");
  emit("  console.log('  Scenario Name:  ' + name);");
  emit(`  console.log('  Total Steps:    ' + ${totalStepsExpression});`);
  emit("  console.log('='.repeat(60));");
  emit("  console.log('');");
  emit('}');
  emit('');
}

export function emitBrowserStepInstructions(
  additionalData: BrowserAdditionalData,
  step: StepData,
  stepName: string,
  stepIndex: number,
  emit: (line?: string) => unknown,
  indent: string
): void {
  const stepBaseUrlVarName: string = `currentStepBaseUrl_${stepIndex}`;
  const browserBaseUrlExpr: string = additionalData.baseUrl
    ? `'${escapeJsString(additionalData.baseUrl)}'`
    : step.hostRef
      ? `HOSTS['${escapeJsString(step.hostRef)}']`
      : 'undefined';
  emit(`${indent}const ${stepBaseUrlVarName} = ${browserBaseUrlExpr};`);

  for (const instruction of additionalData.instructions as BrowserInstruction[]) {
    const generated: string[] = generateInstructionLines(instruction, stepName, stepIndex, stepBaseUrlVarName);
    for (const line of generated) {
      emit(`${indent}${line}`);
    }
  }
}

export function generateInstructionLines(
  instruction: BrowserInstruction,
  stepName: string,
  stepIndex: number,
  stepBaseUrlVarName: string
): string[] {
  return _generateInstructionLines(instruction, stepName, stepIndex, stepBaseUrlVarName);
}

export function createK6GeneratorContext(step: StepData, preambleCtx: K6GeneratorContext): K6GeneratorContext {
  if (step.hostRef) {
    preambleCtx.currentHostRef = step.hostRef;
    preambleCtx.stepInstanceHostRefs?.set(getStepInstanceKey(step), step.hostRef);
  }

  return {
    declaredAttachments: preambleCtx.declaredAttachments,
    stepVarName: (i: number): string => `step${i}`,
    currentHostRef: preambleCtx.currentHostRef,
    stepInstanceHostRefs: preambleCtx.stepInstanceHostRefs,
  };
}

export function createScriptGeneratorContext<TContext extends ScriptGeneratorContext>(
  step: StepData,
  preambleCtx: TContext
): TContext {
  if (step.hostRef) {
    preambleCtx.currentHostRef = step.hostRef;
    preambleCtx.stepInstanceHostRefs?.set(getStepInstanceKey(step), step.hostRef);
  }

  return {
    declaredAttachments: preambleCtx.declaredAttachments,
    stepVarName: preambleCtx.stepVarName,
    currentHostRef: preambleCtx.currentHostRef,
    stepInstanceHostRefs: preambleCtx.stepInstanceHostRefs,
  } as TContext;
}

export function collectUniquePreambleLines<TContext extends ScriptGeneratorContext>(
  scenarios: Scenario[],
  registry: ScriptStepGeneratorRegistry<TContext>,
  ctx: TContext
): string[] {
  const preambleLines: string[] = [];
  for (const scenario of scenarios) {
    for (const step of scenario.steps) {
      const gen: ScriptStepGenerator<TContext> | undefined = registry.get(step.stepType);
      if (!gen?.generatePreamble) continue;
      preambleLines.push(...gen.generatePreamble(step, ctx));
    }
  }
  return [...new Set(preambleLines)];
}

export function emitPreambleLines(
  uniquePreamble: string[],
  emit: (line?: string) => unknown,
  headerComment: string
): void {
  if (uniquePreamble.length === 0) return;

  emit(headerComment);
  for (const line of uniquePreamble) {
    emit(line);
  }
  emit('');
}

export function buildDataHandlerMap(steps: StepData[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < steps.length; i++) {
    const name: string | undefined = steps[i].dataHandlerName;
    if (name) {
      map.set(name, i);
    }
  }
  return map;
}

export function loadAllScenarios(dirPath: string): Map<string, Scenario[]> {
  const files: string[] = fs.readdirSync(dirPath).filter(isScenarioFilePath);
  const fileToScenarios = new Map<string, Scenario[]>();
  const errors: { file: string; error: unknown }[] = [];

  for (const file of files) {
    const filePath: string = path.join(dirPath, file);
    try {
      const scenarios: Scenario[] = loadScenariosFromFilePath(filePath);
      fileToScenarios.set(file, scenarios);
    } catch (e) {
      errors.push({ file, error: e });
    }
  }

  if (errors.length > 0) {
    console.error(`\n❌ Failed to load ${errors.length} scenario file(s):`);
    for (const err of errors) {
      const errMsg = err.error instanceof Error ? err.error.message : String(err.error);
      console.error(`  - ${err.file}: ${errMsg}`);
    }
    throw new Error(`Failed to load ${errors.length} scenario file(s).`);
  }

  return fileToScenarios;
}

export function isStepDataReference(value: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*\.response\.\$/.test(value);
}

export function parseStepDataReference(value: string): { dataHandlerName: string; jsonPath: string } | null {
  const match: RegExpMatchArray | null = value.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.response\.\$(\..+)$/);
  if (!match) return null;
  return { dataHandlerName: match[1], jsonPath: `$${match[2]}` };
}

export function emitScenarioMetadata(
  scenarios: Scenario[],
  emit: (line?: string) => number,
  commentLine: string,
  escapeFn: (s: string) => string,
  getStepUrl: (step: StepData) => string
): void {
  emit(commentLine);
  emit('const SCENARIO_METADATA = [');

  for (let si = 0; si < scenarios.length; si++) {
    const scenario: Scenario = scenarios[si];
    const stepEntries: string[] = [];
    for (let siStep = 0; siStep < scenario.steps.length; siStep++) {
      const step: StepData = scenario.steps[siStep];
      const stepName: string = escapeFn(step.stepName || `Step ${siStep}: ${step.stepType}`);
      const url: string = getStepUrl(step);
      stepEntries.push(`      { name: '${stepName}', url: ${url} }`);
    }

    emit('  {');
    emit(`    index: ${si + 1},`);
    emit(`    name: '${escapeFn(scenario.scenarioName)}',`);
    emit('    steps: [');
    if (stepEntries.length > 0) {
      emit(stepEntries.join(',\n'));
    }
    emit('    ]');
    emit(`  }${si < scenarios.length - 1 ? ',' : ''}`);
  }
  emit('];');
  emit('');
}

export function toValidFunctionName(name: string): string {
  let fn: string = name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '');
  if (/^[0-9]/.test(fn)) {
    fn = 'scenario_' + fn;
  }
  return fn || 'scenario';
}

export function generateScenarioExecutionCode(
  scenariosVarName: string,
  metadataVarName: string,
  indexVarName: string
): string[] {
  return [
    `  if (${indexVarName} > 0 && ${indexVarName} <= ${scenariosVarName}.length) {`,
    `    await ${scenariosVarName}[${indexVarName} - 1]();`,
    '  } else {',
    `    for (const meta of ${metadataVarName}) {`,
    '      printScenarioBanner(meta.index, meta.name, meta.stepCount);',
    '    }',
    `    for (const run of ${scenariosVarName}) {`,
    '      await run();',
    '    }',
    '  }',
  ];
}

function applyK6PayloadRename(line: string, payloadVarName: string): string {
  return line
    .replace(/\bconst payload\b/g, `const ${payloadVarName}`)
    .replace(/\blet payload\b/g, `let ${payloadVarName}`);
}

function applyK6HttpRename(line: string, payloadVarName: string, resVarName: string): string {
  return line
    .replace(/\bconst res\b/g, resVarName)
    .replace(/\bres\./g, `${resVarName}.`)
    .replace(/JSON\.stringify\(payload\)/g, `JSON.stringify(${payloadVarName})`)
    .replace(/\bpayload\b(?![\\'":])/g, payloadVarName);
}

function buildK6SetPayloadValueLine(
  payloadVarName: string,
  mod: ModifyRequest,
  readExpr: string,
  options: K6StepCodeOptions
): string | null {
  if ('jsonPath' in mod) {
    if (options.useSetNestedValueCode && options.setNestedValueCode) {
      return options.setNestedValueCode(payloadVarName, mod.jsonPath, readExpr);
    }

    const cleanPath: string = mod.jsonPath.replace(/^\$\./, '');
    const keys: string[] = cleanPath.split('.');
    if (keys.length === 1) {
      return `${payloadVarName}.${keys[0]} = ${readExpr};`;
    }
    const access: string = keys.map((k: string) => `['${k}']`).join('');
    return `${payloadVarName}${access} = ${readExpr};`;
  }

  if ('modifiedParameter' in mod) {
    return options.useSetNestedValueCode
      ? `${payloadVarName}['${escapeJsString(mod.modifiedParameter)}'] = ${readExpr};`
      : `${payloadVarName}.${mod.modifiedParameter} = ${readExpr};`;
  }

  return null;
}

function generateK6ReferenceModificationLine(
  mod: ModifyRequest,
  payloadVarName: string,
  dataHandlerMap: Map<string, number>,
  options: K6StepCodeOptions
): string | null {
  const modValue: unknown = mod.modifiedValue;
  if (typeof modValue !== 'string') return null;

  if (options.preferSourceReferences && isStepDataSourceReference(modValue)) {
    const ref: { dataHandlerName: string; source: string; jsonPath?: string } | null =
      parseStepDataSourceReference(modValue);
    if (ref && dataHandlerMap.has(ref.dataHandlerName)) {
      const sourceStepIdx: number = dataHandlerMap.get(ref.dataHandlerName)!;
      const readExpr: string = generateStepDataSourceRead(`res${sourceStepIdx}`, ref.source, ref.jsonPath);
      return buildK6SetPayloadValueLine(payloadVarName, mod, readExpr, options);
    }
  }

  if (isStepDataReference(modValue)) {
    const ref: { dataHandlerName: string; jsonPath: string } | null = parseStepDataReference(modValue);
    if (ref && dataHandlerMap.has(ref.dataHandlerName)) {
      const sourceStepIdx: number = dataHandlerMap.get(ref.dataHandlerName)!;
      const readExpr: string = generateStepDataRead(`res${sourceStepIdx}`, ref.jsonPath);
      return buildK6SetPayloadValueLine(payloadVarName, mod, readExpr, options);
    }
  }

  return null;
}

export function generateK6ApiStepBlock(
  step: StepData,
  stepIndex: number,
  scenarioSteps: StepData[],
  gen: K6StepGenerator,
  preambleCtx: K6GeneratorContext,
  options: K6StepCodeOptions
): string[] {
  const blockLines: string[] = [];
  const payloadVarName: string = `payload${stepIndex}`;
  const resVarName: string = `res${stepIndex}`;
  const ctx: K6GeneratorContext = createK6GeneratorContext(step, preambleCtx);
  const dataHandlerMap: Map<string, number> = buildDataHandlerMap(scenarioSteps);
  const stepCommentIndent: string = options.stepCommentIndent ?? options.blockIndent;
  const checkIndent: string = options.checkIndent ?? options.blockIndent;

  blockLines.push(`${stepCommentIndent}// Step ${stepIndex}: ${step.stepName || step.stepType}`);
  if (options.includeBlockScope) {
    blockLines.push(`${options.blockIndent}{ // block scope for step ${stepIndex}`);
  }

  const { code: payloadCode }: DefaultPayloadResult = gen.generateDefaultPayload(step, ctx);
  for (const line of payloadCode) {
    blockLines.push(`${options.innerIndent}${applyK6PayloadRename(line, payloadVarName)}`);
  }

  if (step.modifyRequests && step.modifyRequests.length > 0) {
    blockLines.push(`${options.innerIndent}// Apply modifications`);
    for (const mod of step.modifyRequests) {
      const referenceLine: string | null = generateK6ReferenceModificationLine(
        mod,
        payloadVarName,
        dataHandlerMap,
        options
      );
      if (referenceLine) {
        blockLines.push(`${options.innerIndent}${referenceLine}`);
        continue;
      }

      if (!options.fallbackToGeneratorModification) continue;
      const modLines: string[] = gen.generateModification(mod, payloadVarName, step, ctx);
      blockLines.push(...modLines.map((line: string): string => `${options.innerIndent}${line}`));
    }
  }

  blockLines.push('');

  const httpLines: string[] = gen.generateHttpCall(payloadVarName, step, ctx);
  for (const line of httpLines) {
    blockLines.push(`${options.innerIndent}${applyK6HttpRename(line, payloadVarName, resVarName)}`);
  }

  blockLines.push(`${options.innerIndent}totalRequests.add(1);`);
  blockLines.push(`${options.innerIndent}responseTime.add(${resVarName}.timings.duration);`);
  blockLines.push('');

  const checks: string[] = [`  'status is ${step.returnCode}': (r) => r.status === ${step.returnCode}`];
  if (step.validateResponse && step.validateResponse.length > 0) {
    for (const v of step.validateResponse as BaseValidation[]) {
      const checkLine: string | null = gen.generateValidationCheck(v, resVarName, step, ctx);
      if (checkLine) checks.push(checkLine);
    }
  }

  blockLines.push(`${options.innerIndent}const success${stepIndex} = check(${resVarName}, {`);
  blockLines.push(checks.join(',\n'));
  blockLines.push(`${checkIndent}});`);
  blockLines.push('');
  blockLines.push(`${options.innerIndent}errorRate.add(!success${stepIndex});`);
  if (options.includeTrailingBlockEnd) {
    blockLines.push(`${options.blockIndent}} // end step ${stepIndex}`);
  }

  return blockLines;
}

export function generateStepDataRead(resVarName: string, jsonPath: string): string {
  const cleanPath: string = jsonPath.replace(/^\$\./, '');
  const keys: string[] = cleanPath.split('.');
  const chain: string = keys.map((k: string): string => `?.['${k}']`).join('');
  return `JSON.parse(${resVarName}.body)${chain}`;
}

export function parseStepDataSourceReference(
  value: string
): { dataHandlerName: string; source: string; jsonPath?: string } | null {
  const withPathMatch: RegExpMatchArray | null = value.match(
    /^([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\.\$(\..+)$/
  );
  if (withPathMatch) {
    return { dataHandlerName: withPathMatch[1], source: withPathMatch[2], jsonPath: `$${withPathMatch[3]}` };
  }

  const wholeSourceMatch: RegExpMatchArray | null = value.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)$/);
  if (wholeSourceMatch) {
    return { dataHandlerName: wholeSourceMatch[1], source: wholeSourceMatch[2] };
  }

  return null;
}

export function isStepDataSourceReference(value: string): boolean {
  return parseStepDataSourceReference(value) !== null;
}

export function generateStepDataSourceRead(resVarName: string, source: string, jsonPath?: string): string {
  const sourceRead: string =
    source === 'response'
      ? `JSON.parse(${resVarName}.body)`
      : `JSON.parse(${resVarName}.body)?.['${escapeJsString(source)}']`;
  if (!jsonPath) {
    return sourceRead;
  }

  const cleanPath: string = jsonPath.replace(/^\$\./, '');
  const keys: string[] = cleanPath.split('.');
  const chain: string = keys.map((k: string): string => `?.['${escapeJsString(k)}']`).join('');
  return `${sourceRead}${chain}`;
}
