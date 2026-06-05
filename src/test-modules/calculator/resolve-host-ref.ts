import { escapeJsString } from '../../common/codegen';
import type { StepData } from '../../scenario/loader';
import { getStepInstanceKey } from '../../scenario/instances';

interface ContextWithHostRef {
  currentHostRef?: string;
  stepInstanceHostRefs?: Map<string, string>;
}
export function resolveCalcBaseExpr(step: StepData, ctx?: ContextWithHostRef): string {
  const instanceKey: string = getStepInstanceKey(step);
  if (step.hostRef) {
    if (ctx) {
      (ctx as { currentHostRef?: string }).currentHostRef = step.hostRef;
      ctx.stepInstanceHostRefs ??= new Map<string, string>();
      ctx.stepInstanceHostRefs.set(instanceKey, step.hostRef);
    }
    return `\${HOSTS['${escapeJsString(step.hostRef)}']}`;
  }

  const inherited: string | undefined = ctx?.stepInstanceHostRefs?.get(instanceKey) ?? ctx?.currentHostRef;
  if (!inherited) {
    const msg: string =
      `No hostRef for step "${step.stepName || step.stepType}". ` + 'The first calculator step must have a hostRef.';
    if (ctx) {
      throw new Error(msg);
    }
    return "'unknown'";
  }
  return `\${HOSTS['${escapeJsString(inherited)}']}`;
}
