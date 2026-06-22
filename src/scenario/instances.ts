/** Step instance name used when a step does not declare an explicit {@link StepData.stepInstanceName}. */
export const DEFAULT_STEP_INSTANCE_NAME = 'default';

/**
 * Regular expression validating step instance names. Must start with a letter
 * or underscore, followed by letters, digits, underscores or hyphens.
 */
export const STEP_INSTANCE_NAME_PATTERN = '^[a-zA-Z_][a-zA-Z0-9_-]*$';

/**
 * Returns the effective step instance name, falling back to
 * {@link DEFAULT_STEP_INSTANCE_NAME} when none is declared.
 *
 * @param step - Step carrying an optional `stepInstanceName`.
 * @returns Resolved instance name.
 */
export function getStepInstanceName(step: { stepInstanceName?: string }): string {
  return step.stepInstanceName || DEFAULT_STEP_INSTANCE_NAME;
}

/**
 * Builds the composite key (`<stepType>:<instanceName>`) used to group runtime
 * state (host reference, browser instance, captured data) for a step.
 *
 * @param step - Step providing the type and optional instance name.
 * @returns Composite instance key.
 */
export function getStepInstanceKey(step: { stepType: string; stepInstanceName?: string }): string {
  return `${step.stepType}:${getStepInstanceName(step)}`;
}
