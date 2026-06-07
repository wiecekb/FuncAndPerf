import { type Scenario, type StepData } from '../src/scenario/loader';
import { ScenarioType } from '../src/scenario/types';
import { loadAllScenarios } from './shared';
import { generateK6Script } from './generate-k6';
import { generateScript as generateK6BrowserScript } from './generate-k6-browser';
import * as fs from 'fs';
import { pathToFileURL } from 'url';
import { k6GeneratorRegistry } from '../src/k6/registry';
import type { K6GeneratorContext, K6StepGenerator } from '../src/k6/interface';
import { config } from '../src/config';
import { escapeJsString, setNestedValueCode } from '../src/k6/common';
import {
  buildDataHandlerMap,
  isStepDataReference,
  parseStepDataReference,
} from './shared';
import { getStepInstanceKey, getStepInstanceName } from '../src/scenario/instances';
import type { BrowserAdditionalData, BrowserInstruction, BrowserSelectorInput } from '../src/test-modules/browser/types';
import { resolveBrowserSelector } from '../src/test-modules/browser/selectors';

function printHelp(): void {
  console.log('k6 unified generator help');
  console.log('');
  console.log('Usage:');
  console.log('  npm run k6:generate');
  console.log('  npm run k6:generate -- -h');
  console.log('  npm run k6:generate -- --help');
  console.log('');
  console.log('Options:');
  console.log('  --type [api|browser|hybrid|all]  Specify which type of scenarios to generate');
  console.log('  --help, -h                       Show this help');
  console.log('');
  console.log('What this generator does:');
  console.log('  - loads all JSON scenarios from tests/scenarios');
  console.log('  - by default, generates all three types of scripts');
  console.log('');
  console.log('Run-time environment variables (used by k6 run):');
  console.log('  K6_SCENARIO_INDEX               Choose one API scenario by index (default: 0 = run all)');
  console.log('  K6_BROWSER_SCENARIO_INDEX       Choose one browser scenario by index (default: 0 = run all)');
  console.log('  K6_HYBRID_SCENARIO_INDEX        Choose one hybrid scenario by index (default: 0 = run all)');
  console.log('  K6_VUS                          Number of VUs (default: 5)');
  console.log('  K6_BROWSER_VUS                  Number of browser VUs (default: 1)');
  console.log('  K6_BROWSER_ITERATIONS           Browser iterations count (default: 1)');
  console.log('  K6_BROWSER_MAX_DURATION         Browser max scenario duration (default: 10m)');
  console.log('  K6_BROWSER_BASE_URL             Browser fallback base URL');
  console.log("  K6_BROWSER_SCREENSHOTS          Browser screenshots switch: 'on' | 'off' (default: on)");
  console.log('');
  console.log('Examples:');
  console.log('  npm run k6:generate');
  console.log('  npm run k6:generate -- --type api');
  console.log('  npm run k6:generate -- --type browser');
  console.log('  npm run k6:generate -- --type hybrid');
  console.log('  npm run k6:generate -- --type all');
}

type GenerationType = 'api' | 'browser' | 'hybrid' | 'all';

function toValidFunctionName(name: string): string {
  let fn: string = name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '');
  if (/^[0-9]/.test(fn)) {
    fn = 'scenario_' + fn;
  }
  return fn || 'scenario';
}

function generateStepDataRead(resVarName: string, jsonPath: string): string {
  const cleanPath: string = jsonPath.replace(/^\$\./, '');
  const keys: string[] = cleanPath.split('.');
  const chain: string = keys.map((k: string): string => `?.['${escapeJsString(k)}']`).join('');
  return `JSON.parse(${resVarName}.body)${chain}`;
}

function generateStepDataSourceRead(resVarName: string, source: string, jsonPath?: string): string {
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

function parseStepDataSourceReference(value: string): { dataHandlerName: string; source: string; jsonPath?: string } | null {
  const withPathMatch: RegExpMatchArray | null = value.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\.\$(\..+)$/);
  if (withPathMatch) {
    return { dataHandlerName: withPathMatch[1], source: withPathMatch[2], jsonPath: `$${withPathMatch[3]}` };
  }

  const wholeSourceMatch: RegExpMatchArray | null = value.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)$/);
  if (wholeSourceMatch) {
    return { dataHandlerName: wholeSourceMatch[1], source: wholeSourceMatch[2] };
  }

  return null;
}

function isStepDataSourceReference(value: string): boolean {
  return parseStepDataSourceReference(value) !== null;
}

