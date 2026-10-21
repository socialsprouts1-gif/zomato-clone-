"use client";

import Image from "next/image";
import { useState } from "react";
import { dishEmoji, gradientFor } from "@/lib/catalog/emoji";
import { cn } from "@/lib/utils";

/** Food photo with a tasteful gradient + emoji fallback, so nothing ever shows a broken image. */
export function FoodImage({
  src,
  alt,
  name,
  sizes,
  priority,
  className,
  emojiClassName,
}: {
  src: string | null | undefined;
  alt: string;
  name: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  emojiClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  return (
    <div className={cn("relative overflow-hidden bg-gradient-to-br", gradientFor(name), className)}>
      {!showImage ? (
        <span aria-hidden className={cn("absolute inset-0 flex items-center justify-center text-4xl", emojiClassName)}>
          {dishEmoji(name)}
        </span>
      ) : null}
      {showImage ? (
        <Image
          src={src!}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          // Uploads served from a local (http) storage gateway can't go through the image optimizer.
          unoptimized={src!.startsWith("http://")}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : null}
    </div>
  );
}
