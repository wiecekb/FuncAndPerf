export const DEFAULT_STEP_INSTANCE_NAME = 'default';
export const STEP_INSTANCE_NAME_PATTERN = '^[a-zA-Z_][a-zA-Z0-9_-]*$';

export function getStepInstanceName(step: { stepInstanceName?: string }): string {
  return step.stepInstanceName || DEFAULT_STEP_INSTANCE_NAME;
}

export function getStepInstanceKey(step: { stepType: string; stepInstanceName?: string }): string {
  return `${step.stepType}:${getStepInstanceName(step)}`;
}
