export type AuthField = "name" | "email" | "password" | "passwordConfirmation";

export type FieldErrors<TField extends string = AuthField> = Partial<Record<TField, string>>;

type ValidationResult<TData, TField extends string = AuthField> = {
  data?: TData;
  fieldErrors: FieldErrors<TField>;
};

type SignUpInput = {
  name: unknown;
  email: unknown;
  password: unknown;
  passwordConfirmation: unknown;
};

type LoginInput = {
  email: unknown;
  password: unknown;
};

export function normalizeName(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function readPassword(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateName(name: string): FieldErrors<"name"> {
  return name ? {} : { name: "Informe seu nome." };
}

function validateEmail(email: string): FieldErrors<"email"> {
  if (!email) {
    return { email: "Informe seu e-mail." };
  }

  return isValidEmail(email) ? {} : { email: "Informe um e-mail válido." };
}

function validatePassword(password: string): FieldErrors<"password"> {
  if (!password) {
    return { password: "Informe sua senha." };
  }

  return password.length >= 8 ? {} : { password: "A senha deve ter pelo menos 8 caracteres." };
}

export function validateSignUp(input: SignUpInput): ValidationResult<{
  name: string;
  email: string;
  password: string;
}> {
  const name = normalizeName(input.name);
  const email = normalizeEmail(input.email);
  const password = readPassword(input.password);
  const passwordConfirmation = readPassword(input.passwordConfirmation);
  const fieldErrors: FieldErrors = {
    ...validateName(name),
    ...validateEmail(email),
    ...validatePassword(password),
  };

  if (password !== passwordConfirmation) {
    fieldErrors.passwordConfirmation = "As senhas precisam ser iguais.";
  }

  return Object.keys(fieldErrors).length > 0
    ? { fieldErrors }
    : { data: { name, email, password }, fieldErrors };
}

export function validateLogin(input: LoginInput): ValidationResult<
  {
    email: string;
    password: string;
  },
  "email" | "password"
> {
  const email = normalizeEmail(input.email);
  const password = readPassword(input.password);
  const fieldErrors = {
    ...validateEmail(email),
    ...validatePassword(password),
  };

  return Object.keys(fieldErrors).length > 0
    ? { fieldErrors }
    : { data: { email, password }, fieldErrors };
}

export function validateProfileName(
  nameValue: unknown,
): ValidationResult<{ name: string }, "name"> {
  const name = normalizeName(nameValue);
  const fieldErrors = validateName(name);

  return Object.keys(fieldErrors).length > 0 ? { fieldErrors } : { data: { name }, fieldErrors };
}
