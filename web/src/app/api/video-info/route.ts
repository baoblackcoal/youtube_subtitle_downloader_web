import { NextRequest, NextResponse } from 'next/server';

// 更新 Cookie 字符串
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

  if (!videoId) {
    return NextResponse.json(
      { success: false, error: '缺少视频ID' },
      { status: 400 }
    );
  }

  // 删除模拟数据
  if (videoId === 'oc6RV5c1yd0') {
    console.log('不再使用模拟数据，尝试获取真实视频信息');
  }

  try {
    // 使用新的获取视频信息方法
    const result = await getVideoInfo(videoId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('获取视频信息失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json({
      success: false,
      title: `Video_${videoId}`,
      videoId,
      error: errorMessage,
      source: 'error'
    }, { status: 500 });
  }
}

/**
 * Gets information about a YouTube video
 * 
 * @param videoId - The YouTube video ID
 * @returns A promise that resolves to the video info
 */
async function getVideoInfo(videoId: string) {
  try {
    const youtubeBaseUrl = getYouTubeProxyUrl();
    const videoUrl = `${youtubeBaseUrl}/watch?v=${videoId}`;
    console.log('Fetching video info:', videoUrl);
    
    const response = await fetchWithProxies(videoUrl);
    const html = await response.text();
    
    let title = '';
    let source = 'html_parsing';

    // 1. 尝试从 JSON 数据中提取标题
    const jsonMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (jsonMatch) {
      try {
        const config = JSON.parse(jsonMatch[1]);
        title = config.videoDetails?.title;
        console.log('Found title from JSON:', title);
        source = 'json_data';
      } catch (e) {
        console.error('解析 JSON 数据失败:', e);
      }
    }

    // 2. 如果上面的方法失败，尝试从 meta 标签中提取标题
    if (!title) {
      const metaTitleMatch = html.match(/<meta\s+name="title"\s+content="([^"]+)"/);
      if (metaTitleMatch) {
        title = metaTitleMatch[1];
        console.log('Found title from meta tag:', title);
        source = 'meta_tag';
      }
    }

    // 3. 如果还是没有标题，尝试从 document title 中提取
    if (!title) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      if (titleMatch) {
        title = titleMatch[1].replace(' - YouTube', '');
        console.log('Found title from document title:', title);
        source = 'document_title';
      }
    }

    // 如果所有方法都失败，使用默认标题
    if (!title) {
      title = `Video_${videoId}`;
      console.log('Using default title');
      source = 'default';
    }

    return {
      success: true,
      title,
      videoId,
      source
    };
  } catch (error) {
    console.error('获取视频信息失败:', error);
    
    // 尝试使用备用方法获取视频信息
    try {
      console.log('尝试使用备用方法获取视频信息...');
      const videoInfo = await getVideoInfoFromAlternativeSource(videoId);
      if (videoInfo && videoInfo.title) {
        return {
          success: true,
          title: videoInfo.title,
          videoId,
          source: 'oembed_api'
        };
      }
    } catch (altError) {
      console.error('备用方法获取视频信息失败:', altError);
    }
    
    // 即使出错也返回一个默认标题，这样用户体验会更好
    return {
      success: true,
      title: `Video_${videoId}`,
      videoId,
      source: 'fallback'
    };
  }
}

// 备用方法：使用YouTube API获取视频信息
async function getVideoInfoFromAlternativeSource(videoId: string): Promise<{ title: string } | null> {
  try {
    // 尝试使用YouTube oEmbed API获取视频信息
    const youtubeBaseUrl = getYouTubeProxyUrl();
    const oembedUrl = `${youtubeBaseUrl}/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    
    console.log('尝试使用oEmbed API获取视频信息:', oembedUrl);
    
    const response = await fetchWithProxies(oembedUrl);
    const data = await response.json();
    
    if (data && data.title) {
      console.log('Found title from oEmbed API:', data.title);
      return { title: data.title };
    }
    
    return null;
  } catch (error) {
    console.error('备用方法获取视频信息失败:', error);
    return null;
  }
} 