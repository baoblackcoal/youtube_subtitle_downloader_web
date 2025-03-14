import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { Cookie } from 'tough-cookie';

// 更新 Cookie 字符串，添加更多必要的 cookies
const COOKIE_STRING = 'CONSENT=YES+cb; GPS=1; VISITOR_INFO1_LIVE=true; YSC=true; PREF=tz=Asia.Tokyo';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// 更新 User-Agent 为最新版本
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, config: any, retries = MAX_RETRIES): Promise<any> {
  try {
    console.log(`Fetching URL: ${url}`);
    const response = await axios(url, config);
    console.log(`Response status: ${response.status}`);
    return response;
  } catch (error: any) {
    console.error(`Request failed (${retries} retries left):`, error.message);
    if (error.response) {
      console.error('Error response:', {
        status: error.response.status,
        headers: error.response.headers,
        data: error.response.data
      });
    }
    
    if (retries > 0) {
      console.log(`Retrying... ${retries} attempts left`);
      await sleep(RETRY_DELAY);
      return fetchWithRetry(url, config, retries - 1);
    }
    throw error;
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

  try {
    // 配置 axios 请求
    const axiosConfig = {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cookie': COOKIE_STRING,
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Sec-Ch-Ua-Full-Version': '"120.0.6099.130"',
        'DNT': '1',
      },
      timeout: 60000, // 增加超时时间到60秒
      maxRedirects: 5,
      decompress: true,
      validateStatus: function (status: number) {
        return status >= 200 && status < 400;
      },
      responseType: 'text' as const,
      transformResponse: [(data: string) => data],
    };

    // 获取视频页面
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log('Fetching video page:', videoUrl);
    
    try {
      const response = await fetchWithRetry(videoUrl, axiosConfig);
      
      if (response.status !== 200) {
        console.error(`无法访问视频页面: ${response.status}`);
        throw new Error(`无法访问视频页面: ${response.status}`);
      }
      
      const html = response.data;
      
      // 提取字幕数据
      const subtitleData = await extractSubtitleData(html, subtitleType, axiosConfig);
      if (!subtitleData) {
        console.error('无法获取字幕数据');
        throw new Error('无法获取字幕数据');
      }
      
      return NextResponse.json({ 
        success: true, 
        subtitles: subtitleData 
      });
    } catch (error) {
      console.error('获取字幕失败:', error);
      
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('详细错误信息:', errorMessage);
      return NextResponse.json({ 
        success: false, 
        error: errorMessage,
        videoId,
        subtitleType,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('获取字幕失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    console.error('详细错误信息:', errorMessage);
    return NextResponse.json({ 
      success: false, 
      error: errorMessage,
      videoId,
      subtitleType,
    }, { status: 500 });
  }
}

/**
 * Extracts subtitle data from a YouTube page HTML
 * 
 * @param html - The HTML of the YouTube page
 * @param subtitleType - The subtitle type ('auto' or 'manual')
 * @param axiosConfig - The axios config for making requests
 * @returns A promise that resolves to the subtitle data
 */
async function extractSubtitleData(
  html: string, 
  subtitleType: 'auto' | 'manual',
  axiosConfig: any
): Promise<string | null> {
  try {
    // 提取 ytInitialPlayerResponse
    const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (!match) {
      // 尝试其他方式提取配置
      const altMatch = html.match(/"captions":({.+?}),"videoDetails"/);
      if (!altMatch) {
        throw new Error('无法找到视频配置信息');
      }
      return extractFromCaptionsData(altMatch[1], subtitleType, axiosConfig);
    }

    let config;
    try {
      config = JSON.parse(match[1]);
      console.log('Successfully parsed video config');
    } catch (e) {
      console.error('解析视频配置失败:', e);
      // 尝试其他方式提取配置
      const altMatch = html.match(/"captions":({.+?}),"videoDetails"/);
      if (!altMatch) {
        throw new Error('解析视频配置失败');
      }
      return extractFromCaptionsData(altMatch[1], subtitleType, axiosConfig);
    }

    if (!config.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
      console.error('No caption tracks found in config');
      throw new Error('该视频没有可用的字幕');
    }

    const captionTracks = config.captions.playerCaptionsTracklistRenderer.captionTracks;
    console.log('找到字幕轨道:', captionTracks.length);
    
    // 记录所有可用的字幕轨道，以便调试
    captionTracks.forEach((track: any, index: number) => {
      console.log(`Track ${index}:`, {
        languageCode: track.languageCode,
        kind: track.kind,
        name: track.name?.simpleText || 'Unknown',
        isAuto: track.kind === 'asr'
      });
    });
    
    // 查找英文字幕
    const englishTrack = captionTracks.find((track: any) => {
      const isAuto = track.kind === 'asr';
      const isEnglish = track.languageCode === 'en';
      return subtitleType === 'auto' ? (isAuto && isEnglish) : (!isAuto && isEnglish);
    });

    if (!englishTrack) {
      // 如果找不到英文字幕，尝试使用任何可用的字幕
      console.log('找不到所选类型的英文字幕，尝试使用任何可用的字幕');
      const anyTrack = captionTracks[0]; // 使用第一个可用的字幕轨道
      if (!anyTrack) {
        throw new Error('找不到所选类型的英文字幕，且没有其他可用字幕');
      }
      console.log('使用替代字幕轨道:', {
        languageCode: anyTrack.languageCode,
        kind: anyTrack.kind,
        name: anyTrack.name?.simpleText || 'Unknown'
      });
      
      console.log('获取字幕URL:', anyTrack.baseUrl);
      
      // 获取字幕内容
      const subtitleResponse = await fetchWithRetry(anyTrack.baseUrl, {
        ...axiosConfig,
        headers: {
          ...axiosConfig.headers,
          'Referer': 'https://www.youtube.com/',
          'Origin': 'https://www.youtube.com',
        }
      });

      if (subtitleResponse.status !== 200) {
        throw new Error(`获取字幕内容失败: ${subtitleResponse.status}`);
      }

      return subtitleResponse.data;
    }

    console.log('获取字幕URL:', englishTrack.baseUrl);

    // 获取字幕内容
    const subtitleResponse = await fetchWithRetry(englishTrack.baseUrl, {
      ...axiosConfig,
      headers: {
        ...axiosConfig.headers,
        'Referer': 'https://www.youtube.com/',
        'Origin': 'https://www.youtube.com',
      }
    });

    if (subtitleResponse.status !== 200) {
      throw new Error(`获取字幕内容失败: ${subtitleResponse.status}`);
    }

    return subtitleResponse.data;
  } catch (error) {
    console.error('提取字幕数据失败:', error);
    throw error;
  }
}

async function extractFromCaptionsData(
  captionsJson: string,
  subtitleType: 'auto' | 'manual',
  axiosConfig: any
): Promise<string | null> {
  try {
    const captions = JSON.parse(captionsJson);
    if (!captions.playerCaptionsTracklistRenderer?.captionTracks) {
      throw new Error('该视频没有可用的字幕');
    }

    const captionTracks = captions.playerCaptionsTracklistRenderer.captionTracks;
    
    // 记录所有可用的字幕轨道，以便调试
    captionTracks.forEach((track: any, index: number) => {
      console.log(`Track ${index}:`, {
        languageCode: track.languageCode,
        kind: track.kind,
        name: track.name?.simpleText || 'Unknown',
        isAuto: track.kind === 'asr'
      });
    });
    
    const englishTrack = captionTracks.find((track: any) => {
      const isAuto = track.kind === 'asr';
      const isEnglish = track.languageCode === 'en';
      return subtitleType === 'auto' ? (isAuto && isEnglish) : (!isAuto && isEnglish);
    });

    if (!englishTrack) {
      // 如果找不到英文字幕，尝试使用任何可用的字幕
      console.log('找不到所选类型的英文字幕，尝试使用任何可用的字幕');
      const anyTrack = captionTracks[0]; // 使用第一个可用的字幕轨道
      if (!anyTrack) {
        throw new Error('找不到所选类型的英文字幕，且没有其他可用字幕');
      }
      console.log('使用替代字幕轨道:', {
        languageCode: anyTrack.languageCode,
        kind: anyTrack.kind,
        name: anyTrack.name?.simpleText || 'Unknown'
      });
      
      console.log('获取字幕URL:', anyTrack.baseUrl);
      
      // 获取字幕内容
      const subtitleResponse = await fetchWithRetry(anyTrack.baseUrl, {
        ...axiosConfig,
        headers: {
          ...axiosConfig.headers,
          'Referer': 'https://www.youtube.com/',
          'Origin': 'https://www.youtube.com',
        }
      });

      if (subtitleResponse.status !== 200) {
        throw new Error(`获取字幕内容失败: ${subtitleResponse.status}`);
      }

      return subtitleResponse.data;
    }

    const subtitleResponse = await fetchWithRetry(englishTrack.baseUrl, {
      ...axiosConfig,
      headers: {
        ...axiosConfig.headers,
        'Referer': 'https://www.youtube.com/',
        'Origin': 'https://www.youtube.com',
      }
    });

    if (subtitleResponse.status !== 200) {
      throw new Error(`获取字幕内容失败: ${subtitleResponse.status}`);
    }

    return subtitleResponse.data;
  } catch (error) {
    console.error('从备用数据提取字幕失败:', error);
    throw error;
  }
} 