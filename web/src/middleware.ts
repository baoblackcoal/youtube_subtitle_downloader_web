import { NextRequest, NextResponse } from 'next/server';

export const config = {
  // 匹配所有API路径和代理路径
  matcher: ['/api/:path*', '/youtube-proxy/:path*'],
};

export default function middleware(request: NextRequest) {
  // 获取URL路径
  const url = request.nextUrl.clone();
  const { pathname } = url;

  // 日志记录用于调试
  console.log(`[Middleware] Request path: ${pathname}, Search: ${url.search}`);

  // 处理YouTube代理请求
  if (pathname.startsWith('/youtube-proxy/')) {
    // 提取YouTube的实际路径
    const path = pathname.replace('/youtube-proxy', '');
    const youtubeUrl = `https://www.youtube.com${path}${url.search}`;
    
    console.log(`[Middleware] Proxying request to: ${youtubeUrl}`);
    
    // 创建新的请求头，添加必要的YouTube请求头
    const headers = new Headers(request.headers);
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7');
    headers.set('Accept-Language', 'en-US,en;q=0.9');
    headers.set('Accept-Encoding', 'gzip, deflate, br');
    headers.set('Connection', 'keep-alive');
    headers.set('Referer', 'https://www.youtube.com/');
    headers.set('Origin', 'https://www.youtube.com');
    
    // 确保URL是正确的格式
    const newUrl = new URL(youtubeUrl);
    const response = NextResponse.rewrite(newUrl, {
      headers: headers,
    });
    
    // 添加CORS头部
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return response;
  }

  // 处理API请求
  if (pathname.startsWith('/api/')) {
    console.log(`[Middleware] API request: ${pathname}`);
    
    // 设置CORS头部
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return response;
  }

  // 其他请求直接通过
  return NextResponse.next();
} 