import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { Cookie } from 'tough-cookie';

// 更新 Cookie 字符串
const COOKIE_STRING = 'CONSENT=YES+cb; GPS=1; VISITOR_INFO1_LIVE=true; YSC=true; PREF=tz=Asia.Tokyo';
// 更新 User-Agent 为最新版本
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, config: any, retries = MAX_RETRIES): Promise<any> {
  try {
    const response = await axios(url, config);
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
        'Cache-Control': 'max-age=0',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Sec-Ch-Ua-Full-Version': '"120.0.6099.130"',
        'DNT': '1',
      },
      timeout: 30000, // 增加超时时间到30秒
      maxRedirects: 5,
      decompress: true,
      validateStatus: function (status) {
        return status >= 200 && status < 400;
      },
      responseType: 'text' as const,
      transformResponse: [(data: string) => data],
    };

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log('Fetching video info:', videoUrl);
    const response = await fetchWithRetry(videoUrl, axiosConfig);
    
    if (response.status !== 200) {
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
      } catch (e) {
        console.error('解析 JSON 数据失败:', e);
      }
    }

    // 2. 如果上面的方法失败，尝试从 meta 标签中提取标题
    if (!title) {
      const metaTitleMatch = html.match(/<meta\s+name="title"\s+content="([^"]+)"/);
      if (metaTitleMatch) {
        title = metaTitleMatch[1];
      }
    }

    // 3. 如果还是没有标题，尝试从 document title 中提取
    if (!title) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      if (titleMatch) {
        title = titleMatch[1].replace(' - YouTube', '');
      }
    }

    // 如果所有方法都失败，使用默认标题
    if (!title) {
      title = `Video_${videoId}`;
    }

    return NextResponse.json({
      success: true,
      title,
      videoId
    });
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