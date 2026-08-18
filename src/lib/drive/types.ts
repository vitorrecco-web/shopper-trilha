/**
 * Abstração mínima sobre "listar filhos de uma pasta do Drive".
 *
 * Existe como interface (não só como função direta usando `googleapis`)
 * para permitir testar a lógica de mapeamento da árvore (trilhaMapper.ts)
 * com uma implementação falsa em memória, sem precisar de credenciais
 * reais nem de rede — a lógica de parsing é a parte que mais importa
 * validar, não a chamada HTTP em si.
 */
export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
}

export interface DriveLister {
  listChildren(folderId: string): Promise<DriveItem[]>;
}

export const FOLDER_MIME = "application/vnd.google-apps.folder";
export const PDF_MIME = "application/pdf";