function selectorToLocatorExpr(selector: BrowserSelectorInput): string {
  const resolvedSelector = resolveBrowserSelector(selector);
  switch (resolvedSelector.kind) {
    case 'role':
      return `page.getByRole('${escapeJsString(resolvedSelector.role)}', { name: ${resolvedSelector.name ? `'${escapeJsString(resolvedSelector.name)}'` : 'undefined'}, exact: ${resolvedSelector.exact ?? false} })`;
    case 'label':
      return `page.getByLabel('${escapeJsString(resolvedSelector.text)}', { exact: ${resolvedSelector.exact ?? false} })`;
    case 'testId':
      return `page.getByTestId('${escapeJsString(resolvedSelector.value)}')`;
    case 'text':
      return `page.getByText('${escapeJsString(resolvedSelector.value)}', { exact: ${resolvedSelector.exact ?? false} })`;
    case 'css':
      return `page.locator('${escapeJsString(resolvedSelector.value)}')`;
    case 'xpath':
      return `page.locator('xpath=${escapeJsString(resolvedSelector.value)}')`;
  }
}

function generateInstructionLines(
  instruction: BrowserInstruction,
  stepName: string,
  stepIndex: number,
  stepBaseUrlVarName: string
): string[] {
  const lines: string[] = [];

  if (instruction.kind === 'action') {
    switch (instruction.action) {
      case 'goto': {
        lines.push(
          `await page.goto(resolveUrl(resolveValue('${escapeJsString(instruction.value || '')}'), ${stepBaseUrlVarName}));`
        );
        break;
      }
      case 'click': {
        if (!instruction.selector) break;
        lines.push(
          `await ${selectorToLocatorExpr(instruction.selector)}.click({ timeout: ${instruction.timeoutMs ?? 10000} });`
        );
        break;
      }
      case 'fill': {
        if (!instruction.selector) break;
        lines.push(
          `await ${selectorToLocatorExpr(instruction.selector)}.fill(resolveValue('${escapeJsString(instruction.value || '')}'), { timeout: ${instruction.timeoutMs ?? 10000} });`
        );
        break;
      }
      case 'press': {
        if (!instruction.selector || !instruction.key) break;
        lines.push(
          `await ${selectorToLocatorExpr(instruction.selector)}.press('${escapeJsString(instruction.key)}', { timeout: ${instruction.timeoutMs ?? 10000} });`
        );
        break;
      }
      case 'waitFor': {
        if (!instruction.selector) break;
        lines.push(
          `await ${selectorToLocatorExpr(instruction.selector)}.waitFor({ timeout: ${instruction.timeoutMs ?? 10000} });`
        );
        break;
      }
      case 'screenshot': {
        lines.push('if (screenshotsEnabled()) {');
        lines.push(
          `  await page.screenshot({ path: 'results/k6-browser/${stepIndex + 1}-${escapeJsString(stepName)}-manual.png' });`
        );
        lines.push('}');
        break;
      }
    }
    return lines;
  }

  if (instruction.kind === 'assertion') {
    switch (instruction.assertion) {
      case 'toHaveURL': {
        lines.push('await page.waitForTimeout(300);');
        lines.push(
          `check(page.url(), { 'url matches': (u) => urlMatches(u, resolveValue('${escapeJsString(instruction.expected || '')}')) });`
        );
        break;
      }
      case 'toBeVisible': {
        if (!instruction.selector) break;
        lines.push(
          `check(await ${selectorToLocatorExpr(instruction.selector)}.isVisible(), { 'element visible': (v) => v === true });`
        );
        break;
      }
      case 'toHaveText': {
        if (!instruction.selector) break;
        lines.push(
          `check(await ${selectorToLocatorExpr(instruction.selector)}.textContent(), { 'text equals': (t) => (t || '').trim() === resolveValue('${escapeJsString(instruction.expected || '')}') });`
        );
        break;
      }
      case 'toContainText': {
        if (!instruction.selector) break;
        lines.push(
          `await ${selectorToLocatorExpr(instruction.selector)}.waitFor({ timeout: ${instruction.timeoutMs ?? 10000} });`
        );
        lines.push(
          `check(await ${selectorToLocatorExpr(instruction.selector)}.textContent(), { 'text contains': (t) => (t || '').includes(resolveValue('${escapeJsString(instruction.expected || '')}')) });`
        );
        break;
      }
      case 'toHaveValue': {
        if (!instruction.selector) break;
        lines.push(
          `check(await ${selectorToLocatorExpr(instruction.selector)}.inputValue(), { 'value equals': (v) => v === resolveValue('${escapeJsString(instruction.expected || '')}') });`
        );
        break;
      }
    }
    return lines;
  }

  if (instruction.kind === 'extract') {
    switch (instruction.extract) {
      case 'url':
        lines.push(`extractedValues['${escapeJsString(instruction.saveAs)}'] = page.url();`);
        lines.push(`ctx['${escapeJsString(instruction.saveAs)}'] = extractedValues['${escapeJsString(instruction.saveAs)}'];`);
        break;
      case 'textContent':
        if (instruction.selector) {
          lines.push(
            `extractedValues['${escapeJsString(instruction.saveAs)}'] = await ${selectorToLocatorExpr(instruction.selector)}.textContent();`
          );
          lines.push(
            `ctx['${escapeJsString(instruction.saveAs)}'] = extractedValues['${escapeJsString(instruction.saveAs)}'];`
          );
        }
        break;
      case 'inputValue':
        if (instruction.selector) {
          lines.push(
            `extractedValues['${escapeJsString(instruction.saveAs)}'] = await ${selectorToLocatorExpr(instruction.selector)}.inputValue();`
          );
          lines.push(
            `ctx['${escapeJsString(instruction.saveAs)}'] = extractedValues['${escapeJsString(instruction.saveAs)}'];`
          );
        }
        break;
      case 'href':
        if (instruction.selector) {
          lines.push(
            `extractedValues['${escapeJsString(instruction.saveAs)}'] = await ${selectorToLocatorExpr(instruction.selector)}.getAttribute('href');`
          );
          lines.push(
            `ctx['${escapeJsString(instruction.saveAs)}'] = extractedValues['${escapeJsString(instruction.saveAs)}'];`
          );
        }
        break;
    }
  }

  return lines;
}

