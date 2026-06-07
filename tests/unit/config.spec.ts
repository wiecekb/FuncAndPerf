import { expect, test } from '@playwright/test';
import {AuthorizedCalculatorInstanceOverride, config, parsePositiveIntegerEnv} from '../../src/config';
import {
  resolveAuthorizedCalcConfigForStep,
  ResolvedAuthorizedCalcConfig
} from '../../src/test-modules/authorized-calculator/config';
import type { StepData } from '../../src/scenario/loader';
import { ScenarioType } from '../../src/scenario/types';
import { resolveBrowserSelectorReference } from '../../src/test-modules/browser/selectors';

test.describe('Config helpers', (): void => {
  test('parsePositiveIntegerEnv parses positive integer', (): void => {
    expect(parsePositiveIntegerEnv('30000', 'TEST_TIMEOUT_MS')).toBe(30000);
  });

  test('parsePositiveIntegerEnv rejects zero', (): void => {
    expect(() => parsePositiveIntegerEnv('0', 'TEST_TIMEOUT_MS')).toThrow(
      'TEST_TIMEOUT_MS must be a positive integer, got: 0'
    );
  });

  test('parsePositiveIntegerEnv rejects non-numeric value', (): void => {
    expect(() => parsePositiveIntegerEnv('abc', 'TEST_TIMEOUT_MS')).toThrow(
      'TEST_TIMEOUT_MS must be a positive integer, got: abc'
    );
  });

  test('parsePositiveIntegerEnv rejects partially numeric value', (): void => {
    expect(() => parsePositiveIntegerEnv('1000ms', 'TEST_TIMEOUT_MS')).toThrow(
      'TEST_TIMEOUT_MS must be a positive integer, got: 1000ms'
    );
  });
});

test.describe('Browser selector config', (): void => {
  test('config.yaml has browser selectors map', (): void => {
    expect(config.browser.selectors).toBeDefined();
    expect(config.browser.selectors).toHaveProperty('mainPage');
  });

  test('resolveBrowserSelectorReference returns nested selector from config.yaml', (): void => {
    expect(resolveBrowserSelectorReference('mainPage.heading')).toEqual({ kind: 'css', value: 'h1' });
    expect(resolveBrowserSelectorReference('mainPage.docsLink')).toEqual({
      kind: 'role',
      role: 'link',
      name: 'Docs',
    });
  });

  test('resolveBrowserSelectorReference rejects unknown selector', (): void => {
    expect(() => resolveBrowserSelectorReference('mainPage.unknown')).toThrow(
      "Browser selector reference 'mainPage.unknown' not found in config.yaml browser.selectors"
    );
  });
});

test.describe('AuthorizedCalculator per-instance config', (): void => {
  test('config.yaml has `instances` map with per-instance overrides', (): void => {
    const instances: Record<string, AuthorizedCalculatorInstanceOverride> | undefined = config.authorized_calculator.instances;
    expect(instances).toBeDefined();
    expect(instances).toHaveProperty('primaryCalc');
    expect(instances).toHaveProperty('secondaryCalc');
    expect(instances!.primaryCalc).toHaveProperty('token_ttl_seconds');
    expect(instances!.secondaryCalc).toHaveProperty('token_ttl_seconds');
    expect(instances!.secondaryCalc).toHaveProperty('token_refresh_skew_seconds');
  });

  test('resolveAuthorizedCalcConfigForStep returns instance override when stepInstanceName matches', (): void => {
    const primaryStep: StepData = {
      stepType: ScenarioType.AUTHORIZED_CALCULATOR,
      stepInstanceName: 'primaryCalc',
      returnCode: 200,
    };
    const configForPrimary: ResolvedAuthorizedCalcConfig = resolveAuthorizedCalcConfigForStep(primaryStep);
    expect(configForPrimary.tokenTtlSeconds).toBe(3600);

    const secondaryStep: StepData = {
      stepType: ScenarioType.AUTHORIZED_CALCULATOR,
      stepInstanceName: 'secondaryCalc',
      returnCode: 200,
    };
    const configForSecondary: ResolvedAuthorizedCalcConfig = resolveAuthorizedCalcConfigForStep(secondaryStep);
    expect(configForSecondary.tokenTtlSeconds).toBe(7200);
    expect(configForSecondary.tokenRefreshSkewSeconds).toBe(60);
  });

  test('resolveAuthorizedCalcConfigForStep falls back to global defaults when step has no stepInstanceName', (): void => {
    const step: StepData = {
      stepType: ScenarioType.AUTHORIZED_CALCULATOR,
      returnCode: 200,
    };
    const result: ResolvedAuthorizedCalcConfig = resolveAuthorizedCalcConfigForStep(step);
    expect(result.tokenTtlSeconds).toBe(config.authorized_calculator.token_ttl_seconds);
    expect(result.tokenRefreshSkewSeconds).toBe(config.authorized_calculator.token_refresh_skew_seconds);
  });

  test('resolveAuthorizedCalcConfigForStep falls back to global defaults for unknown instance name', (): void => {
    const step: StepData = {
      stepType: ScenarioType.AUTHORIZED_CALCULATOR,
      stepInstanceName: 'unknownInstance',
      returnCode: 200,
    };
    const result: ResolvedAuthorizedCalcConfig = resolveAuthorizedCalcConfigForStep(step);
    expect(result.tokenTtlSeconds).toBe(config.authorized_calculator.token_ttl_seconds);
    expect(result.tokenRefreshSkewSeconds).toBe(config.authorized_calculator.token_refresh_skew_seconds);
  });
});
