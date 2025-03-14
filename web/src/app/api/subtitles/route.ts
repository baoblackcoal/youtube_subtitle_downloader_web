import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// 更新 Cookie 字符串，添加更多必要的 cookies
const COOKIE_STRING = 'CONSENT=YES+cb; GPS=1; VISITOR_INFO1_LIVE=true; YSC=true; PREF=tz=Asia.Tokyo';
// 更新 User-Agent 为最新版本
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// 使用公共代理服务
const PUBLIC_PROXIES = [
  'https://cors-anywhere.herokuapp.com/',
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?'
];

// 获取环境中的YouTube代理URL前缀
function getYouTubeProxyUrl() {
  // 检查是否在Vercel环境中
  const isVercel = process.env.VERCEL === '1';
  
  // 获取当前域名，用于构建代理URL
  const host = process.env.VERCEL_URL || 'localhost:3000';
  const protocol = isVercel ? 'https' : 'http';
  
  // 使用我们在next.config.mjs中配置的代理
  return isVercel 
    ? `${protocol}://${host}/youtube-proxy` 
    : 'https://www.youtube.com';
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, options: any = {}, retries = MAX_RETRIES): Promise<Response> {
  try {
    console.log(`Fetching URL: ${url}`);
    
    // 设置默认选项
    const fetchOptions = {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Cookie': COOKIE_STRING,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        ...options.headers
      },
      ...options
    };
    
    const response = await fetch(url, fetchOptions);
    console.log(`Response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`HTTP 错误! 状态码: ${response.status}`);
    }
    
    return response;
  } catch (error: any) {
    console.error(`Request failed (${retries} retries left):`, error.message);
    
    if (retries > 0) {
      console.log(`Retrying... ${retries} attempts left`);
      await sleep(RETRY_DELAY);
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

// 尝试使用不同的代理获取数据
async function fetchWithProxies(url: string, options: any = {}): Promise<Response> {
  // 首先尝试直接请求
  try {
    return await fetchWithRetry(url, options);
  } catch (directError: any) {
    console.error('直接请求失败，尝试使用代理:', directError.message);
    
    // 如果直接请求失败，尝试使用内部代理
    try {
      // 使用我们配置的代理路径
      const internalProxyUrl = url.replace('https://www.youtube.com', getYouTubeProxyUrl());
      console.log(`尝试使用内部代理: ${internalProxyUrl}`);
      return await fetchWithRetry(internalProxyUrl, options);
    } catch (internalProxyError: any) {
      console.error('内部代理请求失败:', internalProxyError.message);
      
      // 如果内部代理失败，尝试使用外部公共代理
      for (const proxy of PUBLIC_PROXIES) {
        try {
          console.log(`尝试使用公共代理: ${proxy}`);
          const proxyUrl = `${proxy}${encodeURIComponent(url)}`;
          return await fetchWithRetry(proxyUrl, options);
        } catch (proxyError: any) {
          console.error(`代理 ${proxy} 请求失败:`, proxyError.message);
          // 继续尝试下一个代理
        }
      }
    }
    
    // 如果所有代理都失败，抛出原始错误
    throw directError;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const videoId = searchParams.get('videoId');
  const subtitleType = searchParams.get('subtitleType') as 'auto' | 'manual';

  if (!videoId) {
    return NextResponse.json(
      { success: false, error: '缺少视频ID' },
      { status: 400 }
    );
  }

  if (!subtitleType || (subtitleType !== 'auto' && subtitleType !== 'manual')) {
    return NextResponse.json(
      { success: false, error: '无效的字幕类型' },
      { status: 400 }
    );
  }

  // 删除模拟数据
  if (videoId === 'oc6RV5c1yd0') {
    console.log('不再使用模拟数据，尝试获取真实字幕数据');
  }

  try {
    // 使用新的获取字幕方法
    const result = await getSubtitles(videoId, subtitleType);
    return NextResponse.json(result);
  } catch (error) {
    console.error('获取字幕失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage,
      videoId,
      subtitleType,
    }, { status: 500 });
  }
}

/**
 * Gets subtitles for a YouTube video
 * 
 * @param videoId - The YouTube video ID
 * @param subtitleType - The subtitle type ('auto' or 'manual')
 * @returns A promise that resolves to the subtitle data
 */
async function getSubtitles(videoId: string, subtitleType: 'auto' | 'manual') {
  try {
    // Get the video page
    const youtubeBaseUrl = getYouTubeProxyUrl();
    const videoUrl = `${youtubeBaseUrl}/watch?v=${videoId}`;
    console.log('Fetching video page:', videoUrl);
    
    const response = await fetchWithProxies(videoUrl);
    const html = await response.text();
    
    // Extract subtitle data
    const subtitleData = await extractSubtitleData(html, subtitleType);
    if (!subtitleData) {
      throw new Error('无法获取字幕数据');
    }
    
    return { 
      success: true, 
      subtitles: subtitleData 
    };
  } catch (error) {
    console.error('获取字幕失败:', error);
    
    // 尝试使用备用方法获取字幕
    try {
      console.log('尝试使用备用方法获取字幕...');
      const subtitleData = await getSubtitlesFromAlternativeSource(videoId, subtitleType);
      if (subtitleData) {
        return { 
          success: true, 
          subtitles: subtitleData 
        };
      }
    } catch (altError) {
      console.error('备用方法获取字幕失败:', altError);
    }
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    };
  }
}

/**
 * Extracts subtitle data from a YouTube page HTML
 * 
 * @param html - The HTML of the YouTube page
 * @param subtitleType - The subtitle type ('auto' or 'manual')
 * @returns A promise that resolves to the subtitle data
 */
async function extractSubtitleData(html: string, subtitleType: 'auto' | 'manual'): Promise<string | null> {
  try {
    // Try to extract subtitle info from different data sources
    let ytInitialData = null;
    const dataMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    
    if (dataMatch) {
      try {
        ytInitialData = JSON.parse(dataMatch[1]);
        console.log('Successfully parsed video config');
      } catch (e) {
        console.error('解析 ytInitialPlayerResponse 失败:', e);
      }
    }
    
    if (!ytInitialData || !ytInitialData.captions) {
      throw new Error('找不到字幕信息');
    }
    
    const captions = ytInitialData.captions.playerCaptionsTracklistRenderer;
    if (!captions || !captions.captionTracks || captions.captionTracks.length === 0) {
      throw new Error('该视频没有可用的字幕');
    }
    
    console.log('找到字幕轨道:', captions.captionTracks.length);
    
    // 记录所有可用的字幕轨道，以便调试
    captions.captionTracks.forEach((track: any, index: number) => {
      console.log(`Track ${index}:`, {
        languageCode: track.languageCode,
        kind: track.kind,
        name: track.name?.simpleText || 'Unknown',
        isAuto: track.kind === 'asr'
      });
    });
    
    // Find matching subtitle track
    const subtitleTrack = captions.captionTracks.find((track: any) => {
      const isAuto = track.kind === 'asr';
      const isEnglish = track.languageCode === 'en';
      return subtitleType === 'auto' ? (isAuto && isEnglish) : (!isAuto && isEnglish);
    });
    
    if (!subtitleTrack) {
      // 如果找不到英文字幕，尝试使用任何可用的字幕
      console.log('找不到所选类型的英文字幕，尝试使用任何可用的字幕');
      const anyTrack = captions.captionTracks[0]; // 使用第一个可用的字幕轨道
      if (!anyTrack) {
        throw new Error('找不到所选类型的英文字幕，且没有其他可用字幕');
      }
      console.log('使用替代字幕轨道:', {
        languageCode: anyTrack.languageCode,
        kind: anyTrack.kind,
        name: anyTrack.name?.simpleText || 'Unknown'
      });
      
      // Process subtitle URL
      let subtitleUrl = anyTrack.baseUrl;
      // 确保URL是完整的
      if (subtitleUrl.startsWith('api/') || subtitleUrl.startsWith('/api/')) {
        subtitleUrl = `https://www.youtube.com/${subtitleUrl.startsWith('/') ? subtitleUrl.slice(1) : subtitleUrl}`;
      }
      
      // 替换为代理URL（如果需要）
      const youtubeBaseUrl = getYouTubeProxyUrl();
      if (youtubeBaseUrl !== 'https://www.youtube.com') {
        subtitleUrl = subtitleUrl.replace('https://www.youtube.com', youtubeBaseUrl);
      }
      
      console.log('获取字幕URL:', subtitleUrl);
      
      const subtitleResponse = await fetchWithProxies(subtitleUrl);
      return await subtitleResponse.text();
    }
    
    // Process subtitle URL for the found track
    let subtitleUrl = subtitleTrack.baseUrl;
    // 确保URL是完整的
    if (subtitleUrl.startsWith('api/') || subtitleUrl.startsWith('/api/')) {
      subtitleUrl = `https://www.youtube.com/${subtitleUrl.startsWith('/') ? subtitleUrl.slice(1) : subtitleUrl}`;
    }
    
    // 替换为代理URL（如果需要）
    const youtubeBaseUrl = getYouTubeProxyUrl();
    if (youtubeBaseUrl !== 'https://www.youtube.com') {
      subtitleUrl = subtitleUrl.replace('https://www.youtube.com', youtubeBaseUrl);
    }
    
    console.log('获取字幕URL:', subtitleUrl);
    
    const subtitleResponse = await fetchWithProxies(subtitleUrl);
    return await subtitleResponse.text();
  } catch (error) {
    console.error('提取字幕数据失败:', error);
    throw error;
  }
}

