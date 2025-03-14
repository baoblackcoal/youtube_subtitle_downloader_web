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
  
  // 在Vercel环境中优先尝试使用特殊方法
  if (isVercel && url.includes('youtube.com/watch')) {
    const videoId = new URL(url).searchParams.get('v');
    if (videoId) {
      try {
        console.log('Vercel环境: 尝试使用oEmbed API直接获取...');
        const videoInfo = await getVideoInfoFromOEmbed(videoId);
        if (videoInfo && videoInfo.title) {
          return { 
            status: 200, 
            data: JSON.stringify({ title: videoInfo.title })
          };
        }
      } catch (apiError: any) {
        console.error('oEmbed API获取失败:', apiError.message);
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
    
    // 如果URL包含YouTube视频ID，返回默认标题
    if (url.includes('youtube.com/watch')) {
      const videoId = new URL(url).searchParams.get('v');
      if (videoId) {
        return {
          status: 200,
          data: JSON.stringify({ title: `Video_${videoId}` })
        };
      }
    }
    
    // 如果所有代理都失败，抛出原始错误
    throw directError;
  }
}

// 使用YouTube oEmbed API获取视频信息
async function getVideoInfoFromOEmbed(videoId: string): Promise<{ title: string } | null> {
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
      timeout: isVercelEnvironment() ? 15000 : 30000,
    });
    
    if (response.status === 200 && response.data && response.data.title) {
      console.log('Found title from oEmbed API:', response.data.title);
      return { title: response.data.title };
    }
    
    return null;
  } catch (error) {
    console.error('oEmbed API获取视频信息失败:', error);
    return null;
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
    // 记录环境信息
    console.log('Environment:', {
      isVercel: isVercelEnvironment(),
      vercelEnv: process.env.VERCEL_ENV,
      vercelRegion: process.env.VERCEL_REGION,
      nodeEnv: process.env.NODE_ENV
    });

    // 如果是Vercel环境，先尝试使用oEmbed API
    if (isVercelEnvironment()) {
      try {
        console.log('在Vercel环境中，尝试使用oEmbed API获取视频信息');
        const videoInfo = await getVideoInfoFromOEmbed(videoId);
        if (videoInfo && videoInfo.title) {
          return NextResponse.json({
            success: true,
            title: videoInfo.title,
            videoId,
            source: 'oembed_api'
          });
        }
      } catch (directError) {
        console.error('Vercel环境oEmbed API获取失败:', directError);
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
        'Expires': '0',
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
        videoId,
        source: 'html_parsing'
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
            videoId,
            source: 'alternative_api'
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
        videoId,
        source: 'fallback'
      });
    }
  } catch (error) {
    console.error('获取视频信息失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    console.error('详细错误信息:', errorMessage);
    return NextResponse.json({
      success: true, // 即使出错也返回成功，确保客户端能获取标题
      title: `Video_${videoId}`,
      videoId,
      source: 'error_fallback'
    });
  }
}

// 备用方法：使用YouTube API获取视频信息
async function getVideoInfoFromAlternativeSource(videoId: string): Promise<{ title: string } | null> {
  try {
    // 首先尝试使用YouTube Data API（如果您有API密钥）
    // 注意：这需要一个YouTube Data API密钥
    
    // 后备：使用内部JSON API
    const infoUrl = `https://www.youtube.com/get_video_info?video_id=${videoId}&html5=1`;
    
    const response = await axios.get(infoUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://www.youtube.com',
        'Referer': `https://www.youtube.com/watch?v=${videoId}`,
      },
      timeout: isVercelEnvironment() ? 15000 : 30000,
    });
    
    if (response.status === 200 && response.data) {
      const data = new URLSearchParams(response.data);
      try {
        const playerResponse = JSON.parse(data.get('player_response') || '{}');
        if (playerResponse.videoDetails && playerResponse.videoDetails.title) {
          console.log('Found title from get_video_info:', playerResponse.videoDetails.title);
          return { title: playerResponse.videoDetails.title };
        }
      } catch (e) {
        console.error('解析player_response失败:', e);
      }
    }
    
    // 最后尝试oEmbed API
    return getVideoInfoFromOEmbed(videoId);
  } catch (error) {
    console.error('备用方法获取视频信息失败:', error);
    return null;
  }
} 