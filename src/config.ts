import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { BrowserSelector } from './test-modules/browser/types';

/**
 * Mapping of host alias to fully-qualified base URL, as declared in `config.yaml`
 * under the `hosts` key and referenced by steps via {@link StepData.hostRef}.
 */
interface HostsConfig {
  [alias: string]: string;
}

/**
 * Recursive selector tree used to look up a {@link BrowserSelector} by name.
 * Each entry can either be a leaf selector definition or a nested group.
 */
interface BrowserSelectorConfig {
  [name: string]: BrowserSelector | BrowserSelectorConfig;
}

/**
 * Browser-related configuration, currently exposing the named selector tree.
 */
interface BrowserConfig {
  selectors: BrowserSelectorConfig;
}

/**
 * Runtime test execution options.
 */
interface TestConfig {
  /** Path (relative to the project root) to the scenario file to run. */
  file_path: string;
  /** Default timeout in milliseconds applied to each step. */
  timeout_ms: number;
  /** When true, allows execution of the authorized-calculator demo flow. */
  allow_auth_demo?: boolean;
}

/**
 * Per-instance overrides for the authorized-calculator token configuration.
 */
interface AuthorizedCalculatorInstanceOverride {
  /** Time-to-live (seconds) of an authorization token for this instance. */
  token_ttl_seconds?: number;
  /** Skew (seconds) applied when refreshing a token before it expires. */
  token_refresh_skew_seconds?: number;
}

/**
 * Configuration for the authorized-calculator module and its named instances.
 */
interface AuthorizedCalculatorConfig {
  /** Default time-to-live (seconds) of an authorization token. */
  token_ttl_seconds: number;
  /** Default skew (seconds) applied when refreshing a token before it expires. */
  token_refresh_skew_seconds: number;
  /** Optional per-instance overrides keyed by step instance name. */
  instances?: Record<string, AuthorizedCalculatorInstanceOverride>;
}

/**
 * Root shape of the application configuration loaded from `config.yaml`.
 *
 * The resolved configuration is exposed as the {@link config} singleton and
 * merged with sensible defaults so every section is always present.
 */
interface AppConfig {
  hosts: HostsConfig;
  browser: BrowserConfig;
  test: TestConfig;
  authorized_calculator: AuthorizedCalculatorConfig;
}

const configPath: string = path.resolve('config.yaml');

const defaultConfig: AppConfig = {
  hosts: {},
  browser: { selectors: {} },
  test: { file_path: 'tests/scenarios/calculator-demo.yaml', timeout_ms: 30000, allow_auth_demo: false },
  authorized_calculator: {
    token_ttl_seconds: 3600,
    token_refresh_skew_seconds: 30,
    instances: {},
  },
};

/**
 * Parses an environment variable value into a positive safe integer.
 *
 * Used for validating numeric configuration overrides such as `TEST_TIMEOUT_MS`.
 *
 * @param value - Raw environment variable value to parse.
 * @param variableName - Name of the variable, included in error messages.
 * @returns The validated positive integer.
 * @throws {Error} When `value` is not a numeric string or is not a positive safe integer.
 */
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
  if (raw?.browser) {
    defaultConfig.browser = {
      ...defaultConfig.browser,
      ...raw.browser,
      selectors: {
        ...defaultConfig.browser.selectors,
        ...raw.browser.selectors,
      },
    };
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

/**
 * Resolved application configuration.
 *
 * Built by merging the framework defaults with the contents of `config.yaml`
 * (when present) and applying the supported environment variable overrides
 * (`TEST_FILE_PATH`, `TEST_TIMEOUT_MS`).
 */
export const config: AppConfig = defaultConfig;
export type {
  AppConfig,
  BrowserConfig,
  BrowserSelectorConfig,
  TestConfig,
  HostsConfig,
  AuthorizedCalculatorConfig,
  AuthorizedCalculatorInstanceOverride,
};
