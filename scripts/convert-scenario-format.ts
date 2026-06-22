/**
 * CLI utility converting scenario files between JSON and YAML formats.
 *
 * Reads a scenario file, re-serialises it to the requested format and writes it
 * next to the source (or to an explicit output path). Run via
 * `npm run scenario:convert`.
 *
 * @packageDocumentation
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { pathToFileURL } from 'url';
import { loadScenariosFromFilePath } from '../src';
import type { ScenarioData } from '../src';

/** Output format supported by the scenario converter. */
export type ScenarioOutputFormat = 'json' | 'yaml';

interface ConvertScenarioOptions {
  outputPath?: string;
  format?: ScenarioOutputFormat;
}

function printHelp(): void {
  console.log('Scenario format converter');
  console.log('');
  console.log('Usage:');
  console.log('  npm run scenario:convert -- --input <path> --to <json|yaml> [--output <path>]');
  console.log('');
  console.log('Options:');
  console.log('  --input <path>                 Source scenario file (.json, .yaml, .yml)');
  console.log('  --to <json|yaml>              Output format');
  console.log('  --output <path>               Optional target file path');
  console.log('  --help, -h                    Show this help');
}

function normalizeOutputFormat(value: string): ScenarioOutputFormat {
  const normalized = value.toLowerCase();
  if (normalized === 'json' || normalized === 'yaml' || normalized === 'yml') {
    return normalized === 'json' ? 'json' : 'yaml';
  }

  throw new Error(`Unsupported output format: ${value}. Expected json or yaml.`);
}

/**
 * Returns the file extension matching the requested output format.
 *
 * @param format - Target output format.
 * @returns `'.json'` or `'.yaml'`.
 */
export function getScenarioFileExtension(format: ScenarioOutputFormat): '.json' | '.yaml' {
  return format === 'json' ? '.json' : '.yaml';
}

/**
 * Resolves the output path for a converted scenario file.
 *
 * When `explicitOutputPath` is provided it is used verbatim; otherwise the path
 * is derived from `inputPath` by swapping its extension for the one matching
 * `format`.
 *
 * @param inputPath - Source scenario file path.
 * @param format - Target output format.
 * @param explicitOutputPath - Optional explicit output path override.
 * @returns Resolved output path.
 */
export function resolveOutputPath(
  inputPath: string,
  format: ScenarioOutputFormat,
  explicitOutputPath?: string
): string {
  if (explicitOutputPath) {
    return explicitOutputPath;
  }

  const parsedPath = path.parse(inputPath);
  return path.join(parsedPath.dir, `${parsedPath.name}${getScenarioFileExtension(format)}`);
}

/**
 * Serialises scenarios into the requested format string.
 *
 * @param scenarios - Scenario payloads to serialise.
 * @param format - Target output format.
 * @returns Serialised scenario document.
 */
export function serializeScenarios(
  scenarios: ScenarioData[],
  format: ScenarioOutputFormat
): string {
  if (format === 'json') {
    return `${JSON.stringify(scenarios, null, 2)}\n`;
  }

  return yaml.dump(scenarios, {
    schema: yaml.JSON_SCHEMA,
    noRefs: true,
    lineWidth: -1,
    sortKeys: false,
  });
}

/**
 * Converts a single scenario file to the requested format and writes it to the
 * resolved output path.
 *
 * @param inputPath - Source scenario file path.
 * @param options - Conversion options (format and optional output path).
 * @returns The output path that was written.
 * @throws {Error} When no output format is provided.
 */
export function convertScenarioFile(inputPath: string, options: ConvertScenarioOptions): string {
  const format = options.format ?? (() => {
    throw new Error('Output format is required.');
  })();
  const outputPath = resolveOutputPath(inputPath, format, options.outputPath);
  const scenarios = loadScenariosFromFilePath(inputPath).map((scenario) => scenario.rawData);
  const content = serializeScenarios(scenarios, format);
  fs.writeFileSync(outputPath, content, 'utf-8');
  return outputPath;
}

function parseArgs(args: string[]): { inputPath: string; outputPath?: string; format: ScenarioOutputFormat } {
  let inputPath: string | undefined;
  let outputPath: string | undefined;
  let format: ScenarioOutputFormat | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--input') {
      inputPath = args[++i];
    } else if (arg === '--output') {
      outputPath = args[++i];
    } else if (arg === '--to') {
      format = normalizeOutputFormat(args[++i]);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!inputPath) {
    throw new Error('Missing required --input argument.');
  }
  if (!format) {
    throw new Error('Missing required --to argument.');
  }

  return { inputPath, outputPath, format };
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  try {
    const { inputPath, outputPath, format } = parseArgs(args);
    const writtenFilePath = convertScenarioFile(inputPath, { outputPath, format });
    console.log(`Converted ${inputPath} -> ${writtenFilePath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Scenario conversion failed: ${message}`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}
