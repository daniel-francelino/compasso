import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void },
  ) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function TurnstileBox({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let widget: string | null = null;
    const mount = () => {
      const api = window.turnstile;
      if (api === undefined || box.current === null || widget !== null) return;
      widget = api.render(box.current, {
        sitekey: siteKey,
        callback: onToken,
        "expired-callback": () => onToken(""),
      });
    };
    if (window.turnstile === undefined) {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.addEventListener("load", mount);
      document.head.appendChild(script);
    } else {
      mount();
    }
    return () => {
      if (widget !== null) window.turnstile?.remove(widget);
    };
  }, [siteKey, onToken]);

  return <div ref={box} />;
}
