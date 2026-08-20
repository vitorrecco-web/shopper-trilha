"use client";

import { useEffect, useRef } from "react";

/**
 * Player de YouTube incorporado, responsivo (16:9), usando a YouTube
 * IFrame Player API — permite ler o progresso de reprodução (necessário
 * para liberar "Concluir módulo"/quiz só depois de assistir o
 * suficiente). Um `<iframe>` simples não daria esse controle.
 *
 * `onProgress` é chamado a cada ~3s enquanto o vídeo está tocando, com o
 * percentual (0-100) já assistido nesta reprodução. Quem chama decide o
 * que fazer com isso (ModuloClient.tsx reporta ao servidor).
 *
 * BUG CORRIGIDO (Safari/iOS): o player aparecia como um retângulo preto,
 * sem renderizar o vídeo. Duas causas provavelmente combinadas:
 * 1. Faltava `playsinline: 1` em `playerVars` — o Safari no iOS trata a
 *    ausência disso de forma mais estrita que o Chrome/Android.
 * 2. O dimensionamento do iframe (100% de largura/altura) era aplicado
 *    só via `iframe.style` dentro do `onReady`, ou seja, dependia de
 *    timing de JS. O WebKit do iOS pode montar o iframe com os
 *    atributos width/height="100%" originais (que sem um contexto de
 *    porcentagem bem definido colapsam para 0) e não repaginar
 *    corretamente quando o JS muda o style depois.
 * A correção usa uma classe estável (`.yt-player-frame`) com uma regra
 * CSS `!important` em globals.css, que se aplica no instante em que o
 * iframe é inserido no DOM — não depende de nenhum callback de JS rodar
 * primeiro. O ajuste via onReady é mantido como reforço, não como única
 * fonte de verdade.
 */

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement,
        opts: {
          videoId: string;
          width?: string | number;
          height?: string | number;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (e: { target: { getIframe: () => HTMLIFrameElement } }) => void;
            onStateChange?: (e: { data: number; target: YoutubePlayerInstance }) => void;
          };
        }
      ) => YoutubePlayerInstance;
      PlayerState: { PLAYING: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YoutubePlayerInstance {
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}

let apiLoadPromise: Promise<void> | null = null;

function loadYoutubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiLoadPromise;
}

export function YoutubePlayer({
  videoId,
  onProgress,
}: {
  videoId: string;
  onProgress: (percent: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YoutubePlayerInstance | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  useEffect(() => {
    let destroyed = false;

    loadYoutubeIframeApi().then(() => {
      if (destroyed || !containerRef.current || !window.YT) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        width: "100%",
        height: "100%",
        // playsinline:1 é o que evita o Safari/iOS tentar um modo de
        // apresentação diferente que resultava no retângulo preto.
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: (e) => {
            // Reforço — a classe CSS abaixo já é a fonte de verdade do
            // dimensionamento, isto só cobre navegadores que ignorem a
            // classe por algum motivo.
            const iframe = e.target.getIframe();
            iframe.classList.add("yt-player-frame-iframe");
            iframe.style.position = "absolute";
            iframe.style.inset = "0";
            iframe.style.width = "100%";
            iframe.style.height = "100%";
          },
          onStateChange: (e) => {
            const YT = window.YT!;
            if (e.data === YT.PlayerState.PLAYING) {
              if (intervalRef.current) clearInterval(intervalRef.current);
              intervalRef.current = setInterval(() => {
                const player = playerRef.current;
                if (!player) return;
                const duration = player.getDuration();
                const current = player.getCurrentTime();
                if (duration > 0) {
                  onProgressRef.current(Math.min(100, (current / duration) * 100));
                }
              }, 3000);
            } else if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            if (e.data === YT.PlayerState.ENDED) {
              onProgressRef.current(100);
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return (
    <div
      className="yt-player-frame"
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        maxHeight: "100%",
        borderRadius: 10,
        overflow: "hidden",
        background: "#000",
      }}
    >
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
