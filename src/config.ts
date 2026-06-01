import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface HostsConfig {
    [alias: string]: string;
}

interface TestConfig {
    file_path: string;
    timeout_ms: number;
    allow_auth_demo?: boolean;
}

interface AppConfig {
    hosts: HostsConfig;
    test: TestConfig;
}

const configPath: string = path.resolve('config.yaml');

const defaultConfig: AppConfig = {
    hosts: {},
    test: {file_path: 'tests/scenarios/calculator-demo.json', timeout_ms: 30000, allow_auth_demo: false}
};

if (fs.existsSync(configPath)) {
    const raw = yaml.load(fs.readFileSync(configPath, 'utf-8')) as Partial<AppConfig>;
    if (raw?.hosts) {
        defaultConfig.hosts = {...defaultConfig.hosts, ...raw.hosts};
    }
    if (raw?.test) {
        defaultConfig.test = {...defaultConfig.test, ...raw.test};
    }
}

if (process.env.TEST_FILE_PATH) {
    defaultConfig.test.file_path = process.env.TEST_FILE_PATH;
}
if (process.env.TEST_TIMEOUT_MS) {
    defaultConfig.test.timeout_ms = parseInt(process.env.TEST_TIMEOUT_MS, 10);
}

export const config: AppConfig = defaultConfig;
export type {AppConfig, TestConfig, HostsConfig};
