const MS_PER_DAY = 86_400_000;

export interface DelayInput {
  /** Total amount paid to the builder so far, in rupees. */
  amountPaid: number;
  /** Possession date promised in the builder-buyer agreement. */
  promisedDate: Date;
  /** Grace period in the agreement, in months (often 6). */
  graceMonths: number;
  /** Annual interest rate in percent. Under most state RERA rules: SBI highest MCLR + 2%. */
  annualRatePercent: number;
  /** Date to calculate up to — today, or the actual possession date. */
  asOf: Date;
}

export interface DelayResult {
  delayStartsOn: Date;
  delayDays: number;
  /** Simple interest owed for the whole delay so far, in rupees. */
  interestOwed: number;
  /** Interest that accrues for every further month of delay, in rupees. */
  interestPerMonth: number;
}

function startOfDayUtc(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Adds calendar months, clamping to the last day of the month (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(date.getDate(), lastDay));
  return result;
}

/**
 * Estimates interest for delayed possession under Section 18 of the RERA Act, 2016:
 * simple interest on the amount paid, for each day past the promised date (plus grace).
 * An estimate for awareness only — the exact rate and method depend on state rules and the authority's order.
 */
export function calculateDelayInterest(input: DelayInput): DelayResult {
  const delayStartsOn = addMonths(input.promisedDate, Math.max(0, Math.floor(input.graceMonths)));
  const delayDays = Math.max(0, Math.round((startOfDayUtc(input.asOf) - startOfDayUtc(delayStartsOn)) / MS_PER_DAY));
  const amount = Math.max(0, input.amountPaid);
  const rate = Math.max(0, input.annualRatePercent) / 100;

  return {
    delayStartsOn,
    delayDays,
    interestOwed: Math.round((amount * rate * delayDays) / 365),
    interestPerMonth: Math.round((amount * rate) / 12),
  };
}
