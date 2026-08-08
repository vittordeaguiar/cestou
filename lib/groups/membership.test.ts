import { describe, expect, it } from "vitest";

import {
  buildCreateGroupPath,
  buildGroupListPath,
  isAlreadyInGroupError,
} from "@/lib/groups/membership";

describe("group path helpers", () => {
  it("builds the create and list routes", () => {
    expect(buildCreateGroupPath()).toBe("/app/groups/new");
    expect(buildGroupListPath("abc-123")).toBe("/app/groups/abc-123/list");
  });
});

describe("isAlreadyInGroupError", () => {
  it("detects the v1 one-group constraint", () => {
    expect(
      isAlreadyInGroupError({ code: "P0001", message: "User already belongs to a group" }),
    ).toBe(true);
    expect(isAlreadyInGroupError({ message: "User already belongs to a group" })).toBe(true);
    expect(isAlreadyInGroupError({ code: "42501", message: "Authentication required" })).toBe(
      false,
    );
    expect(isAlreadyInGroupError(null)).toBe(false);
  });
});
