"use client";

import { buttonBaseStyle, buttonVariantStyles, type ButtonVariant } from "@/lib/ui/buttonStyle";

export function Button({
  variant = "primary",
  disabled,
  fullWidth,
  style,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; fullWidth?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        ...buttonBaseStyle,
        ...buttonVariantStyles[variant],
        width: fullWidth ? "100%" : undefined,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "default" : "pointer",
        ...style,
      }}
    />
  );
}

/** Mesmo visual do Button, mas como <a> simples — para links externos/API (ex: download). */
export function LinkButton({
  variant = "primary",
  style,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant }) {
  return (
    <a
      {...props}
      style={{
        ...buttonBaseStyle,
        ...buttonVariantStyles[variant],
        textDecoration: "none",
        ...style,
      }}
    />
  );
}
