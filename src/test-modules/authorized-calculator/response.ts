/** JSON shape returned by the authorized calculator endpoints. */
export type AuthorizedCalcResponseJson = {
  /** Result of the arithmetic operation. */
  result: number;
  /** Operation that produced the result. */
  operation: 'add' | 'multiply';
};

/**
 * Domain wrapper around an {@link AuthorizedCalcResponseJson}, with factory and
 * serialisation helpers used by the validation layer.
 */
export class AuthorizedCalcResponse {
  /**
   * @param result - Numeric result of the operation.
   * @param operation - Name of the operation that produced the result.
   */
  constructor(
    public readonly result: number,
    public readonly operation: string
  ) {}

  /**
   * Builds an {@link AuthorizedCalcResponse} from parsed JSON.
   *
   * @param json - Parsed response body.
   */
  static fromJson(json: AuthorizedCalcResponseJson): AuthorizedCalcResponse {
    return new AuthorizedCalcResponse(json.result, json.operation);
  }

  /**
   * Serialises the response back to its JSON shape.
   *
   * @returns A JSON-serialisable representation.
   */
  toJson(): AuthorizedCalcResponseJson {
    return { result: this.result, operation: this.operation as 'add' | 'multiply' };
  }
}
