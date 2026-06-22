/**
 * Discriminator identifying which test-module generator handles a step.
 *
 * - `CALCULATOR` - unauthenticated calculator API steps.
 * - `AUTHORIZED_CALCULATOR` - calculator steps that require an authorization token.
 * - `BROWSER` - browser/UI steps executed through Playwright or k6 browser.
 */
export enum ScenarioType {
  CALCULATOR = 'CALCULATOR',
  AUTHORIZED_CALCULATOR = 'AUTHORIZED_CALCULATOR',
  BROWSER = 'BROWSER',
}

/**
 * Alias of a host declared in {@link AppConfig.hosts}. Steps reference a host
 * via {@link StepData.hostRef} so the same scenario can target different
 * environments without editing step definitions.
 */
export type HostRef = string;
