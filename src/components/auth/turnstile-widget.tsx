"use client";

import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
} from "react";
import { env } from "@/env";

export interface TurnstileWidgetHandle {
  reset: () => void;
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: (err?: string) => void;
  onExpire?: () => void;
  siteKey?: string;
  theme?: "light" | "dark" | "auto";
  className?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: (error?: string) => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export const TurnstileWidget = forwardRef<
  TurnstileWidgetHandle,
  TurnstileWidgetProps
>(
  (
    {
      onVerify,
      onError,
      onExpire,
      siteKey =
        env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA",
      theme = "auto",
      className,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const onVerifyRef = useRef(onVerify);
    const onErrorRef = useRef(onError);
    const onExpireRef = useRef(onExpire);
    onVerifyRef.current = onVerify;
    onErrorRef.current = onError;
    onExpireRef.current = onExpire;

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
    }));

    useEffect(() => {
      let mounted = true;
      let checkInterval: ReturnType<typeof setInterval> | undefined;

      const renderTurnstile = () => {
        if (!containerRef.current || !window.turnstile || widgetIdRef.current)
          return;
        try {
          const id = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme,
            callback: (token: string) => {
              if (mounted) {
                setIsLoading(false);
                onVerifyRef.current(token);
              }
            },
            "error-callback": (err?: string) => {
              if (mounted) {
                setIsLoading(false);
                onErrorRef.current?.(err);
              }
            },
            "expired-callback": () => {
              if (mounted) onExpireRef.current?.();
            },
          });
          widgetIdRef.current = id;
          setIsLoading(false);
        } catch (e: unknown) {
          if (mounted) {
            setIsLoading(false);
            onErrorRef.current?.(
              e instanceof Error ? e.message : "Turnstile error",
            );
          }
        }
      };

      if (typeof window !== "undefined") {
        if (window.turnstile) {
          renderTurnstile();
        } else {
          const scriptId = "cf-turnstile-script";
          let script = document.getElementById(
            scriptId,
          ) as HTMLScriptElement | null;
          if (!script) {
            script = document.createElement("script");
            script.id = scriptId;
            script.src =
              "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
          }
          checkInterval = setInterval(() => {
            if (window.turnstile) {
              if (checkInterval) clearInterval(checkInterval);
              renderTurnstile();
            }
          }, 100);
        }
      }

      return () => {
        mounted = false;
        if (checkInterval) clearInterval(checkInterval);
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    }, [siteKey, theme]);

    return (
      <div
        className={`my-2 flex min-h-[65px] flex-col items-center justify-center ${className ?? ""}`}
      >
        {isLoading ? (
          <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground animate-pulse">
            Loading Cloudflare verification...
          </div>
        ) : null}
        <div ref={containerRef} />
      </div>
    );
  },
);

TurnstileWidget.displayName = "TurnstileWidget";
