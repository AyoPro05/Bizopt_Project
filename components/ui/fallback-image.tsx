"use client";

import { useState } from "react";
import { cn } from "@/lib/helpers";

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrc?: string;
};

export function FallbackImage({
  src,
  alt,
  fallbackSrc = "/images/image-placeholder.svg",
  className,
  ...props
}: Props) {
  const [currentSrc, setCurrentSrc] = useState<string>(String(src ?? fallbackSrc));

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentSrc}
      alt={alt}
      className={cn(className)}
      onError={() => {
        if (currentSrc !== fallbackSrc) setCurrentSrc(fallbackSrc);
      }}
      {...props}
    />
  );
}
