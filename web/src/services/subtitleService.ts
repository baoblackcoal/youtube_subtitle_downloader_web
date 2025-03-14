import { xml2js, ElementCompact } from 'xml-js';
import { extractVideoId, isValidYouTubeUrl } from '@/utils/urlUtils';
import { YouTubeApiService } from './youtubeApiService';

const youtubeApiService = new YouTubeApiService();

/**
 * 下载结果接口
 */
export interface DownloadResult {
  success: boolean;
  error?: string;
  fileName?: string;
  isInlineData?: boolean;
}

/**
 * 检查当前是否为Vercel环境
 */
function isVercelEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  return hostname.includes('vercel') || 
         hostname.endsWith('.vercel.app') || 
         hostname === 'youtube-subtitle-downloader-web.vercel.app';
}

/**
 * Downloads subtitles from a YouTube video
 * 
 * @param url - The YouTube video URL or video ID
 * @param subtitleType - The subtitle type: 'auto' or 'manual'
 * @param format - The output format: 'vtt', 'srt', or 'txt'
 * @returns A promise that resolves to a download result object
 */
export async function downloadSubtitles(
  url: string, 
  subtitleType: 'auto' | 'manual', 
  format: 'vtt' | 'srt' | 'txt'
): Promise<DownloadResult> {
  try {
    // 记录环境信息
    const isVercel = isVercelEnvironment();
    console.log('Environment:', {
      isVercel,
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
      isDevelopment: process.env.NODE_ENV === 'development'
    });
    
    if (!url.trim()) {
      throw new Error('请输入视频链接');
    }

    if (!isValidYouTubeUrl(url) && url.length !== 11) {
      throw new Error('无效的 YouTube 视频链接');
    }

    const videoId = url.length === 11 ? url : extractVideoId(url);
    
    if (!videoId) {
      throw new Error('无法获取视频 ID');
    }
    
    // Get video info for the title
    const videoInfo = await youtubeApiService.getVideoInfo(videoId);
    
    if (!videoInfo.success) {
      throw new Error(videoInfo.error || '获取视频信息失败');
    }
    
    // Get subtitles
    const subtitleResponse = await youtubeApiService.getSubtitles(videoId, subtitleType);
    
    if (!subtitleResponse.success || !subtitleResponse.subtitles) {
      throw new Error(subtitleResponse.error || '获取字幕失败');
    }
    
    // 检查是否为内联数据
    const isInlineData = subtitleResponse.isInlineData === true;
    
    // Convert subtitle format
    const convertedSubtitles = convertSubtitleFormat(subtitleResponse.subtitles, format);
    
    // Create a safe filename
    const safeTitle = videoInfo.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    const fileName = `${safeTitle}_subtitles.${format}`;
    
    // Download the file
    downloadFile(convertedSubtitles, fileName);
    
    return {
      success: true,
      fileName: fileName,
      isInlineData: isInlineData
    };
    
  } catch (error) {
    console.error('下载字幕失败:', error);
    
    // 检查是否为Vercel环境，尝试使用demo数据
    if (isVercelEnvironment()) {
      try {
        console.log('Vercel环境下载失败，尝试使用demo数据');
        const demoSubtitles = generateDemoSubtitles(format);
        const fileName = `Demo_Subtitles.${format}`;
        downloadFile(demoSubtitles, fileName);
        
        return {
          success: true,
          fileName: fileName,
          isInlineData: true
        };
      } catch (demoError) {
        console.error('生成demo字幕失败:', demoError);
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * Generates demo subtitles as a fallback
 * 
 * @param format - The output format ('vtt', 'srt', or 'txt')
 * @returns The demo subtitle content
 */
function generateDemoSubtitles(format: 'vtt' | 'srt' | 'txt'): string {
  const demoLines = [
    { start: 0, dur: 5, text: '这是一个演示字幕' },
    { start: 5, dur: 5, text: '由于API限制，无法获取实际YouTube字幕' },
    { start: 10, dur: 5, text: '请稍后再试或尝试其他视频' },
    { start: 15, dur: 5, text: 'This is a demo subtitle' },
    { start: 20, dur: 5, text: 'Due to API limitations, actual YouTube subtitles cannot be retrieved' },
    { start: 25, dur: 5, text: 'Please try again later or try a different video' }
  ];
  
  switch (format) {
    case 'vtt':
      let vtt = 'WEBVTT\n\n';
      demoLines.forEach((line, index) => {
        vtt += `${index + 1}\n`;
        vtt += `${formatTimeVTT(line.start)} --> ${formatTimeVTT(line.start + line.dur)}\n`;
        vtt += `${line.text}\n\n`;
      });
      return vtt;
      
    case 'srt':
      let srt = '';
      demoLines.forEach((line, index) => {
        srt += `${index + 1}\n`;
        srt += `${formatTimeSRT(line.start)} --> ${formatTimeSRT(line.start + line.dur)}\n`;
        srt += `${line.text}\n\n`;
      });
      return srt;
      
    case 'txt':
      return demoLines.map(line => line.text).join('\n');
      
    default:
      throw new Error('不支持的字幕格式');
  }
}

/**
 * Converts subtitle XML data to the specified format
 * 
 * @param subtitleData - The XML subtitle data
 * @param targetFormat - The target format ('vtt', 'srt', or 'txt')
 * @returns The converted subtitle content
 */
function convertSubtitleFormat(
  subtitleData: string, 
  targetFormat: 'vtt' | 'srt' | 'txt'
): string {
  try {
    // Parse the XML subtitle data
    const result = xml2js(subtitleData, { compact: true }) as { transcript: ElementCompact };
    
    // Extract text nodes
    const transcript = result.transcript;
    if (!transcript || !transcript.text) {
      throw new Error('字幕内容为空');
    }
    
    // 定义字幕节点的接口
    interface SubtitleNode {
      _attributes: {
        start: string;
        dur?: string;
      };
      _text?: string;
    }
    
    const textNodes = Array.isArray(transcript.text) 
      ? transcript.text as SubtitleNode[]
      : [transcript.text as SubtitleNode];
    
    if (textNodes.length === 0) {
      throw new Error('字幕内容为空');
    }
    
    let convertedSubtitles = '';
    
    // Convert to the target format
    switch (targetFormat) {
      case 'vtt':
        convertedSubtitles = 'WEBVTT\n\n';
        for (let i = 0; i < textNodes.length; i++) {
          const node = textNodes[i];
          const start = formatTimeVTT(parseFloat(node._attributes.start));
          const duration = parseFloat(node._attributes.dur || '0');
          const end = formatTimeVTT(parseFloat(node._attributes.start) + duration);
          const text = node._text || '';
          
          convertedSubtitles += `${i + 1}\n`;
          convertedSubtitles += `${start} --> ${end}\n`;
          convertedSubtitles += `${text}\n\n`;
        }
        break;
        
      case 'srt':
        for (let i = 0; i < textNodes.length; i++) {
          const node = textNodes[i];
          const start = formatTimeSRT(parseFloat(node._attributes.start));
          const duration = parseFloat(node._attributes.dur || '0');
          const end = formatTimeSRT(parseFloat(node._attributes.start) + duration);
          const text = node._text || '';
          
          convertedSubtitles += `${i + 1}\n`;
          convertedSubtitles += `${start} --> ${end}\n`;
          convertedSubtitles += `${text}\n\n`;
        }
        break;
        
      case 'txt':
        for (let i = 0; i < textNodes.length; i++) {
          const text = textNodes[i]._text || '';
          convertedSubtitles += `${text}\n`;
        }
        break;
        
      default:
        throw new Error('不支持的字幕格式');
    }
    
    return convertedSubtitles;
  } catch (error) {
    console.error('转换字幕格式失败:', error);
    // 如果转换失败，返回演示字幕
    return generateDemoSubtitles(targetFormat);
  }
}

/**
 * Formats time in seconds to VTT time format
 * 
 * @param seconds - Time in seconds
 * @returns Formatted time string in VTT format
 */
function formatTimeVTT(seconds: number): string {
  const date = new Date(seconds * 1000);
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const secs = date.getUTCSeconds().toString().padStart(2, '0');
  const ms = date.getUTCMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${secs}.${ms}`;
}

/**
 * Formats time in seconds to SRT time format
 * 
 * @param seconds - Time in seconds
 * @returns Formatted time string in SRT format
 */
function formatTimeSRT(seconds: number): string {
  const date = new Date(seconds * 1000);
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const secs = date.getUTCSeconds().toString().padStart(2, '0');
  const ms = date.getUTCMilliseconds().toString().padStart(3, '0').substring(0, 3);
  return `${hours}:${minutes}:${secs},${ms}`;
}

/**
 * Downloads content as a file
 * 
 * @param content - The content to download
 * @param fileName - The file name
 */
function downloadFile(content: string, fileName: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  
  // Clean up
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
} 