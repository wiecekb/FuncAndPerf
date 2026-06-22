import { escapeJsString } from '../../common/codegen';
import type { StepData } from '../../scenario/loader';
import { getStepInstanceKey } from '../../scenario/instances';

interface ContextWithHostRef {
  currentHostRef?: string;
  stepInstanceHostRefs?: Map<string, string>;
}
/**
 * Returns the k6 base-URL expression for a calculator step, resolving the host
 * alias either from the step itself or from inherited state.
 *
 * When a generation context is provided, the returned expression is a k6-style
 * template literal (`${HOSTS['<alias>']}`) and the alias is recorded on the
 * context for inheritance by subsequent steps. Without a context, the literal
 * `'unknown'` is returned when no alias can be resolved.
 *
 * @param step - Step providing `hostRef`, type, instance and name.
 * @param ctx - Optional generation context to read from / write to.
 * @returns Generated base-URL expression.
 * @throws {Error} When a context is provided but no `hostRef` can be resolved.
 */
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
