import {type Scenario, type StepData} from '../src/scenario/loader';
import {ScenarioType} from '../src/scenario/types';
import {loadAllScenarios} from './shared';
import type {BrowserAdditionalData, BrowserInstruction, BrowserSelector} from '../src/test-modules/browser/types';
import * as fs from 'fs';

function printHelp(): void {
    console.log('k6/browser generator help');
    console.log('');
    console.log('Usage:');
    console.log('  npm run k6:browser:generate');
    console.log('  npm run k6:browser:generate -- -h');
    console.log('  npm run k6:browser:generate -- --help');
    console.log('');
    console.log('What this generator does:');
    console.log('  - loads all JSON scenarios from tests/scenarios');
    console.log('  - keeps only scenarios containing BROWSER steps');
    console.log('  - generates performance_scripts/k6/browser-performance-test.js');
    console.log('');
    console.log('Run-time environment variables (used by k6 run):');
    console.log('  K6_BROWSER_SCENARIO_INDEX   Choose one generated scenario by index (default: 0 = run all)');
    console.log('  K6_BROWSER_VUS              Number of VUs (default: 1)');
    console.log('  K6_BROWSER_ITERATIONS       Iterations count (default: 1)');
    console.log('  K6_BROWSER_MAX_DURATION     Max scenario duration (default: 10m)');
    console.log('  K6_BROWSER_BASE_URL         Fallback base URL when step has no additionalData.baseUrl');
    console.log("  K6_BROWSER_SCREENSHOTS      Global screenshots switch: 'on' (default) | 'off'");
    console.log('');
    console.log('Examples:');
    console.log('  npm run k6:browser:generate');
    console.log('  K6_BROWSER_SCENARIO_INDEX=2 npm run k6:browser:run');
    console.log('  K6_BROWSER_VUS=5 K6_BROWSER_ITERATIONS=30 K6_BROWSER_MAX_DURATION=20m npm run k6:browser:run');
    console.log('  K6_BROWSER_SCREENSHOTS=off npm run k6:browser:run');
    console.log('  K6_BROWSER_BASE_URL=https://playwright.dev npm run k6:browser:run');
}

function toValidFunctionName(name: string): string {
    let fn: string = name
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/^_+|_+$/g, '');
    if (/^[0-9]/.test(fn)) {
        fn = `scenario_${fn}`;
    }
    return fn || 'scenario';
}

