import { extractVideoId } from '@/utils/urlUtils';

/**
 * Service for interacting with YouTube data
 */
export class YouTubeApiService {
  private apiBaseUrl: string;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second

  constructor() {
    // 动态获取当前域名和端口
    this.apiBaseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : '';
    console.log('API Base URL:', this.apiBaseUrl);
  }

  /**
   * 使用重试逻辑发送请求
   * @param url 请求URL
   * @param options fetch选项
   * @param retries 剩余重试次数
   * @returns 请求响应
   */
  private async fetchWithRetry(url: string, options: RequestInit = {}, retries = this.maxRetries): Promise<Response> {
    try {
      console.log(`Fetching URL: ${url}`);
      
      const defaultOptions: RequestInit = {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          ...options.headers,
        },
        ...options,
      };
      
      const response = await fetch(url, defaultOptions);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      return response;
    } catch (error: any) {
      console.error(`Request failed (${retries} retries left):`, error.message);
      
      if (retries > 0) {
        console.log(`Retrying... ${retries} attempts left`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.fetchWithRetry(url, options, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Gets information about a YouTube video
   * 
   * @param videoId - The YouTube video ID
   * @returns A promise that resolves to the video info
   */
  async getVideoInfo(videoId: string) {
    try {
      console.log('Getting video info for:', videoId);
      
      // 使用我们的API端点而不是直接请求YouTube
      const response = await this.fetchWithRetry(`${this.apiBaseUrl}/api/video-info?videoId=${videoId}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(60000) // 60秒超时
      });
      
      const data = await response.json();
      console.log('Video info response:', data);
      
      // 检查响应状态
      if (!data.success) {
        console.error('Video info API error:', data.error);
        throw new Error(data.error || '获取视频信息失败');
      }
      
      return {
        success: true,
        title: data.title || `Video_${videoId}`,
        videoId: videoId
      };
    } catch (error) {
      console.error('获取视频信息失败:', error);
      
      // 分析网络错误
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return { 
          success: false, 
          error: '网络错误，请检查您的网络连接',
          title: `Video_${videoId}`
        };
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        return { 
          success: false, 
          error: '请求超时，请稍后再试',
          title: `Video_${videoId}`
        };
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误',
        title: `Video_${videoId}` // 发生错误时返回一个默认标题
      };
    }
  }
  
  /**
   * Gets subtitles for a YouTube video
   * 
   * @param videoId - The YouTube video ID
   * @param subtitleType - The subtitle type ('auto' or 'manual')
   * @returns A promise that resolves to the subtitle data
   */
  async getSubtitles(videoId: string, subtitleType: 'auto' | 'manual') {
    try {
      console.log('Getting subtitles for:', videoId, 'type:', subtitleType);
      
      // 使用我们的API端点而不是直接请求YouTube
      const response = await this.fetchWithRetry(
        `${this.apiBaseUrl}/api/subtitles?videoId=${videoId}&subtitleType=${subtitleType}`,
        {
          cache: 'no-store',
          signal: AbortSignal.timeout(60000) // 60秒超时
        }
      );
      
      const data = await response.json();
      console.log('Subtitles response status:', response.status);
      
      // 检查响应状态
      if (!data.success) {
        console.error('Subtitles API error:', data.error);
        throw new Error(data.error || '获取字幕失败');
      }
      
      return { 
        success: true, 
        subtitles: data.subtitles 
      };
    } catch (error) {
      console.error('获取字幕失败:', error);
      
      // 分析网络错误
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return { 
          success: false, 
          error: '网络错误，请检查您的网络连接'
        };
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        return { 
          success: false, 
          error: '请求超时，请稍后再试'
        };
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      };
    }
  }
}