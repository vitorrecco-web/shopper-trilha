declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: {
    setup: (...args: any[]) => void;
    initializeFromPort?: (...args: any[]) => void;
  };
}