import {loadScenarios, Scenario, type StepData} from '../src/scenario/loader';
import * as fs from 'fs';
import * as path from 'path';

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

export function loadAllScenarios(dirPath: string): Scenario[] {
    const files: string[] = fs.readdirSync(dirPath).filter((f: string): boolean => f.endsWith('.json'));
    const allScenarios: Scenario[] = [];
    for (const file of files) {
        const filePath: string = path.join(dirPath, file);
        try {
            const scenarios: Scenario[] = loadScenarios(filePath);
            allScenarios.push(...scenarios);
        } catch (e) {
            console.warn(`Warning: Could not load scenarios from ${filePath}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    return allScenarios;
}

export function isStepDataReference(value: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*\.response\.\$/.test(value);
}

export function parseStepDataReference(value: string): { dataHandlerName: string; jsonPath: string } | null {
    const match: RegExpMatchArray | null = value.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.response\.\$(\..+)$/);
    if (!match) return null;
    return {dataHandlerName: match[1], jsonPath: `$${match[2]}`};
}

/** Generate SCENARIO_METADATA array — shared between Gatling and k6 generators */
export function emitScenarioMetadata(
    scenarios: Scenario[],
    emit: (line?: string) => number,
    commentLine: string,
    escapeFn: (s: string) => string,
    getStepUrl: (step: StepData) => string,
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

