import * as React from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldInputProps = Omit<React.ComponentProps<"input">, "id"> & {
  id: string;
  label: string;
  description?: string;
  error?: string;
};

function FieldInput({
  id,
  label,
  description,
  error,
  className,
  disabled,
  "aria-describedby": ariaDescribedBy,
  ...props
}: FieldInputProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [ariaDescribedBy, descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div
      data-slot="field-input"
      data-disabled={disabled ? "true" : undefined}
      className="group/field flex w-full flex-col gap-2"
    >
      <Label htmlFor={id} className={cn(disabled && "opacity-60")}>
        {label}
      </Label>
      <Input
        id={id}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={className}
        {...props}
      />
      {description ? (
        <p id={descriptionId} className="text-caption text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-caption text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { FieldInput };
export type { FieldInputProps };
