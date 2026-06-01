import {config} from '../../config';
import {resolveHostRef as resolveCommonHostRef} from '../../scenario/loader';

export function resolveAuthorizedCalcBaseExpr(step: { hostRef?: string }, _ctx?: unknown): string {
    if (!step.hostRef) return '`http://localhost:3000`';
    return '`' + resolveCommonHostRef(step.hostRef, config) + '`';
}

