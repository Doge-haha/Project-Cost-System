import { Decimal } from "decimal.js";

export function sumDecimal(values: Array<number | null | undefined>, scale = 2): number {
  return values
    .reduce((accumulator, value) => accumulator.plus(value ?? 0), new Decimal(0))
    .toDecimalPlaces(scale, Decimal.ROUND_HALF_UP)
    .toNumber();
}

export function multiplyDecimal(
  left: number | null | undefined,
  right: number | null | undefined,
  scale = 2,
): number {
  return new Decimal(left ?? 0)
    .mul(right ?? 0)
    .toDecimalPlaces(scale, Decimal.ROUND_HALF_UP)
    .toNumber();
}

export function divideDecimal(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  scale = 6,
): number {
  if (!denominator) {
    return 0;
  }

  return new Decimal(numerator ?? 0)
    .div(denominator)
    .toDecimalPlaces(scale, Decimal.ROUND_HALF_UP)
    .toNumber();
}

export function subtractDecimal(
  left: number | null | undefined,
  right: number | null | undefined,
  scale = 2,
): number {
  return new Decimal(left ?? 0)
    .minus(right ?? 0)
    .toDecimalPlaces(scale, Decimal.ROUND_HALF_UP)
    .toNumber();
}

export function roundDecimal(value: number | null | undefined, scale = 2): number {
  return new Decimal(value ?? 0)
    .toDecimalPlaces(scale, Decimal.ROUND_HALF_UP)
    .toNumber();
}

export function absoluteDecimal(value: number | null | undefined, scale = 2): number {
  return new Decimal(value ?? 0)
    .abs()
    .toDecimalPlaces(scale, Decimal.ROUND_HALF_UP)
    .toNumber();
}
