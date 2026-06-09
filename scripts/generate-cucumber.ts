import { type Scenario, type StepData } from '../src/scenario/loader';
import { ScenarioType } from '../src/scenario/types';
import { loadAllScenarios } from './shared';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import type { BrowserAdditionalData, BrowserInstruction } from '../src/test-modules/browser/types';

function printHelp(): void {
  console.log('Cucumber/Gherkin generator help');
  console.log('');
  console.log('Usage:');
  console.log('  npm run cucumber:generate');
  console.log('  npm run cucumber:generate -- -h');
  console.log('  npm run cucumber:generate -- --help');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h                       Show this help');
  console.log('');
  console.log('What this generator does:');
  console.log('  - loads all JSON scenarios from tests/scenarios');
  console.log('  - generates human-readable Cucumber/Gherkin .feature files');
  console.log('  - one feature file per JSON file');
  console.log('  - saves files to features/ directory');
}

function toValidFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.json$/, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, '-')
    .trim();
}

function escapeGherkinString(str: any): string {
  const stringValue: string = String(str || '');
  return stringValue.replace(/"/g, '\\"');
}

function formatGherkinLine(line: string, indent: number = 0): string {
  return '  '.repeat(indent) + line;
}

function generateCalculatorStepLines(step: StepData, indent: number): string[] {
  const lines: string[] = [];

  if (step.modifyRequests && step.modifyRequests.length > 0) {
    for (const mod of step.modifyRequests) {
      if ('modifiedParameter' in mod) {
        if (mod.modifiedValue && mod.modifiedValue.includes('.')) {
          const match: RegExpMatchArray | null = mod.modifiedValue.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.response\.\$(\..+)$/);
          if (match) {
            const fieldName: string = match[2].startsWith('.') ? match[2].substring(1) : match[2];
            lines.push(
              formatGherkinLine(
                `Given parameter '${mod.modifiedParameter}' is set to value from step '${match[1]}' field '${fieldName}'`,
                indent
              )
            );
          } else {
            lines.push(
              formatGherkinLine(
                `Given parameter '${mod.modifiedParameter}' is set to '${escapeGherkinString(String(mod.modifiedValue))}'`,
                indent
              )
            );
          }
        } else {
          lines.push(
            formatGherkinLine(
              `Given parameter '${mod.modifiedParameter}' is set to '${escapeGherkinString(String(mod.modifiedValue))}'`,
              indent
            )
          );
        }
      } else if ('jsonPath' in mod) {
        lines.push(
          formatGherkinLine(
            `Given field at '${mod.jsonPath}' is set to '${escapeGherkinString(String(mod.modifiedValue))}'`,
            indent
          )
        );
      }
    }
  }

  if (step.additionalData?.operation) {
    lines.push(
      formatGherkinLine(`When '${step.additionalData.operation}' operation is performed`, indent)
    );
  } else {
    lines.push(
      formatGherkinLine(`When calculator operation is performed`, indent)
    );
  }

  lines.push(
    formatGherkinLine(`Then response should have status code ${step.returnCode}`, indent)
  );

  if (step.validateResponse && step.validateResponse.length > 0) {
    for (const validation of step.validateResponse) {
      if ('validatedParameter' in validation) {
        lines.push(
          formatGherkinLine(
            `And field '${validation.validatedParameter}' should be ${validation.validationType === 'include' ? 'include' : 'equal'} to '${escapeGherkinString(String(validation.validatedParameterValue))}'`,
            indent
          )
        );
      } else if ('jsonPath' in validation) {
        lines.push(
          formatGherkinLine(
            `And field at '${validation.jsonPath}' should be ${validation.validationType === 'include' ? 'include' : 'equal'} to '${escapeGherkinString(String(validation.validatedParameterValue))}'`,
            indent
          )
        );
      }
    }
  }

  return lines;
}

