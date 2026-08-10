import { normalizeName, type FieldErrors } from "@/lib/auth/validation";
import { isItemCategory } from "@/lib/lists/category";
import type { ItemCategory } from "@/types";

export type ListItemField = "name" | "quantity" | "unit" | "category";

export type ListItemFieldErrors = FieldErrors<ListItemField>;

export type ListItemInput = {
  name: string;
  quantity: number;
  unit: string | null;
  category: ItemCategory | null;
};

type ValidationResult = {
  data?: ListItemInput;
  fieldErrors: ListItemFieldErrors;
};

export const LIST_ITEM_NAME_MAX_LENGTH = 80;
export const LIST_ITEM_UNIT_MAX_LENGTH = 20;

export function parseQuantity(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeUnit(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized : null;
}

/** Empty / missing category is valid (null). Unknown values are invalid. */
export function parseCategory(
  value: unknown,
): { ok: true; category: ItemCategory | null } | { ok: false } {
  if (value === null || value === undefined) {
    return { ok: true, category: null };
  }

  if (typeof value !== "string") {
    return { ok: false };
  }

  const normalized = value.trim();
  if (!normalized) {
    return { ok: true, category: null };
  }

  if (!isItemCategory(normalized)) {
    return { ok: false };
  }

  return { ok: true, category: normalized };
}

export function validateListItemInput(input: {
  name: unknown;
  quantity: unknown;
  unit: unknown;
  category?: unknown;
}): ValidationResult {
  const name = normalizeName(input.name);
  const quantity = parseQuantity(input.quantity);
  const unit = normalizeUnit(input.unit);
  const categoryResult = parseCategory(input.category);
  const fieldErrors: ListItemFieldErrors = {};

  if (!name) {
    fieldErrors.name = "Informe o nome do item.";
  } else if (name.length > LIST_ITEM_NAME_MAX_LENGTH) {
    fieldErrors.name = `O nome deve ter no máximo ${LIST_ITEM_NAME_MAX_LENGTH} caracteres.`;
  }

  if (quantity === null) {
    fieldErrors.quantity = "Informe uma quantidade válida.";
  } else if (quantity <= 0) {
    fieldErrors.quantity = "A quantidade deve ser maior que zero.";
  }

  if (unit && unit.length > LIST_ITEM_UNIT_MAX_LENGTH) {
    fieldErrors.unit = `A unidade deve ter no máximo ${LIST_ITEM_UNIT_MAX_LENGTH} caracteres.`;
  }

  if (!categoryResult.ok) {
    fieldErrors.category = "Selecione uma categoria válida.";
  }

  return Object.keys(fieldErrors).length > 0
    ? { fieldErrors }
    : {
        data: {
          name,
          quantity: quantity as number,
          unit,
          category: categoryResult.ok ? categoryResult.category : null,
        },
        fieldErrors,
      };
}
