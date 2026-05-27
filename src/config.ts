
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface CalculatorConfig {
    url: string;
}

interface TestConfig {
    file_path: string;
    timeout_ms: number;
}

interface AppConfig {
    calculator: CalculatorConfig;
    test: TestConfig;
}

const configPath: string = path.resolve('config.yaml');

const defaultConfig: AppConfig = {
    calculator: {url: 'http://localhost:3000'},
    test: {file_path: 'tests/scenarios/calculator-demo.json', timeout_ms: 30000}
};

if (fs.existsSync(configPath)) {
    const raw = yaml.load(fs.readFileSync(configPath, 'utf-8')) as Partial<AppConfig>;
    if (raw?.calculator) {
        defaultConfig.calculator = {...defaultConfig.calculator, ...raw.calculator};
    }
    if (raw?.test) {
        defaultConfig.test = {...defaultConfig.test, ...raw.test};
    }
}

if (process.env['calculator.url']) {
    defaultConfig.calculator.url = process.env['calculator.url'];
}
if (process.env.TEST_FILE_PATH) {
    defaultConfig.test.file_path = process.env.TEST_FILE_PATH;
}
if (process.env.TEST_TIMEOUT_MS) {
    defaultConfig.test.timeout_ms = parseInt(process.env.TEST_TIMEOUT_MS, 10);
}

export const config: AppConfig = defaultConfig;
export type {AppConfig, CalculatorConfig, TestConfig};
