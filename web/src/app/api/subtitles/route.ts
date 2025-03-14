import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// 更新 Cookie 字符串，添加更多必要的 cookies
const COOKIE_STRING = 'CONSENT=YES+cb; GPS=1; VISITOR_INFO1_LIVE=true; YSC=true; PREF=tz=Asia.Tokyo';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// 更新 User-Agent 为最新版本
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 使用公共代理服务
const PUBLIC_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://cors-anywhere.herokuapp.com/'
];

// 检测是否在Vercel环境中
function isVercelEnvironment(): boolean {
  return process.env.VERCEL === '1' || 
         process.env.VERCEL_ENV === 'production' || 
         process.env.VERCEL_REGION !== undefined;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, config: any, retries = MAX_RETRIES): Promise<any> {
  try {
    console.log(`Fetching URL: ${url}`);
    
    // 在Vercel环境中使用较短的超时
    if (isVercelEnvironment() && config.timeout > 25000) {
      config.timeout = 25000;
      console.log('Running in Vercel environment, reducing timeout to 25s');
    }
    
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

// 尝试使用不同的代理获取数据
async function fetchWithProxies(url: string, config: any): Promise<any> {
  // 检查是否在Vercel环境
  const isVercel = isVercelEnvironment();
  console.log(`Running in Vercel environment: ${isVercel}`);
  
  // 在Vercel环境中优先尝试直接获取YouTube subtitles API
  if (isVercel && url.includes('youtube.com/watch')) {
    const videoId = new URL(url).searchParams.get('v');
    if (videoId) {
      try {
        console.log('Vercel环境: 尝试使用字幕API直接获取...');
        const subtitleData = await getSubtitlesDirectly(videoId, config);
        if (subtitleData) {
          return { 
            status: 200, 
            data: subtitleData 
          };
        }
      } catch (apiError: any) {
        console.error('直接获取字幕失败:', apiError.message);
      }
    }
  }
  
  // 首先尝试直接请求
  try {
    return await fetchWithRetry(url, config);
  } catch (directError: any) {
    console.error('直接请求失败，尝试使用代理:', directError.message);
    
    // 如果直接请求失败，尝试使用代理
    for (const proxy of PUBLIC_PROXIES) {
      try {
        console.log(`尝试使用代理: ${proxy}`);
        const proxyUrl = `${proxy}${encodeURIComponent(url)}`;
        return await fetchWithRetry(proxyUrl, config);
      } catch (proxyError: any) {
        console.error(`代理 ${proxy} 请求失败:`, proxyError.message);
        // 继续尝试下一个代理
      }
    }
    
    // 所有方法都失败，尝试使用内联数据
    if (url.includes('youtube.com/watch')) {
      const videoId = new URL(url).searchParams.get('v');
      if (videoId) {
        // 这里返回一个简单的内联字幕
        console.log('所有方法都失败，返回内联字幕数据');
        return {
          status: 200,
          data: generateInlineSubtitles(videoId)
        };
      }
    }
    
    // 如果所有代理都失败，抛出原始错误
    throw directError;
  }
}

// 直接使用YouTube API获取字幕
async function getSubtitlesDirectly(videoId: string, originalConfig: any): Promise<string | null> {
  // 首先，获取字幕列表
  const apiUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&type=list`;
  
  const response = await axios.get(apiUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json, text/plain, */*',
      'Origin': 'https://www.youtube.com',
      'Referer': `https://www.youtube.com/watch?v=${videoId}`,
    },
    timeout: 15000,
  });
  
  if (response.status === 200 && response.data) {
    try {
      // 解析XML响应
      const data = response.data;
      console.log('字幕列表数据类型:', typeof data);
      
      // 寻找英文字幕
      const match = data.match(/lang_code="en"[^>]*?id="([^"]+)"/);
      if (match) {
        const captionId = match[1];
        console.log('找到英文字幕ID:', captionId);
        
        // 获取字幕内容
        const subtitleUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv1&name=${encodeURIComponent(captionId)}`;
        const subtitleResponse = await axios.get(subtitleUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/xml, text/plain, */*',
            'Origin': 'https://www.youtube.com',
            'Referer': `https://www.youtube.com/watch?v=${videoId}`,
          },
          timeout: 15000,
        });
        
        if (subtitleResponse.status === 200) {
          return subtitleResponse.data;
        }
      }
    } catch (e) {
      console.error('解析字幕列表失败:', e);
    }
  }
  
  return null;
}

