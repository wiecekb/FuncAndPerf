import { expect as pwExpect, test } from '@playwright/test';
import { attachment } from 'allure-js-commons';

class LoggingExpect {
  private readonly actual: unknown;
  private readonly stepDescription?: string;
  private readonly isNegated: boolean = false;

  constructor(actual: unknown, stepDescription?: string, isNegated: boolean = false) {
    this.actual = actual;
    this.stepDescription = stepDescription;
    this.isNegated = isNegated;
  }

  get not(): LoggingExpect {
    return new LoggingExpect(this.actual, this.stepDescription, true);
  }

  async toBe(expected: unknown): Promise<void> {
    const verb: string = this.isNegated ? 'not to be' : 'to be';
    const stepName: string = this.stepDescription
      ? `${this.stepDescription} - expected: ${this.formatExpectedShort(expected)}`
      : `Expect "${verb}" - actual: ${this.formatActualShort()}, expected: ${this.formatExpectedShort(expected)}`;

    await test.step(stepName, async (): Promise<void> => {
      await this.logAssertion('toBe', { expected, negated: this.isNegated });
      if (this.isNegated) {
        pwExpect(this.actual).not.toBe(expected);
      } else {
        pwExpect(this.actual).toBe(expected);
      }
    });
  }

  async toEqual(expected: unknown): Promise<void> {
    const verb: string = this.isNegated ? 'not to equal' : 'to equal';
    const stepName: string = this.stepDescription
      ? `${this.stepDescription} - expected: ${this.formatExpectedShort(expected)}`
      : `Expect "${verb}" - actual: ${this.formatActualShort()}, expected: ${this.formatExpectedShort(expected)}`;

    await test.step(stepName, async (): Promise<void> => {
      await this.logAssertion('toEqual', { expected, negated: this.isNegated });
      if (this.isNegated) {
        pwExpect(this.actual).not.toEqual(expected);
      } else {
        pwExpect(this.actual).toEqual(expected);
      }
    });
  }

  async toContain(expected: unknown): Promise<void> {
    const verb: string = this.isNegated ? 'not to contain' : 'to contain';
    const stepName = this.stepDescription
      ? `${this.stepDescription} - expected: ${this.formatExpectedShort(expected)}`
      : `Expect "${verb}" - actual: ${this.formatActualShort()}, expected: ${this.formatExpectedShort(expected)}`;

    await test.step(stepName, async (): Promise<void> => {
      await this.logAssertion('toContain', { expected, negated: this.isNegated });
      if (this.isNegated) {
        pwExpect(this.actual).not.toContain(expected);
      } else {
        pwExpect(this.actual).toContain(expected);
      }
    });
  }

  private formatActualShort(): string {
    if (this.actual === null) return 'null';
    if (this.actual === undefined) return 'undefined';
    if (typeof this.actual === 'object') {
      try {
        const str: string = JSON.stringify(this.actual);
        return str.length > 50 ? str.substring(0, 50) + '...' : str;
      } catch {
        return '[Object]';
      }
    }
    return String(this.actual);
  }

  private formatExpectedShort(expected: unknown): string {
    if (expected === null) return 'null';
    if (expected === undefined) return 'undefined';
    if (typeof expected === 'object') {
      try {
        const str: string = JSON.stringify(expected);
        return str.length > 50 ? str.substring(0, 50) + '...' : str;
      } catch {
        return '[Object]';
      }
    }
    return String(expected);
  }

  private async logAssertion(assertionType: string, details: { expected?: unknown; negated?: boolean }): Promise<void> {
    try {
      const { expected } = details;
      const formattedActual = this.formatValue(this.actual);
      const formattedExpected = expected !== undefined ? this.formatValue(expected) : undefined;

      const logData = {
        assertion: assertionType,
        timestamp: new Date().toISOString(),
        actual: formattedActual,
        ...(expected !== undefined && { expected: formattedExpected }),
        negated: details.negated ?? false,
        message: this.generateMessage(assertionType, formattedActual, formattedExpected, details.negated),
      };

      await attachment(`Assertion Details: ${assertionType}`, JSON.stringify(logData, null, 2), 'application/json');
    } catch (error) {
      throw new Error(`Failed to log assertion to Allure: ${error instanceof Error ? error.message : String(error)}`, {
        cause: error,
      });
    }
  }

  private formatValue(value: unknown): unknown {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Buffer.isBuffer(value)) return `[Buffer: ${value.length} bytes]`;
    if (typeof value === 'object') {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch {
        return '[Object - circular]';
      }
    }
    return value;
  }

  private generateMessage(assertionType: string, actual: unknown, expected: unknown, negated: boolean = false): string {
    const verb: string = negated ? 'not to' : 'to';
    switch (assertionType) {
      case 'toBe':
        return `Expected ${actual} ${verb} be ${expected}`;
      case 'toEqual':
        return `Expected ${actual} ${verb} equal ${expected}`;
      case 'toContain':
        return `Expected ${actual} ${verb} contain ${expected}`;
      default:
        return `Assertion ${assertionType} failed`;
    }
  }
}

export function expectWithDescription(description: string, actual: unknown): LoggingExpect {
  return new LoggingExpect(actual, description);
}
