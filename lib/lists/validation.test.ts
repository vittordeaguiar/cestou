import { describe, expect, it } from "vitest";

import { parseQuantity, validateListItemInput } from "@/lib/lists/validation";

describe("parseQuantity", () => {
  it("parses comma and dot decimals", () => {
    expect(parseQuantity("1,5")).toBe(1.5);
    expect(parseQuantity("2.25")).toBe(2.25);
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity("abc")).toBeNull();
  });
});

describe("validateListItemInput", () => {
  it("accepts a valid item and normalizes fields", () => {
    expect(
      validateListItemInput({
        name: "  Arroz  5kg ",
        quantity: "2,5",
        unit: "  kg ",
        category: "mercado",
      }),
    ).toEqual({
      data: { name: "Arroz 5kg", quantity: 2.5, unit: "kg", category: "mercado" },
      fieldErrors: {},
    });
  });

  it("requires a name and positive quantity", () => {
    expect(validateListItemInput({ name: " ", quantity: "0", unit: "" })).toEqual({
      fieldErrors: {
        name: "Informe o nome do item.",
        quantity: "A quantidade deve ser maior que zero.",
      },
    });
  });

  it("treats blank unit as null and rejects oversized unit", () => {
    expect(validateListItemInput({ name: "Leite", quantity: "1", unit: "   " })).toEqual({
      data: { name: "Leite", quantity: 1, unit: null, category: null },
      fieldErrors: {},
    });

    expect(
      validateListItemInput({ name: "Leite", quantity: "1", unit: "u".repeat(21) }).fieldErrors
        .unit,
    ).toMatch(/no máximo 20/);
  });

  it("accepts blank category as null and rejects unknown values", () => {
    expect(
      validateListItemInput({ name: "Dipirona", quantity: "1", unit: "", category: "" }),
    ).toEqual({
      data: { name: "Dipirona", quantity: 1, unit: null, category: null },
      fieldErrors: {},
    });

    expect(
      validateListItemInput({
        name: "Dipirona",
        quantity: "1",
        unit: "",
        category: "padaria",
      }).fieldErrors.category,
    ).toBe("Selecione uma categoria válida.");
  });
});
