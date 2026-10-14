import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

/** Registra o service worker (necessário para o site ser instalável). */
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (location.hostname === "localhost") return;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** "Instalar o app": no Android/Chrome abre o pedido de instalação; no iPhone explica como adicionar à tela de início. */
export function InstallAppButton({ className = "" }: { className?: string }) {
  const [, force] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  useEffect(() => {
    setMounted(true);
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  if (!mounted || isStandalone()) return null;
  const ios = isIos();
  if (!deferred && !ios) return null;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={async () => {
          if (deferred) {
            await deferred.prompt();
            await deferred.userChoice.catch(() => null);
            deferred = null;
            force((n) => n + 1);
          } else {
            setIosHelp((v) => !v);
          }
        }}
        className="flex w-full items-center gap-2 py-3 text-sm text-white/80 transition-colors hover:text-gilt"
      >
        <Smartphone className="size-4" strokeWidth={1.5} />
        Instalar o app no celular
      </button>
      {iosHelp && (
        <p className="pb-3 text-xs leading-relaxed text-white/60">
          No Safari, toque em Compartilhar (o quadrado com a seta para cima) e depois em "Adicionar à Tela de Início".
        </p>
      )}
    </div>
  );
}
