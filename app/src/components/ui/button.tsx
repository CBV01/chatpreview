import React from "react";

type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "size"> & {
  className?: string;
  size?: ButtonSize;
};

export const Button: React.FC<ButtonProps> = ({ className = "", size = "md", children, ...props }) => {
  const sizeClasses: Record<ButtonSize, string> = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  const baseClasses =
    "inline-flex items-center justify-center rounded-md bg-black text-white font-medium hover:bg-black/90 transition-colors disabled:opacity-50 disabled:pointer-events-none";

  return (
    <button className={`${baseClasses} ${sizeClasses[size]} ${className}`} {...props}>
      {children}
    </button>
  );
};