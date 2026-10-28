import type { ReactNode } from "react";
import { AuthImage, authImageFiles } from "@/components/shared/admin/auth-images";
import { renderAuthLink } from "@/components/shared/admin/render-auth-link";

export function AuthLogo() {
  return <img src="/aura-creative-logo.png" alt="Aura Creative" className="mx-auto h-auto w-40" />;
}

export function AuthAside({ image = AuthImage.Brand }: { image?: AuthImage }) {
  const { src, position } = authImageFiles[image];
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className={`absolute inset-0 size-full object-cover ${position}`}
    />
  );
}

export function AuthTextLink({ href, children }: { href: string; children: ReactNode }) {
  return renderAuthLink({
    item: { title: href, to: href },
    href,
    className: "text-foreground underline underline-offset-4",
    children,
  });
}
