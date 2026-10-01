import { describe, expect, it } from "@jest/globals";
import { addMonths, calculateDelayInterest } from "@/lib/delay";

describe("calculateDelayInterest", () => {
  it("charges nothing before the promised date", () => {
    const result = calculateDelayInterest({
      amountPaid: 5_000_000,
      promisedDate: new Date(2027, 0, 1),
      graceMonths: 0,
      annualRatePercent: 11,
      asOf: new Date(2026, 9, 1),
    });
    expect(result.delayDays).toBe(0);
    expect(result.interestOwed).toBe(0);
  });

  it("computes simple interest for a one-year delay", () => {
    const result = calculateDelayInterest({
      amountPaid: 5_000_000,
      promisedDate: new Date(2025, 0, 1),
      graceMonths: 0,
      annualRatePercent: 11,
      asOf: new Date(2026, 0, 1),
    });
    expect(result.delayDays).toBe(365);
    expect(result.interestOwed).toBe(550_000);
    expect(result.interestPerMonth).toBe(45_833);
  });

  it("starts the delay only after the grace period", () => {
    const result = calculateDelayInterest({
      amountPaid: 1_000_000,
      promisedDate: new Date(2025, 0, 31),
      graceMonths: 6,
      annualRatePercent: 10,
      asOf: new Date(2025, 7, 30),
    });
    expect(result.delayStartsOn).toEqual(new Date(2025, 6, 31));
    expect(result.delayDays).toBe(30);
  });

  it("ignores negative inputs", () => {
    const result = calculateDelayInterest({
      amountPaid: -10,
      promisedDate: new Date(2025, 0, 1),
      graceMonths: -3,
      annualRatePercent: -5,
      asOf: new Date(2026, 0, 1),
    });
    expect(result.interestOwed).toBe(0);
  });
});

describe("addMonths", () => {
  it("clamps to the end of shorter months", () => {
    expect(addMonths(new Date(2025, 0, 31), 1)).toEqual(new Date(2025, 1, 28));
  });
});
