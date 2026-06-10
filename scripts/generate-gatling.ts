import { type Scenario, StepData } from '../src/scenario/loader';
import { gatlingGeneratorRegistry } from '../src/gatling/registry';
import type { GatlingGeneratorContext, GatlingPayloadResult, GatlingStepGenerator } from '../src/gatling/interface';
import { config } from '../src/config';
import { escapeJsString, setNestedValueCode } from '../src/gatling/common';
import {
  buildDataHandlerMap,
  collectUniquePreambleLines,
  createScriptGeneratorContext,
  emitScenarioMetadata,
  emitPreambleLines,
  isStepDataReference,
  loadAllScenarios,
  parseStepDataReference,
} from './shared';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

function toValidFunctionName(index: number, name: string): string {
  let fn: string = name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '');
  if (/^[0-9]/.test(fn)) {
    fn = 'scenario_' + fn;
  }
  return `scenario_${index}_${fn || 'scenario'}`;
}

function generateStepDataRead(sessionVarName: string, saveKey: string, jsonPath: string): string {
  const cleanPath: string = jsonPath.replace(/^\$\./, '');
  const keys: string[] = cleanPath.split('.');
  const chain: string = keys.map((k: string): string => `?.['${k}']`).join('');
  return `JSON.parse(${sessionVarName}.get('${saveKey}'))${chain}`;
}

