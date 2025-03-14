import { xml2js, ElementCompact } from 'xml-js';
import { extractVideoId, isValidYouTubeUrl } from '@/utils/urlUtils';
import { YouTubeApiService } from './youtubeApiService';

const youtubeApiService = new YouTubeApiService();

/**
 * Downloads subtitles from a YouTube video
 * 
 * @param url - The YouTube video URL or video ID
 * @param subtitleType - The subtitle type: 'auto' or 'manual'
 * @param format - The output format: 'vtt', 'srt', or 'txt'
 * @returns A promise that resolves when the download is complete
 */
export async function downloadSubtitles(
  url: string, 
  subtitleType: 'auto' | 'manual', 
  format: 'vtt' | 'srt' | 'txt'
): Promise<void> {
  try {
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
    
    // Get subtitles
    const subtitleResponse = await youtubeApiService.getSubtitles(videoId, subtitleType);
    
    if (!subtitleResponse.success || !subtitleResponse.subtitles) {
      throw new Error(subtitleResponse.error || '获取字幕失败');
    }
    
    // Convert subtitle format
    const convertedSubtitles = convertSubtitleFormat(subtitleResponse.subtitles, format);
    
    // Create a safe filename
    const safeTitle = videoInfo.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    const fileName = `${safeTitle}_subtitles.${format}`;
    
    // Download the file
    downloadFile(convertedSubtitles, fileName);
    
  } catch (error) {
    console.error('下载字幕失败:', error);
    throw error;
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
    throw new Error('转换字幕格式失败');
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