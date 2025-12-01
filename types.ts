
export enum ConversionMode {
  MAC_TO_WIN = 'MAC_TO_WIN',
  WIN_TO_MAC = 'WIN_TO_MAC',
}

export enum FileStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export enum AppTab {
  FIXER = 'FIXER',
  SRT = 'SRT',
}

export enum TextProcessMode {
  EXTRACT_TEXT = 'EXTRACT_TEXT',
  REFORMAT = 'REFORMAT',
}

export interface ProcessedFile {
  id: string;
  originalName: string;
  file: File;
  status: FileStatus;
  downloadUrl?: string;
  errorMessage?: string;
  fixedCount?: number;
  blob?: Blob;
  resultMessage?: string; // 성공 시 표시할 맞춤 메시지
  outputExtension?: string; // .txt or .srt
}

export interface AnalysisResult {
  summary: string;
  technicalDetails: string;
}
