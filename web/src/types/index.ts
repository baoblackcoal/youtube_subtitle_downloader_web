/**
 * YouTube API response types
 */

export interface VideoInfo {
  success: boolean;
  title: string;
  videoId: string;
  error?: string;
}

export interface SubtitleResponse {
  success: boolean;
  subtitles?: string;
  error?: string;
}

/**
 * Subtitle types
 */
export type SubtitleType = 'auto' | 'manual';
export type SubtitleFormat = 'vtt' | 'srt' | 'txt'; 