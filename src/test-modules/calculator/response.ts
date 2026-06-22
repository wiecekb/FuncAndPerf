import type { CalcResponseJson } from './types';

/**
 * Immutable domain wrapper around a {@link CalcResponseJson}. Accepts either a
 * single response object or a one-element array (some calculator endpoints wrap
 * the result) via {@link CalcResponse.fromJson}.
 */
export class CalcResponse {
  private readonly _result: number;
  private readonly _operation: string;

  /**
   * @param result - Numeric result of the operation.
   * @param operation - Name of the operation that produced the result.
   */
  private constructor(result: number, operation: string) {
    this._result = result;
    this._operation = operation;
  }

  /** Numeric result of the operation. */
  get result(): number {
    return this._result;
  }

  /** Name of the operation that produced the result. */
  get operation(): string {
    return this._operation;
  }

  /**
   * Builds a {@link CalcResponse} from parsed JSON, normalising a single-element
   * array into a scalar object.
   *
   * @param json - Parsed response body (object or one-element array).
   */
  static fromJson(json: CalcResponseJson | CalcResponseJson[]): CalcResponse {
    const normalized: CalcResponseJson = Array.isArray(json) ? json[0] : json;
    return new CalcResponse(normalized.result, normalized.operation);
  }

  /**
   * Serialises the response back to its JSON shape.
   *
   * @returns A JSON-serialisable representation.
   */
  toJson(): CalcResponseJson {
    return {
      result: this._result,
      operation: this._operation as 'add' | 'multiply',
    };
  }
}