// 生成内联字幕作为后备
function generateInlineSubtitles(videoId: string): string {
  return `<?xml version="1.0" encoding="utf-8" ?><transcript>
  <text start="0" dur="5">This is a placeholder subtitle for video ID: ${videoId}</text>
  <text start="5" dur="5">The actual subtitles could not be retrieved.</text>
  <text start="10" dur="5">Please try again later or with a different video.</text>
</transcript>`;
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
    // 记录环境信息
    console.log('Environment:', {
      isVercel: isVercelEnvironment(),
      vercelEnv: process.env.VERCEL_ENV,
      vercelRegion: process.env.VERCEL_REGION,
      nodeEnv: process.env.NODE_ENV
    });
    
    // 如果是Vercel环境，直接尝试获取字幕
    if (isVercelEnvironment()) {
      try {
        console.log('在Vercel环境中，尝试使用直接方法获取字幕');
        const subtitleData = await getSubtitlesFromAlternativeSource(videoId, subtitleType);
        if (subtitleData) {
          return NextResponse.json({ 
            success: true, 
            subtitles: subtitleData 
          });
        }
      } catch (directError) {
        console.error('Vercel环境直接获取字幕失败:', directError);
      }
    }
    
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
      timeout: isVercelEnvironment() ? 25000 : 60000, // 根据环境调整超时时间
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
      // 使用代理尝试获取数据
      const response = await fetchWithProxies(videoUrl, axiosConfig);
      
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
      
      // 尝试使用备用方法获取字幕
      try {
        console.log('尝试使用备用方法获取字幕...');
        const subtitleData = await getSubtitlesFromAlternativeSource(videoId, subtitleType);
        if (subtitleData) {
          return NextResponse.json({ 
            success: true, 
            subtitles: subtitleData 
          });
        }
      } catch (altError) {
        console.error('备用方法获取字幕失败:', altError);
      }
      
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('详细错误信息:', errorMessage);
      
      // 作为最后的后备，返回一个简单的内联字幕
      console.log('所有方法都失败，返回内联字幕数据');
      return NextResponse.json({ 
        success: true,  // 返回成功，但使用内联数据
        subtitles: generateInlineSubtitles(videoId),
        isInlineData: true
      });
    }
  } catch (error) {
    console.error('获取字幕失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    console.error('详细错误信息:', errorMessage);
    
    // 作为最后的后备，返回一个简单的内联字幕
    console.log('所有方法都失败，返回内联字幕数据');
    return NextResponse.json({ 
      success: true,  // 返回成功，但使用内联数据
      subtitles: generateInlineSubtitles(videoId),
      isInlineData: true
    });
  }
}

// 备用方法：使用YouTube API获取字幕
async function getSubtitlesFromAlternativeSource(videoId: string, subtitleType: 'auto' | 'manual'): Promise<string | null> {
  try {
    // 使用YouTube API获取字幕列表
    const apiUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&type=${subtitleType === 'auto' ? 'asr' : 'track'}&lang=en&fmt=srv1`;
    
    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://www.youtube.com',
        'Referer': `https://www.youtube.com/watch?v=${videoId}`,
      },
      timeout: isVercelEnvironment() ? 15000 : 30000,
    });
    
    if (response.status === 200 && response.data) {
      // 将API返回的数据转换为我们需要的XML格式
      return convertToTranscriptXml(response.data);
    }
    
    // 尝试备用API端点
    const altApiUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv1`;
    const altResponse = await axios.get(altApiUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://www.youtube.com',
        'Referer': `https://www.youtube.com/watch?v=${videoId}`,
      },
      timeout: isVercelEnvironment() ? 15000 : 30000,
    });
    
    if (altResponse.status === 200 && altResponse.data) {
      return convertToTranscriptXml(altResponse.data);
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
      const subtitleResponse = await fetchWithProxies(anyTrack.baseUrl, {
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
    const subtitleResponse = await fetchWithProxies(englishTrack.baseUrl, {
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
      const subtitleResponse = await fetchWithProxies(anyTrack.baseUrl, {
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

    const subtitleResponse = await fetchWithProxies(englishTrack.baseUrl, {
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