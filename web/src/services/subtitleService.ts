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
}

/**
 * 调试日志函数
 */
function debugLog(message: string, data?: any) {
  const prefix = '[SubtitleService]';
  if (data) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

/**
 * 错误日志函数
 */
function errorLog(message: string, error: any) {
  const prefix = '[SubtitleService ERROR]';
  console.error(`${prefix} ${message}`, error);
  
  // 打印更多错误详情
  if (error instanceof Error) {
    console.error(`${prefix} Error details:`, {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  } else if (typeof error === 'object') {
    console.error(`${prefix} Error object:`, JSON.stringify(error, null, 2));
  }
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
  debugLog(`开始下载字幕，参数: url=${url.substring(0, 20)}..., subtitleType=${subtitleType}, format=${format}`);
  
  try {
    if (!url.trim()) {
      throw new Error('请输入视频链接');
    }

    debugLog(`检查URL有效性: ${url.substring(0, 20)}...`);
    if (!isValidYouTubeUrl(url) && url.length !== 11) {
      throw new Error('无效的 YouTube 视频链接');
    }

    const videoId = url.length === 11 ? url : extractVideoId(url);
    debugLog(`提取的视频ID: ${videoId}`);
    
    if (!videoId) {
      throw new Error('无法获取视频 ID');
    }
    
    // Get video info for the title
    debugLog(`获取视频信息: videoId=${videoId}`);
    const videoInfo = await youtubeApiService.getVideoInfo(videoId);
    debugLog(`视频信息响应:`, videoInfo);
    
    if (!videoInfo.success) {
      throw new Error(videoInfo.error || '获取视频信息失败');
    }
    
    // Get subtitles
    debugLog(`获取字幕: videoId=${videoId}, subtitleType=${subtitleType}`);
    const subtitleResponse = await youtubeApiService.getSubtitles(videoId, subtitleType);
    debugLog(`字幕响应:`, {
      success: subtitleResponse.success,
      error: subtitleResponse.error,
      hasSubtitles: !!subtitleResponse.subtitles,
      subtitlesLength: subtitleResponse.subtitles ? subtitleResponse.subtitles.length : 0
    });
    
    if (!subtitleResponse.success || !subtitleResponse.subtitles) {
      throw new Error(subtitleResponse.error || '获取字幕失败');
    }
    
    // Convert subtitle format
    debugLog(`转换字幕格式为: ${format}`);
    const convertedSubtitles = convertSubtitleFormat(subtitleResponse.subtitles, format);
    debugLog(`转换后的字幕长度: ${convertedSubtitles.length}`);
    
    // Create a safe filename
    const safeTitle = videoInfo.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    const fileName = `${safeTitle}_subtitles.${format}`;
    debugLog(`生成的文件名: ${fileName}`);
    
    // Download the file
    debugLog(`开始下载文件...`);
    downloadFile(convertedSubtitles, fileName);
    debugLog(`文件下载成功`);
    
    return {
      success: true,
      fileName: fileName
    };
    
  } catch (error) {
    errorLog('下载字幕失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
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
  debugLog(`开始转换字幕格式: 目标格式=${targetFormat}`);
  debugLog(`原始字幕数据前100个字符: ${subtitleData.substring(0, 100)}...`);

  try {
    // Parse the XML subtitle data
    debugLog(`解析XML数据...`);
    const result = xml2js(subtitleData, { compact: true }) as { transcript: ElementCompact };
    
    // Extract text nodes
    const transcript = result.transcript;
    if (!transcript || !transcript.text) {
      debugLog(`字幕内容为空: transcript=${JSON.stringify(transcript)}`);
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
    
    debugLog(`解析出${textNodes.length}个字幕节点`);

    if (textNodes.length === 0) {
      throw new Error('字幕内容为空');
    }
    
    let convertedSubtitles = '';
    
    // Convert to the target format
    debugLog(`转换为${targetFormat}格式...`);
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
    
    debugLog(`转换完成，生成${convertedSubtitles.length}字节的${targetFormat}格式字幕`);
    return convertedSubtitles;
  } catch (error) {
    errorLog('转换字幕格式失败:', error);
    throw new Error('转换字幕格式失败: ' + (error instanceof Error ? error.message : '未知错误'));
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
  debugLog(`创建下载文件: 文件名=${fileName}, 内容长度=${content.length}`);
  
  try {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    debugLog(`创建的Blob URL: ${url}`);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    
    debugLog(`触发下载...`);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      debugLog(`清理下载资源完成`);
    }, 100);
  } catch (error) {
    errorLog('文件下载失败:', error);
    throw new Error('文件下载失败: ' + (error instanceof Error ? error.message : '未知错误'));
  }
} 