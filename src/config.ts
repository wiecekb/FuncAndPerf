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

interface AuthorizedCalculatorInstanceOverride {
  token_ttl_seconds?: number;
  token_refresh_skew_seconds?: number;
}

interface AuthorizedCalculatorConfig {
  token_ttl_seconds: number;
  token_refresh_skew_seconds: number;
  instances?: Record<string, AuthorizedCalculatorInstanceOverride>;
}

interface AppConfig {
  hosts: HostsConfig;
  test: TestConfig;
  authorized_calculator: AuthorizedCalculatorConfig;
}

const configPath: string = path.resolve('config.yaml');

const defaultConfig: AppConfig = {
  hosts: {},
  test: { file_path: 'tests/scenarios/calculator-demo.json', timeout_ms: 30000, allow_auth_demo: false },
  authorized_calculator: {
    token_ttl_seconds: 3600,
    token_refresh_skew_seconds: 30,
    instances: {},
  },
};

export function parsePositiveIntegerEnv(value: string, variableName: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${variableName} must be a positive integer, got: ${value}`);
  }

  const parsed: number = parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${variableName} must be a positive integer, got: ${value}`);
  }

  return parsed;
}

if (fs.existsSync(configPath)) {
  const raw = yaml.load(fs.readFileSync(configPath, 'utf-8')) as Partial<AppConfig>;
  if (raw?.hosts) {
    defaultConfig.hosts = { ...defaultConfig.hosts, ...raw.hosts };
  }
  if (raw?.test) {
    defaultConfig.test = { ...defaultConfig.test, ...raw.test };
  }
  if (raw?.authorized_calculator) {
    const { instances: rawInstances, ...rawScalars } = raw.authorized_calculator;
    defaultConfig.authorized_calculator = {
      ...defaultConfig.authorized_calculator,
      ...rawScalars,
      instances: {
        ...defaultConfig.authorized_calculator.instances,
        ...rawInstances,
      },
    };
  }
}

if (process.env.TEST_FILE_PATH) {
  defaultConfig.test.file_path = process.env.TEST_FILE_PATH;
}
if (process.env.TEST_TIMEOUT_MS) {
  defaultConfig.test.timeout_ms = parsePositiveIntegerEnv(process.env.TEST_TIMEOUT_MS, 'TEST_TIMEOUT_MS');
}

export const config: AppConfig = defaultConfig;
export type { AppConfig, TestConfig, HostsConfig, AuthorizedCalculatorConfig, AuthorizedCalculatorInstanceOverride };