function classifyScenario(scenario: Scenario): GenerationType {
  const hasApiSteps = scenario.steps.some(step => 
    step.stepType === ScenarioType.CALCULATOR || 
    step.stepType === ScenarioType.AUTHORIZED_CALCULATOR
  );
  const hasBrowserSteps = scenario.steps.some(step => 
    step.stepType === ScenarioType.BROWSER
  );

  if (hasApiSteps && hasBrowserSteps) {
    return 'hybrid';
  } else if (hasApiSteps) {
    return 'api';
  } else if (hasBrowserSteps) {
    return 'browser';
  }
  return 'api'; // Default if no steps
}

function generateHybridScript(scenarios: Scenario[]): string {
  const lines: string[] = [];

  const emit: (line?: string) => number = (line: string = ''): number => lines.push(line);

  // ── Header ──
  emit('// performance_scripts/k6/hybrid-performance-test.js — GENERATED FILE');
  emit('// Generated by scripts/generate-k6-unified.ts');
  emit('// Do not edit manually. Re-generate with: npm run k6:generate');
  emit('');
  emit("import http from 'k6/http';");
  emit("import { check, sleep, group } from 'k6';");
  emit("import { Rate, Trend, Counter } from 'k6/metrics';");
  emit("import { browser } from 'k6/browser';");
  emit('');
  emit('// Custom metrics');
  emit("const errorRate = new Rate('errors');");
  emit("const responseTime = new Trend('response_time_ms');");
  emit("const totalRequests = new Counter('total_requests');");
  emit("const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';");
  emit(`const HOSTS = ${JSON.stringify(config.hosts || {})};`);
  emit('');

  // Helper functions from browser generator
  emit('function resolveValue(value) {');
  emit('  if (!value) return value;');
  emit('  const refMatch = value.match(/^\\$\\{ctx\\.([a-zA-Z0-9_]+)\\}$/);');
  emit('  if (refMatch && globalThis.__ctx && Object.prototype.hasOwnProperty.call(globalThis.__ctx, refMatch[1])) {');
  emit('    return String(globalThis.__ctx[refMatch[1]]);');
  emit('  }');
  emit('  return value;');
  emit('}');
  emit('');
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

  emit('function printScenarioBanner(index, name, stepCount) {');
  emit("  console.log('');");
  emit("  console.log('='.repeat(60));");
  emit("  console.log('  FunPerf - k6 Hybrid Scenario');");
  emit("  console.log('='.repeat(60));");
  emit("  console.log('  Scenario Index: ' + index);");
  emit("  console.log('  Scenario Name:  ' + name);");
  emit("  console.log('  Total Steps:    ' + stepCount);");
  emit("  console.log('='.repeat(60));");
  emit("  console.log('');");
  emit('}');
  emit('');

  // ── Options ──
  emit('export const options = {');
  emit('  scenarios: {');
  emit('    hybrid: {');
  emit("      executor: 'shared-iterations',");
  emit("      vus: parseInt(__ENV.K6_BROWSER_VUS || '1'),");
  emit("      iterations: parseInt(__ENV.K6_BROWSER_ITERATIONS || '1'),");
  emit("      maxDuration: __ENV.K6_BROWSER_MAX_DURATION || '10m',");
  emit('      options: { browser: { type: "chromium" } }');
  emit('    }');
  emit('  }');
  emit('};');
  emit('');

  const hybridScenarios = scenarios.filter(s => classifyScenario(s) === 'hybrid');
  const fnNames: string[] = [];
  const scenarioMetadata: { index: number; name: string; stepCount: number }[] = [];

  // Scenario functions
  for (let i = 0; i < hybridScenarios.length; i++) {
    const scenario = hybridScenarios[i];
    const fnName = toValidFunctionName(`hybrid_${scenario.scenarioName}`);
    fnNames.push(fnName);
    scenarioMetadata.push({ index: i + 1, name: scenario.scenarioName, stepCount: scenario.steps.length });

    emit(`async function ${fnName}() {`);
    emit(`  printScenarioBanner(${i + 1}, '${escapeJsString(scenario.scenarioName)}', ${scenario.steps.length});`);
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
    emit('  try {');

    const preambleCtx: K6GeneratorContext = {
      declaredAttachments: new Set(),
      stepVarName: (_i: number): string => 'step',
      stepInstanceHostRefs: new Map<string, string>(),
    };

    // Declare response variables
    const resDecls: string = scenario.steps.map((_: StepData, s: number): string => `res${s}`).join(', ');
    emit(`    let ${resDecls};`);
    emit('');

    // Step blocks
    for (let s = 0; s < scenario.steps.length; s++) {
      const step = scenario.steps[s];
      emit('    {');

      if (step.stepType === ScenarioType.BROWSER) {
        // Browser step
        const stepName = step.stepName || `Step ${s + 1}`;
        const stepInstanceName = getStepInstanceName(step);
        const additionalData = step.additionalData as BrowserAdditionalData | undefined;
        if (additionalData?.instructions) {
          emit(`      console.log('Step: ${escapeJsString(stepName)} [${escapeJsString(stepInstanceName)}]');`);
          emit(`      const page = await getPageForStepInstance('${escapeJsString(stepInstanceName)}');`);
          emit('      const browserStepStart = Date.now();');
          emit('      const extractedValues = {};');
          const stepBaseUrlVarName = `currentStepBaseUrl_${s}`;
          const browserBaseUrlExpr: string = additionalData.baseUrl
            ? `'${escapeJsString(additionalData.baseUrl)}'`
            : step.hostRef
              ? `HOSTS['${escapeJsString(step.hostRef)}']`
              : 'undefined';
          emit(
            `      const ${stepBaseUrlVarName} = ${browserBaseUrlExpr};`
          );
          for (let ii = 0; ii < additionalData.instructions.length; ii++) {
            const instruction = additionalData.instructions[ii] as BrowserInstruction;
            const generated = generateInstructionLines(instruction, stepName, s, stepBaseUrlVarName);
            for (const line of generated) {
              emit(`      ${line}`);
            }
          }
          emit(
            `      res${s} = { status: ${step.returnCode}, body: JSON.stringify({ currentUrl: page.url(), extracted: extractedValues }), timings: { duration: Date.now() - browserStepStart } };`
          );
        }
      } else {
        // API step
        const gen: K6StepGenerator | undefined = k6GeneratorRegistry.get(step.stepType);
        if (gen) {
          const payloadVarName: string = `payload${s}`;
          const resVarName: string = `res${s}`;

          const stepName = step.stepName || step.stepType;
          emit(`      // Step ${s}: ${stepName}`);

          // Track hostRef across steps
          if (step.hostRef) {
            preambleCtx.currentHostRef = step.hostRef;
            preambleCtx.stepInstanceHostRefs?.set(getStepInstanceKey(step), step.hostRef);
          }

          const ctx: K6GeneratorContext = {
            declaredAttachments: preambleCtx.declaredAttachments,
            stepVarName: (i: number): string => `step${i}`,
            currentHostRef: preambleCtx.currentHostRef,
            stepInstanceHostRefs: preambleCtx.stepInstanceHostRefs,
          };

          const { code: payloadCode } = gen.generateDefaultPayload(step, ctx);
          for (const line of payloadCode) {
            const renamed: string = line
              .replace(/\bconst payload\b/g, `const ${payloadVarName}`)
              .replace(/\blet payload\b/g, `let ${payloadVarName}`);
            emit(`      ${renamed}`);
          }

          if (step.modifyRequests && step.modifyRequests.length > 0) {
            emit(`      // Apply modifications`);
            const dataHandlerMap = buildDataHandlerMap(scenario.steps);
            for (const mod of step.modifyRequests) {
              if (typeof mod.modifiedValue === 'string' && isStepDataSourceReference(mod.modifiedValue)) {
                const ref = parseStepDataSourceReference(mod.modifiedValue);
                if (ref && dataHandlerMap.has(ref.dataHandlerName)) {
                  const sourceStepIdx = dataHandlerMap.get(ref.dataHandlerName)!;
                  const sourceResVar = `res${sourceStepIdx}`;
                  const readExpr = generateStepDataSourceRead(sourceResVar, ref.source, ref.jsonPath);

                  if ('jsonPath' in mod) {
                    emit(`      ${setNestedValueCode(payloadVarName, mod.jsonPath, readExpr)}`);
                  } else if ('modifiedParameter' in mod) {
                    emit(`      ${payloadVarName}['${escapeJsString(mod.modifiedParameter)}'] = ${readExpr};`);
                  }
                }
              } else if (typeof mod.modifiedValue === 'string' && isStepDataReference(mod.modifiedValue)) {
                const ref = parseStepDataReference(mod.modifiedValue);
                if (ref && dataHandlerMap.has(ref.dataHandlerName)) {
                  const sourceStepIdx = dataHandlerMap.get(ref.dataHandlerName)!;
                  const sourceResVar = `res${sourceStepIdx}`;
                  const readExpr = generateStepDataRead(sourceResVar, ref.jsonPath);

                  if ('jsonPath' in mod) {
                    emit(`      ${setNestedValueCode(payloadVarName, mod.jsonPath, readExpr)}`);
                  } else if ('modifiedParameter' in mod) {
                    emit(`      ${payloadVarName}['${escapeJsString(mod.modifiedParameter)}'] = ${readExpr};`);
                  }
                }
              } else {
                const modLines = gen.generateModification(mod, payloadVarName, step, ctx);
                for (const l of modLines) {
                  emit(`      ${l}`);
                }
              }
            }
          }

          emit('');

          const httpLines = gen.generateHttpCall(payloadVarName, step, ctx);
          for (const line of httpLines) {
            const renamed = line
              .replace(/\bconst res\b/g, resVarName)
              .replace(/\bres\./g, `${resVarName}.`)
              .replace(/JSON\.stringify\(payload\)/g, `JSON.stringify(${payloadVarName})`)
              .replace(/\bpayload\b(?![\\'":])/g, payloadVarName);
            emit(`      ${renamed}`);
          }

          emit(`      totalRequests.add(1);`);
          emit(`      responseTime.add(${resVarName}.timings.duration);`);
          emit('');

          const checks: string[] = [];
          checks.push(`  'status is ${step.returnCode}': (r) => r.status === ${step.returnCode}`);

          if (step.validateResponse && step.validateResponse.length > 0) {
            for (const v of step.validateResponse) {
              const checkLine = gen.generateValidationCheck(v, resVarName, step, ctx);
              if (checkLine) checks.push(checkLine);
            }
          }

          emit(`      const success${s} = check(${resVarName}, {`);
          emit(checks.join(',\n'));
          emit(`      });`);
          emit('');
          emit(`      errorRate.add(!success${s});`);
        } else {
          emit(`      // Step ${s}: "${step.stepName || step.stepType}" — SKIPPED (no generator)`);
        }
      }

      emit('    }');
      emit('');
    }

    emit('  } finally {');
    emit('    await browserContext.close();');
    emit('  }');
    emit('}');
    emit('');
  }

  // Default export
  emit('export default async function () {');
  if (fnNames.length === 0) {
    emit("  console.warn('No HYBRID scenarios found.');");
  } else {
    emit(`  const scenarios = [${fnNames.join(', ')}];`);
    emit(`  const scenarioMetadata = ${JSON.stringify(scenarioMetadata)};`);
    emit("  const index = parseInt(__ENV.K6_HYBRID_SCENARIO_INDEX || '0');");
    emit('  if (index > 0 && index <= scenarios.length) {');
    emit('    await scenarios[index - 1]();');
    emit('  } else {');
    emit('    for (const meta of scenarioMetadata) {');
    emit('      printScenarioBanner(meta.index, meta.name, meta.stepCount);');
    emit('    }');
    emit('    for (const run of scenarios) {');
    emit('      await run();');
    emit('    }');
    emit('  }');
  }
  emit('  sleep(1);');
  emit('}');

  return lines.join('\n');
}

function main(): void {
  try {
    const args = process.argv.slice(2);
    if (args.includes('-h') || args.includes('--help') || args.includes('-help')) {
      printHelp();
      return;
    }

    let generationType: GenerationType = 'all';
    const typeArgIndex = args.indexOf('--type');
    if (typeArgIndex !== -1 && typeArgIndex + 1 < args.length) {
      const typeValue = args[typeArgIndex + 1];
      if (['api', 'browser', 'hybrid', 'all'].includes(typeValue)) {
        generationType = typeValue as GenerationType;
      }
    }

    const scenariosDir = 'tests/scenarios';
    const scenarios = loadAllScenarios(scenariosDir);

    const outDir = 'performance_scripts/k6';
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    if (generationType === 'api' || generationType === 'all') {
      const apiScenarios = scenarios.filter(s => classifyScenario(s) === 'api');
      const apiScript = generateK6Script(apiScenarios);
      const apiPath = `${outDir}/performance-test.js`;
      fs.writeFileSync(apiPath, apiScript, 'utf-8');
      console.log(`✓ Generated API script: ${apiPath}`);
      console.log(`API scenarios available (${apiScenarios.length}):`);
      apiScenarios.forEach((scenario, idx) => {
        const apiSteps = scenario.steps.filter(step => 
          step.stepType === ScenarioType.CALCULATOR || step.stepType === ScenarioType.AUTHORIZED_CALCULATOR
        ).length;
        console.log(`  [${idx + 1}] "${scenario.scenarioName}" (${apiSteps} API step(s))`);
      });
      console.log('');
    }

    if (generationType === 'browser' || generationType === 'all') {
      const browserScenarios = scenarios.filter(s => classifyScenario(s) === 'browser');
      const browserScript = generateK6BrowserScript(browserScenarios);
      const browserPath = `${outDir}/browser-performance-test.js`;
      fs.writeFileSync(browserPath, browserScript, 'utf-8');
      console.log(`✓ Generated browser script: ${browserPath}`);
      console.log(`Browser scenarios available (${browserScenarios.length}):`);
      browserScenarios.forEach((scenario, idx) => {
        const browserSteps = scenario.steps.filter(step => step.stepType === ScenarioType.BROWSER).length;
        console.log(`  [${idx + 1}] "${scenario.scenarioName}" (${browserSteps} browser step(s))`);
      });
      console.log('');
    }

    if (generationType === 'hybrid' || generationType === 'all') {
      const hybridScenarios = scenarios.filter(s => classifyScenario(s) === 'hybrid');
      const hybridScript = generateHybridScript(hybridScenarios);
      const hybridPath = `${outDir}/hybrid-performance-test.js`;
      fs.writeFileSync(hybridPath, hybridScript, 'utf-8');
      console.log(`✓ Generated hybrid script: ${hybridPath}`);
      console.log(`Hybrid scenarios available (${hybridScenarios.length}):`);
      hybridScenarios.forEach((scenario, idx) => {
        const apiSteps = scenario.steps.filter(step => 
          step.stepType === ScenarioType.CALCULATOR || step.stepType === ScenarioType.AUTHORIZED_CALCULATOR
        ).length;
        const browserSteps = scenario.steps.filter(step => step.stepType === ScenarioType.BROWSER).length;
        console.log(`  [${idx + 1}] "${scenario.scenarioName}" (${apiSteps} API, ${browserSteps} browser step(s))`);
      });
      console.log('');
    }

    console.log('Run with:');
    if (generationType === 'api' || generationType === 'all') {
      console.log(`  npm run k6:run`);
    }
    if (generationType === 'browser' || generationType === 'all') {
      console.log(`  npm run k6:browser:run`);
    }
    if (generationType === 'hybrid' || generationType === 'all') {
      console.log(`  npm run k6:hybrid:run`);
    }
  } catch (error) {
    console.error('Failed to generate k6 scripts:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}
