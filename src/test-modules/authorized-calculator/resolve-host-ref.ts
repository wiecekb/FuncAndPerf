import { config } from '../../config';
import { resolveHostRef as resolveCommonHostRef } from '../../scenario/loader';
import { escapeJsString } from '../../common/codegen';
import { getStepInstanceKey } from '../../scenario/instances';

/** Subset of a generation context exposing host-reference tracking. */
interface ContextWithHostRef {
  currentHostRef?: string;
  stepInstanceHostRefs?: Map<string, string>;
}

/**
 * Returns the base-URL expression for an authorized-calculator step, resolving
 * the host alias either from the step itself or from inherited state.
 *
 * When a generation context is provided, the returned expression is a k6-style
 * template literal (`${HOSTS['<alias>']}`) and the alias is recorded on the
 * context for inheritance by subsequent steps. Without a context the alias is
 * resolved immediately via {@link resolveHostRef} and wrapped in a backtick
 * literal.
 *
 * @param step - Step providing `hostRef`, type, instance and name.
 * @param ctx - Optional generation context to read from / write to.
 * @returns Generated base-URL expression.
 * @throws {Error} When no `hostRef` can be resolved from the step or inherited state.
 */
export function resolveAuthorizedCalcBaseExpr(
  step: { hostRef?: string; stepType?: string; stepInstanceName?: string; stepName?: string },
  ctx?: ContextWithHostRef
): string {
  const instanceKey: string = getStepInstanceKey({
    stepType: step.stepType || 'AUTHORIZED_CALCULATOR',
    stepInstanceName: step.stepInstanceName,
  });
  if (step.hostRef) {
    if (ctx) {
      ctx.currentHostRef = step.hostRef;
      ctx.stepInstanceHostRefs ??= new Map<string, string>();
      ctx.stepInstanceHostRefs.set(instanceKey, step.hostRef);
      return `\${HOSTS['${escapeJsString(step.hostRef)}']}`;
    }
    return '`' + resolveCommonHostRef(step.hostRef, config) + '`';
  }

  const inherited: string | undefined = ctx?.stepInstanceHostRefs?.get(instanceKey) ?? ctx?.currentHostRef;
  if (inherited) {
    return ctx ? `\${HOSTS['${escapeJsString(inherited)}']}` : '`' + resolveCommonHostRef(inherited, config) + '`';
  }

  throw new Error(
    `No hostRef defined for step "${step.stepName || step.stepType || 'AUTHORIZED_CALCULATOR'}". ` +
      'The first authorized calculator step must have a hostRef set in config.yaml hosts.'
  );
}
