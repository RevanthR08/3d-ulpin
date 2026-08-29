import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { portalLoginHref } from "@/lib/portal";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Log in — VERTICA 3D cadastre portal" }],
  }),
  component: LoginRedirect,
});

/**
 * Authentication lives in the separate VERTICA portal app. This route only
 * exists so a stray /login on the marketing origin still forwards there.
 */
function LoginRedirect() {
  useEffect(() => {
    window.location.replace(portalLoginHref());
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-5">
      <p className="label-xs text-mute">
        Redirecting to the VERTICA portal…{" "}
        <a href={portalLoginHref()} className="text-signal-deep underline">
          continue
        </a>
      </p>
    </main>
  );
}
