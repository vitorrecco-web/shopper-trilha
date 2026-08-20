"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Player de YouTube incorporado, responsivo (16:9).
 *
 * CAUSA REAL DO RETÂNGULO PRETO NO SAFARI/IOS (investigada a pedido,
 * depois que a correção anterior — playsinline + CSS — não resolveu):
 *
 * A implementação anterior deixava a própria YT IFrame Player API criar
 * o `<iframe>` do zero, via `new YT.Player(div, { videoId, ... })`, sem
 * passar `origin`. Esse fluxo depende de um handshake por `postMessage`
 * entre a página e o iframe do YouTube para a API "assumir" o elemento
 * e o vídeo carregar. No Safari/iOS, com as políticas de rastreamento
 * entre sites mais estritas (ITP) que o Chrome/Android, esse handshake
 * pode falhar ou atrasar de forma que, nesse fluxo, nada de visível
 * chega a ser desenhado dentro do iframe — o "container" existe (por
 * isso o 16:9 e o botão Ampliar apareciam normalmente), mas o vídeo em
 * si nunca é carregado.
 *
 * CORREÇÃO: parar de depender da API para CRIAR o iframe. Agora
 * montamos nós mesmos um `<iframe>` de verdade, com uma URL de embed
 * completa e válida (`enablejsapi=1`, `origin`, `playsinline=1`) — o
 * vídeo funciona mesmo que a API de tracking falhe ou demore. A YT
 * IFrame Player API só é usada depois, "adotando" esse iframe já
 * existente (modo documentado da própria API) exclusivamente para ler
 * o progresso de reprodução — nunca para criar o elemento.
 *
 * `onProgress` é chamado a cada ~3s enquanto o vídeo está tocando, com o
 * percentual (0-100) já assistido nesta reprodução — inalterado.
 */

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement,
        opts: {
          events?: {
            onReady?: (e: { target: YoutubePlayerInstance }) => void;
            onStateChange?: (e: { data: number; target: YoutubePlayerInstance }) => void;
            onError?: (e: { data: number }) => void;
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

/** Códigos de erro documentados da YouTube IFrame API — só o código numérico, nunca dado sensível. */
const YT_ERROR_MESSAGES: Record<number, string> = {
  2: "parâmetro inválido na URL do vídeo",
  5: "erro de reprodução HTML5",
  100: "vídeo não encontrado (removido ou privado)",
  101: "o dono do vídeo não permite incorporação (embed)",
  150: "o dono do vídeo não permite incorporação (embed)",
};

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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YoutubePlayerInstance | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  const [diagnostic, setDiagnostic] = useState<string | null>(null);

  // URL de embed completa e válida — o vídeo funciona a partir dela
  // sozinha, mesmo que a API de tracking abaixo nunca "adote" o iframe.
  const embedSrc = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : undefined;
    const params = new URLSearchParams({
      enablejsapi: "1",
      playsinline: "1",
      rel: "0",
      modestbranding: "1",
    });
    if (origin) params.set("origin", origin);
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  }, [videoId]);

  useEffect(() => {
    let destroyed = false;
    setDiagnostic(null);

    loadYoutubeIframeApi().then(() => {
      if (destroyed || !iframeRef.current || !window.YT) return;

      // Adota o iframe JÁ EXISTENTE (criado por nós no JSX abaixo, com
      // `src` completo) — a API não cria nada aqui, só se conecta a ele
      // via postMessage para ler o estado de reprodução.
      playerRef.current = new window.YT.Player(iframeRef.current, {
        events: {
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
          onError: (e) => {
            // Diagnóstico visível só do código numérico — nunca expõe
            // nada sensível, e ajuda a identificar rapidamente se um
            // vídeo específico tem embed bloqueado pelo dono (101/150)
            // em vez de ser um problema do player em si.
            const detail = YT_ERROR_MESSAGES[e.data] ?? `código ${e.data}`;
            console.error("YouTube player onError:", e.data, detail);
            setDiagnostic(`Não foi possível carregar o vídeo (${detail}).`);
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
      <iframe
        ref={iframeRef}
        src={embedSrc}
        title="Vídeo do módulo"
        // Atributos "allow" recomendados pelo próprio YouTube para o
        // player funcionar corretamente em navegadores mobile,
        // incluindo Safari/iOS.
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
      />
      {diagnostic && (
        <p
          role="alert"
          style={{
            position: "absolute",
            bottom: 6,
            left: 6,
            right: 6,
            margin: 0,
            fontSize: 11,
            color: "#ffb4b4",
            background: "rgba(0,0,0,0.6)",
            padding: "4px 8px",
            borderRadius: 6,
          }}
        >
          {diagnostic}
        </p>
      )}
    </div>
  );
}
