import axios from 'axios';
import { extractVideoId } from '@/utils/urlUtils';

/**
 * Service for interacting with YouTube data
 */
export class YouTubeApiService {
  private apiBaseUrl: string;

  constructor() {
    // 动态获取当前域名和端口
    this.apiBaseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : '';
    console.log('API Base URL:', this.apiBaseUrl);
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
      const response = await axios.get(`${this.apiBaseUrl}/api/video-info?videoId=${videoId}`);
      
      // 检查响应状态
      if (!response.data.success) {
        throw new Error(response.data.error || '获取视频信息失败');
      }
      
      return {
        success: true,
        title: response.data.title || `Video_${videoId}`,
        videoId: videoId
      };
    } catch (error) {
      console.error('获取视频信息失败:', error);
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
      const response = await axios.get(
        `${this.apiBaseUrl}/api/subtitles?videoId=${videoId}&subtitleType=${subtitleType}`
      );
      
      // 检查响应状态
      if (!response.data.success) {
        throw new Error(response.data.error || '获取字幕失败');
      }
      
      return { 
        success: true, 
        subtitles: response.data.subtitles 
      };
    } catch (error) {
      console.error('获取字幕失败:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      };
    }
  }
}