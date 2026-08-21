import { rainbow } from "../../presentation/colorStrategy";

describe("rainbow", () => {
  it("is red at phase 0", () => {
    expect(rainbow(0).toLowerCase()).toBe("#ff0000");
  });

  it("is green at phase 1/3 (120°)", () => {
    expect(rainbow(1 / 3).toLowerCase()).toBe("#00ff00");
  });

  it("is blue at phase 2/3 (240°)", () => {
    expect(rainbow(2 / 3).toLowerCase()).toBe("#0000ff");
  });

  it("loops every 1", () => {
    expect(rainbow(1)).toBe(rainbow(0));
    expect(rainbow(1.5)).toBe(rainbow(0.5));
  });
});
