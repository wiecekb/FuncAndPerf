/**
 * FuncAndPerf - API Test Automation & Performance Testing Framework.
 *
 * This barrel module re-exports the public surface of the framework so it can be
 * consumed as a single entry point and documented by TypeDoc. Importing it also
 * triggers registration of the built-in test-module generators (calculator,
 * authorized-calculator, browser) into the central k6 and Gatling registries.
 *
 * @packageDocumentation
 */

// Core configuration
export * from './config';

// Scenario definitions, loading and runtime
export * from './scenario/types';
export * from './scenario/modify';
export * from './scenario/loader';
export * from './scenario/instances';
export * from './scenario/execution-context';
export * from './scenario/data/registry';
export * from './scenario/data/resolve';

// Shared building blocks
export * from './common/api-response';
export * from './common/codegen';
export * from './common/modifications';
export * from './common/validations';

// k6 generator contracts and registry
export * from './k6/interface';
export * from './k6/common';
export * from './k6/registry';

// Gatling generator contracts and registry
export * from './gatling/interface';
export * from './gatling/common';
export * from './gatling/registry';

// Reporting and assertion helpers
export * from './allure/helpers';
export * from './utils/logging-expect';

// Test modules - public configs and types
export {
  OPERATION_TO_ENDPOINT as CALC_OPERATION_TO_ENDPOINT,
  PARAMETER_TO_JSON_PATH as CALC_PARAMETER_TO_JSON_PATH,
} from './test-modules/calculator/config';
export * from './test-modules/calculator/types';
export {
  AUTHORIZED_CALC_OPERATION_TO_ENDPOINT,
  PARAMETER_TO_JSON_PATH as AUTHORIZED_CALC_PARAMETER_TO_JSON_PATH,
  resolveAuthorizedCalcConfigForStep,
  type ResolvedAuthorizedCalcConfig,
} from './test-modules/authorized-calculator/config';
export * from './test-modules/authorized-calculator/types';
export * from './test-modules/browser/types';