export function generateGatlingSimulation(scenarios: Scenario[]): string {
  const lines: string[] = [];
  const emit: (line?: string) => number = (line: string = ''): number => lines.push(line);

  emit(
    "import { simulation, scenario, pause, exec, StringBody, getEnvironmentVariable, jsonPath, bodyString, constantUsersPerSec } from '@gatling.io/core';"
  );
  emit("import { http, status } from '@gatling.io/http';");
  emit('');
  emit('const AUTH_TOKEN = getEnvironmentVariable("AUTH_TOKEN") || "no-token";');
  emit(`const HOSTS = ${JSON.stringify(config.hosts || {})};`);
  emit('');
  const preambleCtx: GatlingGeneratorContext = {
    declaredAttachments: new Set(),
    stepVarName: (i: number): string => `step${i}`,
    stepInstanceHostRefs: new Map<string, string>(),
  };
  emitPreambleLines(
    collectUniquePreambleLines(scenarios, gatlingGeneratorRegistry, preambleCtx),
    emit,
    '// Pre-load attachment files'
  );

  const functionNames: string[] = [];

  for (let si: number = 0; si < scenarios.length; si++) {
    const scenario: Scenario = scenarios[si];
    const steps: StepData[] = scenario.steps;
    const fnName: string = toValidFunctionName(si, scenario.scenarioName);
    const dataHandlerMap: Map<string, number> = buildDataHandlerMap(steps);

    const supportedSteps: StepData[] = steps.filter((s: StepData): boolean => gatlingGeneratorRegistry.has(s.stepType));
    if (supportedSteps.length === 0) {
      emit(`// Scenario ${si}: "${scenario.scenarioName}" — SKIPPED (no supported step types)`);
      emit(`export function ${fnName}() { return scenario('${escapeJsString(scenario.scenarioName)}'); }`);
      emit('');
      functionNames.push(fnName);
      continue;
    }

    emit(`// ── Scenario ${si + 1}: ${scenario.scenarioName} ──`);
    emit(`export function ${fnName}() {`);
    emit(`  return scenario('${escapeJsString(scenario.scenarioName)}')`);

    for (let stepIdx: number = 0; stepIdx < steps.length; stepIdx++) {
      const step: StepData = steps[stepIdx];
      const gen: GatlingStepGenerator | undefined = gatlingGeneratorRegistry.get(step.stepType);

      if (!gen) {
        emit(`    // WARNING: No Gatling generator registered for step type "${step.stepType}"`);
        emit(`    // Skipping step: ${step.stepName || step.stepType}`);
        emit('');
        continue;
      }

      const ctx: GatlingGeneratorContext = createScriptGeneratorContext(step, preambleCtx);

      const payloadResult: GatlingPayloadResult = gen.generateDefaultPayload(step, ctx);
      const payloadVarName: string = payloadResult.payloadVarName;

      emit(`    // Step ${stepIdx + 1}: ${step.stepName || step.stepType}`);
      emit(`    .exec(`);

      const sessionFnParam: string = `step${stepIdx}`;
      const sessionFnBody: string[] = [];

      for (const line of payloadResult.code) {
        sessionFnBody.push(`      ${line}`);
      }

      if (step.modifyRequests) {
        for (const mod of step.modifyRequests) {
          const modValue: unknown = mod.modifiedValue;

          if (typeof modValue === 'string' && isStepDataReference(modValue)) {
            const ref: {
              dataHandlerName: string;
              jsonPath: string;
            } | null = parseStepDataReference(modValue);
            if (ref) {
              const srcIdx: number | undefined = dataHandlerMap.get(ref.dataHandlerName);
              if (srcIdx !== undefined) {
                const saveKey: string = `resBody${srcIdx}`;
                const stepDataReadCode: string = generateStepDataRead(sessionFnParam, saveKey, ref.jsonPath);
                if ('modifiedParameter' in mod) {
                  sessionFnBody.push(`      ${payloadVarName}.${mod.modifiedParameter} = ${stepDataReadCode};`);
                } else if ('jsonPath' in mod) {
                  sessionFnBody.push(`      ${setNestedValueCode(payloadVarName, mod.jsonPath, stepDataReadCode)}`);
                }
                continue;
              }
            }
          }

          const modLines: string[] = gen.generateModification(mod, payloadVarName, step, ctx);
          for (const line of modLines) {
            sessionFnBody.push(`      ${line}`);
          }
        }
      }

      const saveAsKey: string = `resBody${stepIdx}`;

      const checkLines: string[] = [];
      checkLines.push(`      .check(status().is(${step.returnCode}))`);
      if (step.validateResponse) {
        for (const v of step.validateResponse) {
          const checkCode: string | null = gen.generateValidationCheck(v, '', step, ctx);
          if (checkCode) {
            checkLines.push(`      ${checkCode}`);
          }
        }
      }
      checkLines.push(`      .check(bodyString().saveAs('${saveAsKey}'))`);

      if (typeof gen.generateHttpCallWithChecks === 'function') {
        const httpLines: string[] = gen.generateHttpCallWithChecks(
          sessionFnParam,
          sessionFnBody,
          step,
          ctx,
          checkLines
        );
        for (const line of httpLines) {
          emit(`      ${line}`);
        }
      } else {
        const httpLines: string[] = gen.generateHttpCall(sessionFnParam, sessionFnBody, step, ctx);
        for (const line of httpLines) {
          emit(`      ${line}`);
        }
        for (const line of checkLines) {
          emit(line);
        }
      }

      emit(`    )`);
      emit(`    .pause(1)`);
    }
    emit(`;`);
    emit('}');
    emit('');
    functionNames.push(fnName);
  }

  emitScenarioMetadata(scenarios, emit, '// Scenario metadata', escapeJsString, (step: StepData): string => {
    const gen: GatlingStepGenerator | undefined = gatlingGeneratorRegistry.get(step.stepType);
    return gen?.getEndpoint?.(step) || `'${escapeJsString(`Unknown step type: ${step.stepType}`)}'`;
  });

  emit(`// ── Simulation ──`);
  emit(`export default simulation((setUp) => {`);

  emit(`  const scenarioIndexEnv = getEnvironmentVariable("GATLING_SCENARIO_INDEX");`);
  emit(`  const scenarioIndex = parseInt(scenarioIndexEnv || "0", 10);`);
  emit('');

  const usersPerSec: string = 'parseInt(getEnvironmentVariable("GATLING_USERS_PER_SEC") || "5", 10)';
  const duration: string = 'parseInt(getEnvironmentVariable("GATLING_DURATION_SECONDS") || "60", 10)';
  const maxDuration: string = 'parseInt(getEnvironmentVariable("GATLING_MAX_DURATION_SECONDS") || "120", 10)';

  if (functionNames.length === 0) {
    emit('  // No scenarios generated');
  } else if (functionNames.length === 1) {
    emit(`  console.log('');`);
    emit(`  console.log('='.repeat(60));`);
    emit(`  console.log('  FunPerf - Gatling Simulation');`);
    emit(`  console.log('='.repeat(60));`);
    emit(`  console.log('  Scenario: ' + SCENARIO_METADATA[0].name);`);
    emit(`  console.log('  Steps:    ' + SCENARIO_METADATA[0].steps.length);`);
    emit(`  console.log('='.repeat(60));`);
    emit(`  console.log('');`);
    emit('');
    emit(`  setUp(`);
    emit(`    ${functionNames[0]}()`);
    emit(`      .injectOpen(constantUsersPerSec(${usersPerSec}).during(${duration}))`);
    emit(`  )`);
    emit(`    .maxDuration(${maxDuration});`);
  } else {
    emit('  // Print scenario info');
    emit('  if (scenarioIndex === 0) {');
    emit("    console.log('');");
    emit("    console.log('='.repeat(60));");
    emit("    console.log('  FunPerf - Available Scenarios');");
    emit("    console.log('='.repeat(60));");
    emit('    for (let i = 0; i < SCENARIO_METADATA.length; i++) {');
    emit('      const m = SCENARIO_METADATA[i];');
    emit(`      console.log('  [' + m.index + '] ' + m.name + ' (' + m.steps.length + ' step(s))');`);
    emit('    }');
    emit("    console.log('='.repeat(60));");
    emit("    console.log('');");
    emit("    console.log('  Running all scenarios...');");
    emit("    console.log('');");
    emit('  } else if (scenarioIndex > 0 && scenarioIndex <= SCENARIO_METADATA.length) {');
    emit('    const meta = SCENARIO_METADATA[scenarioIndex - 1];');
    emit("    console.log('');");
    emit("    console.log('='.repeat(60));");
    emit("    console.log('  FunPerf - Gatling Simulation');");
    emit("    console.log('='.repeat(60));");
    emit(`    console.log('  Scenario Index: ' + meta.index);`);
    emit(`    console.log('  Scenario Name:  ' + meta.name);`);
    emit(`    console.log('  Total Steps:    ' + meta.steps.length);`);
    emit("    console.log('');");
    emit("    console.log('  Steps:');");
    emit('    for (let i = 0; i < meta.steps.length; i++) {');
    emit(`      console.log('    [' + i + '] ' + meta.steps[i].name);`);
    emit(`      console.log('        -> ' + meta.steps[i].url);`);
    emit('    }');
    emit("    console.log('='.repeat(60));");
    emit("    console.log('');");
    emit('  }');
    emit('');
    emit(`  if (scenarioIndex === 0) {`);
    emit(`    setUp(`);
    for (let si: number = 0; si < scenarios.length; si++) {
      const scenario: Scenario = scenarios[si];
      const fnName: string = toValidFunctionName(si, scenario.scenarioName);
      const comma: string = si < scenarios.length - 1 ? ',' : '';
      emit(`      ${fnName}()`);
      emit(`        .injectOpen(constantUsersPerSec(${usersPerSec}).during(${duration}))${comma}`);
    }
    emit(`    )`);
    emit(`      .maxDuration(${maxDuration});`);

    for (let si: number = 0; si < scenarios.length; si++) {
      const scenario: Scenario = scenarios[si];
      const fnName: string = toValidFunctionName(si, scenario.scenarioName);
      emit(`  } else if (scenarioIndex === ${si + 1}) {`);
      emit(`    setUp(`);
      emit(`      ${fnName}()`);
      emit(`        .injectOpen(constantUsersPerSec(${usersPerSec}).during(${duration}))`);
      emit(`    )`);
      emit(`      .maxDuration(${maxDuration});`);
    }

    if (scenarios.length > 0) {
      emit(`  } else {`);
      emit(
        `    console.error(\`Invalid GATLING_SCENARIO_INDEX: \${scenarioIndex}. Valid: 0 (all), 1-${scenarios.length}\`);`
      );
      emit(`  }`);
    }
  }

  emit('});');

  return lines.join('\n');
}

