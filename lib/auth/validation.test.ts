import { describe, expect, it } from "vitest";

import {
  normalizeEmail,
  normalizeName,
  validateLogin,
  validateProfileName,
  validateSignUp,
} from "@/lib/auth/validation";

describe("authentication form validation", () => {
  it("normalizes a name and email before submission", () => {
    expect(normalizeName("  Ana   Maria  ")).toBe("Ana Maria");
    expect(normalizeEmail("  ANA@Example.COM ")).toBe("ana@example.com");
  });

  it("accepts a valid sign-up payload", () => {
    expect(
      validateSignUp({
        name: "Ana Maria",
        email: "ana@example.com",
        password: "segredo-123",
        passwordConfirmation: "segredo-123",
      }),
    ).toEqual({
      data: {
        name: "Ana Maria",
        email: "ana@example.com",
        password: "segredo-123",
      },
      fieldErrors: {},
    });
  });

  it.each([
    [
      "requires a name",
      {
        name: "  ",
        email: "ana@example.com",
        password: "segredo-123",
        passwordConfirmation: "segredo-123",
      },
      "name",
    ],
    [
      "rejects an invalid email",
      {
        name: "Ana",
        email: "not-an-email",
        password: "segredo-123",
        passwordConfirmation: "segredo-123",
      },
      "email",
    ],
    [
      "requires a password with eight characters",
      { name: "Ana", email: "ana@example.com", password: "short", passwordConfirmation: "short" },
      "password",
    ],
    [
      "requires matching passwords",
      {
        name: "Ana",
        email: "ana@example.com",
        password: "segredo-123",
        passwordConfirmation: "diferente-123",
      },
      "passwordConfirmation",
    ],
  ])("%s", (_description, input, field) => {
    expect(validateSignUp(input).fieldErrors).toHaveProperty(field);
  });

  it("validates login and profile name payloads", () => {
    expect(
      validateLogin({ email: "ana@example.com", password: "segredo-123" }).fieldErrors,
    ).toEqual({});
    expect(validateLogin({ email: "ana", password: "" }).fieldErrors).toMatchObject({
      email: expect.any(String),
      password: expect.any(String),
    });
    expect(validateProfileName("  ").fieldErrors).toHaveProperty("name");
  });
});
