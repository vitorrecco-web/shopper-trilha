"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Player de YouTube incorporado, responsivo (16:9).
 *
 * HISTÓRICO DA INVESTIGAÇÃO (retângulo preto no Safari/iOS):
 * 1ª tentativa: CSS + `playsinline` — não era só CSS.
 * 2ª tentativa: `<iframe>` real montado por nós + `new YT.Player(iframe, {events})`
 *    "adotando" esse iframe já existente — ainda preto no Safari/iOS.
 *
 * CAUSA CONCRETA ENCONTRADA nesta revisão: a documentação da própria
 * YouTube IFrame API exige que, para "adotar" um `<iframe>` já
 * existente, ele já tenha os ATRIBUTOS HTML `width`/`height` definidos
 * — não basta CSS. Nosso iframe só tinha o tamanho via `style` (CSS),
 * nunca como atributo. É plausível que, sem isso, a API considere o
 * elemento inválido para adoção e tente "corrigir"/recriar o iframe por
 * conta própria — reintroduzindo exatamente o bug original (perda do
 * `origin` cuidadosamente configurado), só que numa segunda carga, o
 * que bate com o relato: "o container aparece certo, o vídeo é que não
 * carrega".
 *
 * CORREÇÃO: os atributos `width`/`height` (valores fixos, meramente
 * para satisfazer a API — a CSS abaixo continua controlando o tamanho
 * visual real de forma responsiva) foram adicionados ao `<iframe>`.
 *
 * Arquitetura mantida como pedido: o `<iframe>` com URL de embed válida
 * funciona sozinho, independente da API — a criação do `YT.Player` está
 * dentro de um `try/catch` e não é requisito para o vídeo aparecer. Se
 * a instância de tracking falhar por qualquer motivo, o vídeo continua
 * tocando normalmente; só o percentual assistido deixa de avançar até
 * a próxima tentativa (nunca o inverso).
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
      // `src` completo e agora também width/height como atributos) — a
      // API não cria nada aqui, só se conecta a ele via postMessage
      // para ler o estado de reprodução. Qualquer falha aqui dentro
      // NUNCA deve afetar o iframe, que já está funcionando por conta
      // própria antes mesmo desta chamada.
      try {
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
      } catch (err) {
        // O vídeo (iframe) já está renderizado e funcional independente
        // disso — uma falha aqui só significa que o percentual assistido
        // não vai avançar, nunca que o vídeo para de tocar.
        console.error("Falha ao inicializar o tracking do YouTube:", err);
      }
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
        background: "#000",
        // NÃO colocar borderRadius/overflow:hidden neste elemento: é uma
        // combinação com bug conhecido no WebKit (Safari/iOS) — vídeo
        // com decodificação por hardware (como o de um iframe do
        // YouTube) pode falhar em pintar visualmente (fica preto)
        // quando o container direto tem cantos arredondados + corte de
        // conteúdo ao mesmo tempo, mesmo com tudo funcionando por
        // baixo. Se quiser cantos arredondados visuais, aplicar num
        // wrapper decorativo por fora deste elemento, nunca aqui.
      }}
    >
      <iframe
        ref={iframeRef}
        src={embedSrc}
        title="Vídeo do módulo"
        // width/height como ATRIBUTOS reais (não só CSS) — exigido pela
        // documentação da YouTube IFrame API para "adotar" um iframe já
        // existente. O valor em si é só um placeholder: quem controla o
        // tamanho visual de verdade é a CSS logo abaixo (position:
        // absolute + 100%), de forma responsiva.
        width={640}
        height={360}
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
