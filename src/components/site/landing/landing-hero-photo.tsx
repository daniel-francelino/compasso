import { type ReactNode, useEffect, useRef, useState } from "react";
import { heroPhoto } from "@/components/site/landing/landing-content";

export function LandingHeroPhoto({ children }: { children: ReactNode }) {
  const [missing, setMissing] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth === 0) setMissing(true);
  }, []);
  if (missing) return <div className="flex justify-center">{children}</div>;
  return (
    <div className="relative mx-auto w-fit">
      <img
        ref={imageRef}
        src={heroPhoto.src}
        alt={heroPhoto.alt}
        width={640}
        height={800}
        fetchPriority="high"
        decoding="async"
        onError={() => setMissing(true)}
        className="max-h-[34rem] w-auto rounded-[2.5rem] border-8 border-surface object-cover shadow-sm"
      />
      <div className="mt-4 w-72 max-w-full lg:absolute lg:-bottom-6 lg:-left-16 lg:mt-0">
        {children}
      </div>
    </div>
  );
}
