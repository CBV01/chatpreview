import React from "react";

type AvatarProps = React.HTMLAttributes<HTMLDivElement> & {
  className?: string;
};

type AvatarImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  className?: string;
};

export const Avatar: React.FC<AvatarProps> = ({ className = "", children, ...props }) => {
  return (
    <div
      className={`relative inline-block h-8 w-8 rounded-full overflow-hidden bg-gray-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const AvatarImage: React.FC<AvatarImageProps> = ({ className = "", ...props }) => {
  return (
    <img
      className={`h-full w-full object-cover ${className}`}
      {...props}
    />
  );
};