function escapeJsString(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

function selectorToLocatorExpr(selector: BrowserSelector): string {
    switch (selector.kind) {
        case 'role':
            return `page.getByRole('${escapeJsString(selector.role)}', { name: ${selector.name ? `'${escapeJsString(selector.name)}'` : 'undefined'}, exact: ${selector.exact ?? false} })`;
        case 'label':
            return `page.getByLabel('${escapeJsString(selector.text)}', { exact: ${selector.exact ?? false} })`;
        case 'testId':
            return `page.getByTestId('${escapeJsString(selector.value)}')`;
        case 'text':
            return `page.getByText('${escapeJsString(selector.value)}', { exact: ${selector.exact ?? false} })`;
        case 'css':
            return `page.locator('${escapeJsString(selector.value)}')`;
        case 'xpath':
            return `page.locator('xpath=${escapeJsString(selector.value)}')`;
    }
}

function generateInstructionLines(instruction: BrowserInstruction, stepName: string, stepIndex: number, stepBaseUrlVarName: string): string[] {
    const lines: string[] = [];

    if (instruction.kind === 'action') {
        switch (instruction.action) {
            case 'goto': {
                lines.push(`await page.goto(resolveUrl(resolveValue('${escapeJsString(instruction.value || '')}'), ${stepBaseUrlVarName}));`);
                break;
            }
            case 'click': {
                if (!instruction.selector) break;
                lines.push(`await ${selectorToLocatorExpr(instruction.selector)}.click({ timeout: ${instruction.timeoutMs ?? 10000} });`);
                break;
            }
            case 'fill': {
                if (!instruction.selector) break;
                lines.push(`await ${selectorToLocatorExpr(instruction.selector)}.fill(resolveValue('${escapeJsString(instruction.value || '')}'), { timeout: ${instruction.timeoutMs ?? 10000} });`);
                break;
            }
            case 'press': {
                if (!instruction.selector || !instruction.key) break;
                lines.push(`await ${selectorToLocatorExpr(instruction.selector)}.press('${escapeJsString(instruction.key)}', { timeout: ${instruction.timeoutMs ?? 10000} });`);
                break;
            }
            case 'waitFor': {
                if (!instruction.selector) break;
                lines.push(`await ${selectorToLocatorExpr(instruction.selector)}.waitFor({ timeout: ${instruction.timeoutMs ?? 10000} });`);
                break;
            }
            case 'screenshot': {
                lines.push('if (screenshotsEnabled()) {');
                lines.push(`  await page.screenshot({ path: 'results/k6-browser/${stepIndex + 1}-${escapeJsString(stepName)}-manual.png' });`);
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
                lines.push(`check(page.url(), { 'url matches': (u) => urlMatches(u, resolveValue('${escapeJsString(instruction.expected || '')}')) });`);
                break;
            }
            case 'toBeVisible': {
                if (!instruction.selector) break;
                lines.push(`check(await ${selectorToLocatorExpr(instruction.selector)}.isVisible(), { 'element visible': (v) => v === true });`);
                break;
            }
            case 'toHaveText': {
                if (!instruction.selector) break;
                lines.push(`check(await ${selectorToLocatorExpr(instruction.selector)}.textContent(), { 'text equals': (t) => (t || '').trim() === resolveValue('${escapeJsString(instruction.expected || '')}') });`);
                break;
            }
            case 'toContainText': {
                if (!instruction.selector) break;
                lines.push(`await ${selectorToLocatorExpr(instruction.selector)}.waitFor({ timeout: ${instruction.timeoutMs ?? 10000} });`);
                lines.push(`check(await ${selectorToLocatorExpr(instruction.selector)}.textContent(), { 'text contains': (t) => (t || '').includes(resolveValue('${escapeJsString(instruction.expected || '')}')) });`);
                break;
            }
            case 'toHaveValue': {
                if (!instruction.selector) break;
                lines.push(`check(await ${selectorToLocatorExpr(instruction.selector)}.inputValue(), { 'value equals': (v) => v === resolveValue('${escapeJsString(instruction.expected || '')}') });`);
                break;
            }
        }
        return lines;
    }

    if (instruction.kind === 'extract') {
        switch (instruction.extract) {
            case 'url':
                lines.push(`ctx['${escapeJsString(instruction.saveAs)}'] = page.url();`);
                break;
            case 'textContent':
                if (instruction.selector) {
                    lines.push(`ctx['${escapeJsString(instruction.saveAs)}'] = await ${selectorToLocatorExpr(instruction.selector)}.textContent();`);
                }
                break;
            case 'inputValue':
                if (instruction.selector) {
                    lines.push(`ctx['${escapeJsString(instruction.saveAs)}'] = await ${selectorToLocatorExpr(instruction.selector)}.inputValue();`);
                }
                break;
            case 'href':
                if (instruction.selector) {
                    lines.push(`ctx['${escapeJsString(instruction.saveAs)}'] = await ${selectorToLocatorExpr(instruction.selector)}.getAttribute('href');`);
                }
                break;
        }
        return lines;
    }

    return lines;
}

function generateScript(scenarios: Scenario[]): string {
    const browserScenarios: Scenario[] = scenarios.filter((scenario: Scenario) =>
        scenario.steps.some((step: StepData) => step.stepType === ScenarioType.BROWSER)
    );

    const lines: string[] = [];
    const emit: (line?: string) => void = (line: string = ''): void => {
        lines.push(line);
    };

    emit('// performance_scripts/k6/browser-performance-test.js — GENERATED FILE');
    emit('// Generated by scripts/generate-k6-browser.ts');
    emit('// Do not edit manually. Re-generate with: npm run k6:browser:generate');
    emit('');
    emit('import { browser } from "k6/browser";');
    emit('import { check, sleep, group } from "k6";');
    emit('');
    emit('export const options = {');
    emit('  scenarios: {');
    emit('    browser: {');
    emit("      executor: 'shared-iterations',");
    emit("      vus: parseInt(__ENV.K6_BROWSER_VUS || '1'),");
    emit("      iterations: parseInt(__ENV.K6_BROWSER_ITERATIONS || '1'),");
    emit("      maxDuration: __ENV.K6_BROWSER_MAX_DURATION || '10m',");
    emit('      options: { browser: { type: "chromium" } }');
    emit('    }');
    emit('  }');
    emit('};');
    emit('');

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
    emit("  if (/^https?:\\/\\//.test(value)) return value;");
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

    const fnNames: string[] = [];

    for (let i = 0; i < browserScenarios.length; i++) {
        const scenario = browserScenarios[i];
        const fnName = toValidFunctionName(`browser_${scenario.scenarioName}`);
        fnNames.push(fnName);

        emit(`async function ${fnName}() {`);
        emit('  const context = await browser.newContext();');
        emit('  const page = await context.newPage();');
        emit('  const ctx = globalThis.__ctx || {};');
        emit('  globalThis.__ctx = ctx;');
        emit('');

        for (let s = 0; s < scenario.steps.length; s++) {
            const step = scenario.steps[s];
            if (step.stepType !== ScenarioType.BROWSER) continue;
            const stepName = step.stepName || `Step ${s + 1}`;
            const additionalData = step.additionalData as BrowserAdditionalData | undefined;
            if (!additionalData?.instructions) continue;

            emit(`  console.log('Step: ${escapeJsString(stepName)}');`);
            const stepBaseUrlVarName = `currentStepBaseUrl_${s}`;
            emit(`  const ${stepBaseUrlVarName} = ${additionalData.baseUrl ? `'${escapeJsString(additionalData.baseUrl)}'` : 'undefined'};`);
            for (let ii = 0; ii < additionalData.instructions.length; ii++) {
                const instruction = additionalData.instructions[ii] as BrowserInstruction;
                const generated = generateInstructionLines(instruction, stepName, s, stepBaseUrlVarName);
                for (const line of generated) {
                    emit(`    ${line}`);
                }
            }
            emit('');
        }

        emit('  await page.close();');
        emit('  await context.close();');
        emit('}');
        emit('');
    }

    emit('export default async function () {');
    if (fnNames.length === 0) {
        emit("  console.warn('No BROWSER scenarios found.');");
    } else {
        emit(`  const scenarios = [${fnNames.join(', ')}];`);
        emit("  const index = parseInt(__ENV.K6_BROWSER_SCENARIO_INDEX || '0');");
        emit('  if (index > 0 && index <= scenarios.length) {');
        emit('    await scenarios[index - 1]();');
        emit('  } else {');
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

        const scenariosDir = 'tests/scenarios';
        const scenarios = loadAllScenarios(scenariosDir);
        const browserScenarios = scenarios.filter((scenario: Scenario) =>
            scenario.steps.some((step: StepData) => step.stepType === ScenarioType.BROWSER)
        );
        const script = generateScript(scenarios);

        const outDir = 'performance_scripts/k6';
        const outPath = `${outDir}/browser-performance-test.js`;
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, {recursive: true});
        }

        fs.writeFileSync(outPath, script, 'utf-8');
        console.log(`✓ Generated: ${outPath}`);
        console.log('Run with:');
        console.log(`  k6 run ${outPath}`);
        console.log(`  K6_BROWSER_SCENARIO_INDEX=1 k6 run ${outPath}`);
        console.log('');
        console.log(`Browser scenarios available (${browserScenarios.length}):`);
        browserScenarios.forEach((scenario: Scenario, idx: number): void => {
            const browserSteps = scenario.steps.filter((step: StepData) => step.stepType === ScenarioType.BROWSER).length;
            console.log(`  [${idx + 1}] "${scenario.scenarioName}" (${browserSteps} browser step(s))`);
        });
    } catch (error) {
        console.error('Failed to generate k6/browser script:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

main();
