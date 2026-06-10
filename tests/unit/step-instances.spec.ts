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

  test('cleanup close failures do not prevent other contexts from closing', async (): Promise<void> => {
    let close2Called = false;
    const mockContext1 = {
      newPage: async () => ({}) as never,
      close: async (): Promise<void> => {
        throw new Error('Forced close failure');
      },
    };
    const mockContext2 = {
      newPage: async () => ({}) as never,
      close: async (): Promise<void> => {
        close2Called = true;
      },
    };

    let callCount = 0;
    const mockBrowser = {
      newContext: async () => {
        callCount++;
        return callCount === 1 ? mockContext1 : mockContext2;
      },
    };

    const context = new ScenarioExecutionContext(mockBrowser as never, {} as never);

    await context.getBrowserPage({
      stepType: ScenarioType.BROWSER,
      stepInstanceName: 'first',
      returnCode: 200,
    });
    await context.getBrowserPage({
      stepType: ScenarioType.BROWSER,
      stepInstanceName: 'second',
      returnCode: 200,
    });

    // Powinno wypisać ostrzeżenie w konsoli o błędzie zamknięcia, ale nie rzucać wyjątku i pomyślnie zamknąć drugi kontekst
    await expect(context.cleanup()).resolves.not.toThrow();
    expect(close2Called).toBe(true);
  });
});
