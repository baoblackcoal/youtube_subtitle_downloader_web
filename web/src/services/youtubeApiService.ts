import { extractVideoId } from '@/utils/urlUtils';

/**
 * 视频信息接口
 */
export interface VideoInfoResponse {
  success: boolean;
  title?: string;
  videoId?: string;
  error?: string;
}

/**
 * 字幕响应接口
 */
export interface SubtitleResponse {
  success: boolean;
  subtitles?: string;
  error?: string;
}

/**
 * YouTube API 服务类
 */
export class YouTubeApiService {
  private readonly baseApiUrl: string;
  
  constructor() {
    this.baseApiUrl = this.determineBaseApiUrl();
    this.logEnvironmentInfo();
  }
  
  private determineBaseApiUrl(): string {
    const isClient = typeof window !== 'undefined';
    const isDevMode = process.env.NODE_ENV === 'development';
    
    if (isClient) {
      // 在浏览器环境中，使用相对路径
      return `/api`;
    } else {
      // 在服务器端环境，使用绝对路径
      // 对于Vercel部署，应该使用环境变量中的部署URL
      const vercelUrl = process.env.VERCEL_URL;
      const defaultUrl = isDevMode ? 'http://localhost:3000' : 'https://youtube-subtitle-downloader-web.vercel.app';
      const baseUrl = vercelUrl ? `https://${vercelUrl}` : defaultUrl;
      return `${baseUrl}/api`;
    }
  }
  
  private logEnvironmentInfo(): void {
    console.log('[YouTubeApiService] 初始化服务，环境信息:', {
      baseApiUrl: this.baseApiUrl,
      isClient: typeof window !== 'undefined',
      nodeEnv: process.env.NODE_ENV,
      vercelUrl: process.env.VERCEL_URL,
      isVercel: process.env.VERCEL === '1'
    });
  }
  
  /**
   * 记录请求开始信息
   */
  private logRequestStart(method: string, url: string): void {
    console.log(`[YouTubeApiService] 开始${method}请求: ${url}`);
    console.time(`[YouTubeApiService] ${method}:${url}`);
  }
  
  /**
   * 记录请求结束信息
   */
  private logRequestEnd(method: string, url: string, status: number, response: any): void {
    console.timeEnd(`[YouTubeApiService] ${method}:${url}`);
    console.log(`[YouTubeApiService] ${method}请求完成: ${url}, 状态: ${status}`, response);
  }
  
  /**
   * 记录请求错误
   */
  private logRequestError(method: string, url: string, error: any): void {
    console.timeEnd(`[YouTubeApiService] ${method}:${url}`);
    console.error(`[YouTubeApiService] ${method}请求失败: ${url}`, error);
    
    // 提供详细的错误日志
    if (error instanceof Error) {
      console.error(`[YouTubeApiService] 错误详情:`, {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    } else if (typeof error === 'object') {
      console.error(`[YouTubeApiService] 错误对象:`, JSON.stringify(error, null, 2));
    }
  }
  
  /**
   * 获取视频信息
   * 
   * @param urlOrId - 视频 URL 或 ID
   * @returns 视频信息响应
   */
  async getVideoInfo(urlOrId: string): Promise<VideoInfoResponse> {
    let videoId = urlOrId;
    
    // 如果提供的是URL，提取视频ID
    if (urlOrId.length > 11) {
      videoId = extractVideoId(urlOrId) || urlOrId;
      console.log(`[YouTubeApiService] 从URL提取的视频ID: ${videoId}`);
    }
    
    const url = `${this.baseApiUrl}/video-info?videoId=${encodeURIComponent(videoId)}`;
    
    this.logRequestStart('GET', url);
    
    try {
      // 使用AbortSignal设置超时
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时
      
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      clearTimeout(timeoutId);
      
      const status = response.status;
      const data = await response.json();
      
      this.logRequestEnd('GET', url, status, data);
      
      if (!response.ok) {
        throw new Error(`HTTP错误! 状态码: ${status}, 信息: ${data.error || '未知错误'}`);
      }
      
      if (!data.success) {
        throw new Error(data.error || '获取视频信息失败，服务器返回了失败状态');
      }
      
      return data;
    } catch (error: any) {
      this.logRequestError('GET', url, error);
      
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: '请求超时，请稍后再试'
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        videoId: videoId
      };
    }
  }
  
  /**
   * 获取视频字幕
   * 
   * @param urlOrId - 视频URL或ID
   * @param subtitleType - 字幕类型
   * @returns 字幕响应
   */
  async getSubtitles(urlOrId: string, subtitleType: 'auto' | 'manual' = 'auto'): Promise<SubtitleResponse> {
    let videoId = urlOrId;
    
    // 如果提供的是URL，提取视频ID
    if (urlOrId.length > 11) {
      videoId = extractVideoId(urlOrId) || urlOrId;
      console.log(`[YouTubeApiService] 从URL提取的视频ID: ${videoId}`);
    }
    
    const url = `${this.baseApiUrl}/subtitles?videoId=${encodeURIComponent(videoId)}&subtitleType=${subtitleType}`;
    
    this.logRequestStart('GET', url);
    
    try {
      // 使用AbortSignal设置超时
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时
      
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      });
      
      clearTimeout(timeoutId);
      
      const status = response.status;
      
      // 尝试解析JSON，但如果失败，返回原始文本
      let data;
      const contentType = response.headers.get('content-type');
      console.log(`[YouTubeApiService] 响应Content-Type: ${contentType}`);
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // 不是JSON，可能是直接返回的字幕XML
        const text = await response.text();
        console.log(`[YouTubeApiService] 非JSON响应，收到原始文本，长度: ${text.length}`);
        
        // 如果是XML格式，则认为是字幕
        if (text.startsWith('<?xml') || text.includes('<transcript>')) {
          data = {
            success: true,
            subtitles: text
          };
        } else {
          // 不是XML，可能是错误
          data = {
            success: false,
            error: '收到非JSON且非XML响应: ' + text.substring(0, 100) + '...'
          };
        }
      }
      
      this.logRequestEnd('GET', url, status, {
        success: data.success,
        hasSubtitles: !!data.subtitles,
        error: data.error
      });
      
      if (!response.ok) {
        throw new Error(`HTTP错误! 状态码: ${status}, 信息: ${data.error || '未知错误'}`);
      }
      
      if (!data.success) {
        throw new Error(data.error || '获取字幕失败，服务器返回了失败状态');
      }
      
      return data;
    } catch (error: any) {
      this.logRequestError('GET', url, error);
      
      if (error.name === 'AbortError') {
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