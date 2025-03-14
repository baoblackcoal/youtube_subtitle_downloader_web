interface VideoInfo {
  success: boolean;
  title: string;
  videoId: string;
  error?: string;
}

interface SubtitleEntry {
  start: number;
  duration: number;
  text: string;
}

interface SubtitleResponse {
  success: boolean;
  subtitles?: SubtitleEntry[];
  error?: string;
}

export class SubtitleService {
  /**
   * 获取视频信息
   */
  static async getVideoInfo(videoId: string): Promise<VideoInfo> {
    try {
      const response = await fetch(`/api/video-info?videoId=${encodeURIComponent(videoId)}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取视频信息失败:', error);
      return {
        success: false,
        title: `Video_${videoId}`,
        videoId,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 获取视频字幕
   */
  static async getSubtitles(videoId: string, subtitleType: 'auto' | 'manual'): Promise<SubtitleResponse> {
    try {
      // 1. 获取原始字幕数据
      const response = await fetch(
        `/api/subtitles?videoId=${encodeURIComponent(videoId)}&subtitleType=${subtitleType}`
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '获取字幕失败');
      }

      // 2. 解析字幕数据
      const parseResponse = await fetch('/api/parse-subtitles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ xmlData: data.subtitles }),
      });

      const parsedData = await parseResponse.json();
      return parsedData;
    } catch (error) {
      console.error('处理字幕失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 将时间戳转换为可读格式 (MM:SS)
   */
  static formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * 查找指定时间点对应的字幕
   */
  static findSubtitleAtTime(subtitles: SubtitleEntry[], time: number): SubtitleEntry | null {
    return subtitles.find(subtitle => 
      time >= subtitle.start && time < (subtitle.start + subtitle.duration)
    ) || null;
  }

  /**
   * 获取指定时间范围内的字幕
   */
  static getSubtitlesInRange(
    subtitles: SubtitleEntry[],
    startTime: number,
    endTime: number
  ): SubtitleEntry[] {
    return subtitles.filter(subtitle =>
      (subtitle.start >= startTime && subtitle.start < endTime) ||
      (subtitle.start + subtitle.duration > startTime && subtitle.start + subtitle.duration <= endTime)
    );
  }
} 