function generateBrowserStepLines(step: StepData, indent: number): string[] {
  const lines: string[] = [];
  const additionalData = step.additionalData as BrowserAdditionalData;

  if (additionalData?.instructions) {
    for (const instruction of additionalData.instructions as BrowserInstruction[]) {
      if (instruction.kind === 'action') {
        switch (instruction.action) {
          case 'goto':
            lines.push(
              formatGherkinLine(`When user navigates to '${escapeGherkinString(instruction.value || '')}'`, indent)
            );
            break;
          case 'click':
            lines.push(
              formatGherkinLine(`When user clicks on '${escapeGherkinString(instruction.selector || '')}'`, indent)
            );
            break;
          case 'fill':
            lines.push(
              formatGherkinLine(
                `When user fills '${escapeGherkinString(instruction.selector || '')}' with '${escapeGherkinString(instruction.value || '')}'`,
                indent
              )
            );
            break;
          case 'press':
            lines.push(
              formatGherkinLine(
                `When user presses '${escapeGherkinString(instruction.key || '')}' on '${escapeGherkinString(instruction.selector || '')}'`,
                indent
              )
            );
            break;
          case 'waitFor':
            lines.push(
              formatGherkinLine(`When user waits for '${escapeGherkinString(instruction.selector || '')}'`, indent)
            );
            break;
          case 'screenshot':
            lines.push(
              formatGherkinLine(`When user takes screenshot`, indent)
            );
            break;
        }
      } else if (instruction.kind === 'assertion') {
        switch (instruction.assertion) {
          case 'toHaveURL':
            lines.push(
              formatGherkinLine(
                `Then URL should be '${escapeGherkinString(instruction.expected || '')}'`,
                indent
              )
            );
            break;
          case 'toBeVisible':
            lines.push(
              formatGherkinLine(`Then '${escapeGherkinString(instruction.selector || '')}' should be visible`, indent)
            );
            break;
          case 'toHaveText':
            lines.push(
              formatGherkinLine(
                `Then '${escapeGherkinString(instruction.selector || '')}' should have text '${escapeGherkinString(instruction.expected || '')}'`,
                indent
              )
            );
            break;
          case 'toContainText':
            lines.push(
              formatGherkinLine(
                `Then '${escapeGherkinString(instruction.selector || '')}' should contain text '${escapeGherkinString(instruction.expected || '')}'`,
                indent
              )
            );
            break;
          case 'toHaveValue':
            lines.push(
              formatGherkinLine(
                `Then '${escapeGherkinString(instruction.selector || '')}' should have value '${escapeGherkinString(instruction.expected || '')}'`,
                indent
              )
            );
            break;
        }
      } else if (instruction.kind === 'extract') {
        lines.push(
          formatGherkinLine(
            `When user extracts ${instruction.extract} as '${escapeGherkinString(instruction.saveAs)}'`,
            indent
          )
        );
      }
    }
  }

  return lines;
}

function generateStepLines(step: StepData, indent: number): string[] {
  switch (step.stepType) {
    case ScenarioType.CALCULATOR:
    case ScenarioType.AUTHORIZED_CALCULATOR:
      return generateCalculatorStepLines(step, indent);
    case ScenarioType.BROWSER:
      return generateBrowserStepLines(step, indent);
    default:
      return [
        formatGherkinLine(`When ${step.stepType} step is executed`, indent)
      ];
  }
}

function generateScenarioLines(scenario: Scenario): string[] {
  const lines: string[] = [];
  lines.push(formatGherkinLine(`Scenario: ${scenario.scenarioName}`, 1));

  for (const step of scenario.steps) {
    const stepLines: string[] = generateStepLines(step, 2);
    lines.push(...stepLines);
  }

  lines.push('');
  return lines;
}

function generateFeatureFile(scenarios: Scenario[], fileName: string): string {
  const lines: string[] = [];

  const featureName: string = fileName.replace('.json', '').replace(/-/g, ' ').split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
  
  lines.push(`Feature: ${featureName}`);
  lines.push('  As a system user');
  lines.push('  I want to test the system functionality');
  lines.push('  So that I can verify the system works correctly');
  lines.push('');

  for (const scenario of scenarios) {
    const scenarioLines: string[] = generateScenarioLines(scenario);
    lines.push(...scenarioLines);
  }

  return lines.join('\n');
}

function main(): void {
  const args: string[] = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const outputDir: string = path.join(process.cwd(), 'features');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    const fileToScenarios: Map<string, Scenario[]> = loadAllScenarios(path.join(process.cwd(), 'tests', 'scenarios'));
    console.log(`Loaded ${Array.from(fileToScenarios.values()).flat().length} scenarios from ${fileToScenarios.size} files`);

    for (const [fileName, scenarios] of fileToScenarios.entries()) {
      const featureFileName: string = toValidFilename(fileName) + '.feature';
      const filePath: string = path.join(outputDir, featureFileName);
      const content: string = generateFeatureFile(scenarios, fileName);
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Generated: ${filePath}`);
    }

    console.log(`\nSuccessfully generated ${fileToScenarios.size} feature files`);

  } catch (error) {
    console.error('Error generating Cucumber files:', error);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}
