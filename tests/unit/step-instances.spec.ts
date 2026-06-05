import { expect, test } from '@playwright/test';
import { ScenarioExecutionContext } from '../../src/scenario/execution-context';
import { getStepInstanceKey, getStepInstanceName } from '../../src/scenario/instances';
import { ScenarioType } from '../../src/scenario/types';
import type { StepData } from '../../src/scenario/loader';

test.describe('Step instances', (): void => {
  test('default instance is used when stepInstanceName is missing', (): void => {
    const step: StepData = {
      stepType: ScenarioType.CALCULATOR,
      returnCode: 200,
    };

    expect(getStepInstanceName(step)).toBe('default');
    expect(getStepInstanceKey(step)).toBe('CALCULATOR:default');
  });

  test('same instance name does not collide across step types', (): void => {
    expect(getStepInstanceKey({ stepType: ScenarioType.CALCULATOR, stepInstanceName: 'main' })).toBe('CALCULATOR:main');
    expect(getStepInstanceKey({ stepType: ScenarioType.BROWSER, stepInstanceName: 'main' })).toBe('BROWSER:main');
  });

  test('hostRef state is isolated per stepType and stepInstanceName', (): void => {
    const context = new ScenarioExecutionContext({} as never, {} as never);
    const primary: StepData = {
      stepType: ScenarioType.CALCULATOR,
      stepInstanceName: 'primary',
      returnCode: 200,
    };
    const secondary: StepData = {
      stepType: ScenarioType.CALCULATOR,
      stepInstanceName: 'secondary',
      returnCode: 200,
    };

    context.setCurrentHostRef(primary, 'calcApi');
    context.setCurrentHostRef(secondary, 'otherCalcApi');

    expect(context.getCurrentHostRef(primary)).toBe('calcApi');
    expect(context.getCurrentHostRef(secondary)).toBe('otherCalcApi');
  });
});
