import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

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

// 尝试使用不同的代理获取数据
async function fetchWithProxies(url: string, config: any): Promise<any> {
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
        'Expires': '0',
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

    try {
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      console.log('Fetching video info:', videoUrl);
      
      // 使用代理尝试获取数据
      const response = await fetchWithProxies(videoUrl, axiosConfig);
      
      if (response.status !== 200) {
        console.error(`无法访问视频页面: ${response.status}`);
        throw new Error(`无法访问视频页面: ${response.status}`);
      }

      const html = response.data;
      let title = '';

      // 1. 尝试从 JSON 数据中提取标题
      const jsonMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
      if (jsonMatch) {
        try {
          const config = JSON.parse(jsonMatch[1]);
          title = config.videoDetails?.title;
          console.log('Found title from JSON:', title);
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
        }
      }

      // 3. 如果还是没有标题，尝试从 document title 中提取
      if (!title) {
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) {
          title = titleMatch[1].replace(' - YouTube', '');
          console.log('Found title from document title:', title);
        }
      }

      // 如果所有方法都失败，使用默认标题
      if (!title) {
        title = `Video_${videoId}`;
        console.log('Using default title');
      }

      return NextResponse.json({
        success: true,
        title,
        videoId
      });
    } catch (error) {
      console.error('获取视频信息失败:', error);
      
      // 尝试使用备用方法获取视频信息
      try {
        console.log('尝试使用备用方法获取视频信息...');
        const videoInfo = await getVideoInfoFromAlternativeSource(videoId);
        if (videoInfo && videoInfo.title) {
          return NextResponse.json({
            success: true,
            title: videoInfo.title,
            videoId
          });
        }
      } catch (altError) {
        console.error('备用方法获取视频信息失败:', altError);
      }
      
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('详细错误信息:', errorMessage);
      
      // 即使出错也返回一个默认标题，这样用户体验会更好
      return NextResponse.json({
        success: true,
        title: `Video_${videoId}`,
        videoId
      });
    }
  } catch (error) {
    console.error('获取视频信息失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    console.error('详细错误信息:', errorMessage);
    return NextResponse.json({
      success: false,
      title: `Video_${videoId}`,
      videoId,
      error: errorMessage
    }, { status: 500 });
  }
}

// 备用方法：使用YouTube API获取视频信息
async function getVideoInfoFromAlternativeSource(videoId: string): Promise<{ title: string } | null> {
  try {
    // 尝试使用YouTube oEmbed API获取视频信息
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    
    const response = await axios.get(oembedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Origin': 'https://www.youtube.com',
        'Referer': `https://www.youtube.com/watch?v=${videoId}`,
      },
      timeout: 30000,
    });
    
    if (response.status === 200 && response.data && response.data.title) {
      console.log('Found title from oEmbed API:', response.data.title);
      return { title: response.data.title };
    }
    
    return null;
  } catch (error) {
    console.error('备用方法获取视频信息失败:', error);
    return null;
  }
} 