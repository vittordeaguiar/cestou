import { toast as sonnerToast } from "sonner";

type ToastMessage = {
  title: string;
  description?: string;
};

function successToast({ title, description }: ToastMessage) {
  return sonnerToast.success(title, { description });
}

function errorToast({ title, description }: ToastMessage) {
  return sonnerToast.error(title, { description });
}

function warningToast({ title, description }: ToastMessage) {
  return sonnerToast.warning(title, { description });
}

function infoToast({ title, description }: ToastMessage) {
  return sonnerToast.info(title, { description });
}

export const toast = {
  success: successToast,
  error: errorToast,
  warning: warningToast,
  info: infoToast,
  raw: sonnerToast,
};
