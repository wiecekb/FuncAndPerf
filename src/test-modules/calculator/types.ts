/** JSON shape returned by the (unauthenticated) calculator endpoints. */
export interface CalcResponseJson {
  /** Result of the arithmetic operation. */
  result: number;
  /** Operation that produced the result. */
  operation: 'add' | 'multiply';
}
