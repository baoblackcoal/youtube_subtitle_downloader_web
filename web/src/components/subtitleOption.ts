/**
 * Interface for subtitle options
 */
export interface SubtitleOption {
  id: string;
  label: string;
  value: string;
  type?: 'auto' | 'manual';
  format?: 'vtt' | 'srt' | 'txt';
} 