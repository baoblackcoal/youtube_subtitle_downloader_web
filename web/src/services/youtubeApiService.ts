import axios from 'axios';
import { extractVideoId } from '@/utils/urlUtils';

/**
 * Service for interacting with YouTube data
 */
export class YouTubeApiService {
  private apiBaseUrl: string;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second
  private isVercelEnvironment: boolean = false;

  constructor() {
    // 动态获取当前域名和端口
    this.apiBaseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : '';
    
    // 检测是否为Vercel环境
    this.isVercelEnvironment = this.checkIfVercelEnvironment();
    
    console.log('API Base URL:', this.apiBaseUrl);
    console.log('Is Vercel Environment:', this.isVercelEnvironment);
  }

  /**
   * 检测当前是否为Vercel环境
   */
  private checkIfVercelEnvironment(): boolean {
    if (typeof window === 'undefined') return false;
    
    const hostname = window.location.hostname;
    return hostname.includes('vercel') || 
           hostname.endsWith('.vercel.app') || 
           hostname === 'youtube-subtitle-downloader-web.vercel.app';
  }

  /**
   * 使用重试逻辑发送请求
   * @param url 请求URL
   * @param config axios配置
   * @param retries 剩余重试次数
   * @returns 请求响应
   */
  private async fetchWithRetry(url: string, config: any, retries = this.maxRetries): Promise<any> {
    try {
      console.log(`Fetching URL: ${url}`);
      
      // 如果是Vercel环境，添加特殊处理
      if (this.isVercelEnvironment) {
        config.headers = {
          ...config.headers,
          'X-Vercel-Deployment': 'true',
          'X-Real-IP': '127.0.0.1',  // 尝试避免某些IP限制
          'Origin': this.apiBaseUrl,
          'Referer': this.apiBaseUrl,
        };
        
        // 使用较低的超时，避免Vercel的函数超时限制
        if (config.timeout > 30000) {
          config.timeout = 30000;
        }
      }
      
      const response = await axios(url, config);
      console.log(`Response status: ${response.status}`);
      return response;
    } catch (error: any) {
      console.error(`Request failed (${retries} retries left):`, error.message);
      
      if (error.response) {
        console.error('Error response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          headers: error.response.headers,
        });
      }
      
      if (retries > 0) {
        console.log(`Retrying... ${retries} attempts left`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.fetchWithRetry(url, config, retries - 1);
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
        timeout: this.isVercelEnvironment ? 30000 : 60000, // Vercel环境使用较短的超时
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      });
      
      console.log('Video info response:', response.data);
      
      // 检查响应状态
      if (!response.data.success) {
        console.error('Video info API error:', response.data.error);
        throw new Error(response.data.error || '获取视频信息失败');
      }
      
      return {
        success: true,
        title: response.data.title || `Video_${videoId}`,
        videoId: videoId
      };
    } catch (error) {
      console.error('获取视频信息失败:', error);
      // 如果是网络错误，提供更具体的错误信息
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
          code: error.code,
          isTimeout: error.code === 'ECONNABORTED'
        });
        
        // 根据错误类型提供更具体的错误信息
        if (error.code === 'ECONNABORTED') {
          return { 
            success: false, 
            error: '请求超时，请稍后再试',
            title: `Video_${videoId}`
          };
        } else if (!error.response) {
          return { 
            success: false, 
            error: '网络错误，请检查您的网络连接',
            title: `Video_${videoId}`
          };
        }
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
      console.log('Environment:', this.isVercelEnvironment ? 'Vercel' : 'Local');
      
      // 使用我们的API端点而不是直接请求YouTube
      const response = await this.fetchWithRetry(
        `${this.apiBaseUrl}/api/subtitles?videoId=${videoId}&subtitleType=${subtitleType}`,
        {
          timeout: this.isVercelEnvironment ? 30000 : 60000, // Vercel环境使用较短的超时
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Expires': '0',
          }
        }
      );
      
      console.log('Subtitles response status:', response.status);
      console.log('Subtitles response data:', response.data ? 'Data received' : 'No data');
      
      // 检查响应状态
      if (!response.data.success) {
        console.error('Subtitles API error:', response.data.error);
        throw new Error(response.data.error || '获取字幕失败');
      }
      
      return { 
        success: true, 
        subtitles: response.data.subtitles,
        isInlineData: response.data.isInlineData === true
      };
    } catch (error) {
      console.error('获取字幕失败:', error);
      // 如果是网络错误，提供更具体的错误信息
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
          code: error.code,
          isTimeout: error.code === 'ECONNABORTED'
        });
        
        // 根据错误类型提供更具体的错误信息
        if (error.code === 'ECONNABORTED') {
          return { 
            success: false, 
            error: '请求超时，请稍后再试'
          };
        } else if (!error.response) {
          return { 
            success: false, 
            error: '网络错误，请检查您的网络连接'
          };
        }
        
        // 如果服务器返回了错误信息，使用服务器的错误信息
        if (error.response?.data?.error) {
          return { 
            success: false, 
            error: error.response.data.error
          };
        }
      }
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      };
    }
  }
}