function main(): void {
  try {
    const scenariosDir: string = 'tests/scenarios';
    const fileToScenarios: Map<string, Scenario[]> = loadAllScenarios(scenariosDir);
    const scenarios: Scenario[] = Array.from(fileToScenarios.values()).flat();
    console.log(`\nGenerating Gatling simulation for ${scenarios.length} scenario(s) from ${scenariosDir}/...\n`);

    const simulation: string = generateGatlingSimulation(scenarios);

    const outDir: string = 'performance_scripts/gatling';
    const outPath: string = path.join(outDir, 'performance-test.gatling.ts');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(outPath, simulation, 'utf-8');
    console.log(`✓ Generated: ${outPath}\n`);
    console.log('Run with:');
    console.log(`  npx gatling run --sources-folder performance_scripts/gatling --simulation performance-test`);
    console.log(
      `  GATLING_SCENARIO_INDEX=2 npx gatling run --sources-folder performance_scripts/gatling --simulation performance-test\n`
    );

    for (let i: number = 0; i < scenarios.length; i++) {
      const s: Scenario = scenarios[i];
      const stepCount: number = s.steps.length;
      const supportedCount: number = s.steps.filter((st: StepData): boolean =>
        gatlingGeneratorRegistry.has(st.stepType)
      ).length;
      const skippedCount: number = stepCount - supportedCount;

      if (supportedCount === 0) {
        console.log(`  [${i + 1}] "${s.scenarioName}": skipped (${stepCount} step(s), no supported step types)`);
        continue;
      }

      if (skippedCount > 0) {
        const skippedSteps: string[] = s.steps
          .filter((st: StepData): boolean => !gatlingGeneratorRegistry.has(st.stepType))
          .map((st: StepData): string => {
            const stepName: string = st.stepName || st.stepType;
            return `  - "${stepName}" (${st.stepType})`;
          });
        console.log(
          `  [${i + 1}] "${s.scenarioName}": ${stepCount} step(s), ${skippedCount} skipped${skippedCount > 1 ? 's' : ''} (${skippedSteps.join(', ')})`
        );
      } else {
        console.log(`  [${i + 1}] "${s.scenarioName}": ${stepCount} step(s)`);
      }
    }
  } catch (error) {
    console.error('Failed to generate Gatling simulation:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}
