import { normalizeName, type FieldErrors } from "@/lib/auth/validation";

export type GroupField = "name";

export type GroupFieldErrors = FieldErrors<GroupField>;

type ValidationResult<TData> = {
  data?: TData;
  fieldErrors: GroupFieldErrors;
};

const GROUP_NAME_MAX_LENGTH = 80;

export function validateGroupName(nameValue: unknown): ValidationResult<{ name: string }> {
  const name = normalizeName(nameValue);
  const fieldErrors: GroupFieldErrors = {};

  if (!name) {
    fieldErrors.name = "Informe o nome do grupo.";
  } else if (name.length > GROUP_NAME_MAX_LENGTH) {
    fieldErrors.name = `O nome deve ter no máximo ${GROUP_NAME_MAX_LENGTH} caracteres.`;
  }

  return Object.keys(fieldErrors).length > 0 ? { fieldErrors } : { data: { name }, fieldErrors };
}

export { GROUP_NAME_MAX_LENGTH };