// 备用方法：使用YouTube API获取字幕
async function getSubtitlesFromAlternativeSource(videoId: string, subtitleType: 'auto' | 'manual'): Promise<string | null> {
  try {
    // 使用YouTube API获取字幕列表
    const youtubeBaseUrl = getYouTubeProxyUrl();
    const apiUrl = `${youtubeBaseUrl}/api/timedtext?v=${videoId}&type=${subtitleType === 'auto' ? 'asr' : 'track'}&lang=en&fmt=srv1`;
    
    console.log('尝试使用备用API获取字幕:', apiUrl);
    
    const response = await fetchWithProxies(apiUrl);
    const data = await response.text();
    
    if (data) {
      // 检查是否已经是XML格式
      if (data.includes('<?xml')) {
        return data;
      } else {
        // 尝试转换为XML格式
        return convertToTranscriptXml(data);
      }
    }
    
    return null;
  } catch (error) {
    console.error('备用方法获取字幕失败:', error);
    return null;
  }
}

// 将YouTube API返回的数据转换为我们需要的XML格式
function convertToTranscriptXml(data: any): string {
  try {
    // 如果数据已经是XML格式，直接返回
    if (typeof data === 'string' && data.includes('<?xml')) {
      return data;
    }
    
    // 创建一个简单的XML结构
    let xml = '<?xml version="1.0" encoding="utf-8" ?><transcript>\n';
    
    // 如果数据是JSON格式，尝试解析
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        // 如果解析失败，保持原样
      }
    }
    
    // 处理不同格式的数据
    if (data && data.events) {
      // 处理YouTube API返回的JSON格式
      for (const event of data.events) {
        if (event.segs && event.tStartMs !== undefined) {
          const start = event.tStartMs / 1000;
          const dur = (event.dDurationMs || 1000) / 1000;
          const text = event.segs.map((seg: any) => seg.utf8).join('');
          if (text.trim()) {
            xml += `  <text start="${start}" dur="${dur}">${text}</text>\n`;
          }
        }
      }
    } else if (Array.isArray(data)) {
      // 处理数组格式
      for (const item of data) {
        if (item.start !== undefined && item.text) {
          xml += `  <text start="${item.start}" dur="${item.dur || 1}">${item.text}</text>\n`;
        }
      }
    } else {
      // 如果无法识别格式，返回一个简单的示例
      xml += '  <text start="0" dur="1">无法解析字幕数据</text>\n';
    }
    
    xml += '</transcript>';
    return xml;
  } catch (error) {
    console.error('转换字幕格式失败:', error);
    // 返回一个简单的示例
    return '<?xml version="1.0" encoding="utf-8" ?><transcript>\n  <text start="0" dur="1">无法解析字幕数据</text>\n</transcript>';
  }
} 