import { type FieldErrors } from "@/lib/auth/validation";

export type AuthActionState = {
  status: "idle" | "error" | "success";
  fieldErrors: FieldErrors;
  message?: string;
  redirectTo?: string;
};

export const initialAuthActionState: AuthActionState = {
  status: "idle",
  fieldErrors: {},
};

export type ProfileActionState = {
  status: "idle" | "error" | "success";
  fieldErrors: FieldErrors<"name">;
  message?: string;
  name?: string;
};

export const initialProfileActionState: ProfileActionState = {
  status: "idle",
  fieldErrors: {},
};
