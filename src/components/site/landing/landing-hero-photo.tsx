import { useEffect, useRef, useState } from "react";
import { heroPhoto } from "@/components/site/landing/landing-content";

export function LandingHeroPhoto() {
  const [missing, setMissing] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth === 0) setMissing(true);
  }, []);
  if (missing) return null;
  return (
    <div className="relative mx-auto w-full max-w-md lg:ml-auto lg:mr-0 lg:max-w-lg">
      <img
        ref={imageRef}
        src={heroPhoto.src}
        alt={heroPhoto.alt}
        width={760}
        height={773}
        fetchPriority="high"
        decoding="async"
        onError={() => setMissing(true)}
        className="block h-auto w-full"
      />
    </div>
  );
}
