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
  console.log(`[Middleware] Request path: ${pathname}`);

  // 处理YouTube代理请求
  if (pathname.startsWith('/youtube-proxy/')) {
    // 提取YouTube的实际路径
    const path = pathname.replace('/youtube-proxy', '');
    const youtubeUrl = `https://www.youtube.com${path}${url.search}`;
    
    console.log(`[Middleware] Proxying request to: ${youtubeUrl}`);
    
    // 返回一个重定向响应，让客户端请求YouTube
    // 注意：这种方法并不能绕过CORS，仅用于开发调试
    // 在实际产品中，应该使用服务器端代理
    return NextResponse.rewrite(new URL(youtubeUrl));
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