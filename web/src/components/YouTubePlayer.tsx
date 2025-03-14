'use client';

import { useEffect, useRef, useState } from 'react';

export interface YouTubePlayerProps {
  videoId: string;
  width?: number | string;
  height?: number | string;
  playerVars?: {
    autoplay?: 0 | 1;
    controls?: 0 | 1;
    disablekb?: 0 | 1;
    enablejsapi?: 0 | 1;
    fs?: 0 | 1;
    iv_load_policy?: 1 | 3;
    modestbranding?: 0 | 1;
    playsinline?: 0 | 1;
    rel?: 0 | 1;
    showinfo?: 0 | 1;
    start?: number;
    end?: number;
    [key: string]: any;
  };
  onReady?: (player: any) => void;
  onStateChange?: (event: any) => void;
  onError?: (event: any) => void;
}

// 提取 YouTube 视频 ID
const extractVideoId = (videoIdOrUrl: string): string => {
  if (!videoIdOrUrl) return '';
  
  console.log('提取视频 ID，输入:', videoIdOrUrl);
  
  // 如果是完整的 YouTube URL
  if (videoIdOrUrl.includes('youtube.com/watch')) {
    // 使用 URL 对象解析 URL
    try {
      const url = new URL(videoIdOrUrl);
      const videoId = url.searchParams.get('v');
      console.log('从 youtube.com/watch 提取到视频 ID:', videoId);
      if (videoId) return videoId;
    } catch (e) {
      console.error('URL 解析失败:', e);
      // 如果 URL 解析失败，尝试使用正则表达式
      const match = videoIdOrUrl.match(/[?&]v=([^&]+)/);
      console.log('使用正则表达式提取视频 ID:', match ? match[1] : null);
      return match ? match[1] : videoIdOrUrl;
    }
  }
  
  // 如果是短链接
  if (videoIdOrUrl.includes('youtu.be/')) {
    try {
      const url = new URL(videoIdOrUrl);
      const pathParts = url.pathname.split('/');
      const videoId = pathParts[pathParts.length - 1];
      console.log('从 youtu.be 提取到视频 ID:', videoId);
      if (videoId) return videoId;
    } catch (e) {
      console.error('URL 解析失败:', e);
      // 如果 URL 解析失败，尝试使用正则表达式
      const match = videoIdOrUrl.match(/youtu\.be\/([^?&]+)/);
      console.log('使用正则表达式提取视频 ID:', match ? match[1] : null);
      return match ? match[1] : videoIdOrUrl;
    }
  }
  
  // 如果是嵌入链接
  if (videoIdOrUrl.includes('youtube.com/embed/')) {
    try {
      const url = new URL(videoIdOrUrl);
      const pathParts = url.pathname.split('/');
      const videoId = pathParts[pathParts.length - 1];
      console.log('从 youtube.com/embed 提取到视频 ID:', videoId);
      if (videoId) return videoId;
    } catch (e) {
      console.error('URL 解析失败:', e);
      // 如果 URL 解析失败，尝试使用正则表达式
      const match = videoIdOrUrl.match(/youtube\.com\/embed\/([^?&]+)/);
      console.log('使用正则表达式提取视频 ID:', match ? match[1] : null);
      return match ? match[1] : videoIdOrUrl;
    }
  }
  
  // 假设已经是视频 ID
  console.log('假设输入已经是视频 ID:', videoIdOrUrl);
  return videoIdOrUrl;
};

// 添加 YouTube IFrame API 脚本
const loadYouTubeIframeAPI = (): Promise<void> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    
    // 如果 YT 对象已存在，则 API 已加载
    if (window.YT && window.YT.Player) {
      console.log('YouTube IFrame API 已加载');
      resolve();
      return;
    }
    
    // 如果脚本已经加载，则不再重复加载
    if (document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      console.log('YouTube IFrame API 脚本已存在，等待加载完成');
      
      // 设置全局回调
      window.onYouTubeIframeAPIReady = () => {
        console.log('YouTube IFrame API 已加载完成 (通过全局回调)');
        resolve();
      };
      
      return;
    }
    
    // 设置全局回调
    window.onYouTubeIframeAPIReady = () => {
      console.log('YouTube IFrame API 已加载完成 (通过全局回调)');
      resolve();
    };
    
    // 添加脚本
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    
    console.log('YouTube IFrame API 脚本已添加到页面');
  });
};

// 创建一个全局变量来跟踪 API 加载状态，避免重复加载
let apiLoadPromise: Promise<void> | null = null;

export default function YouTubePlayer({
  videoId,
  width = '100%',
  height = '360',
  playerVars = {},
  onReady,
  onStateChange,
  onError
}: YouTubePlayerProps) {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [apiLoaded, setApiLoaded] = useState(false);
  // 使用 useRef 保存 playerId，确保它在组件的生命周期内保持不变
  const playerIdRef = useRef<string>(`youtube-player-${Math.random().toString(36).substr(2, 9)}`);
  const actualVideoId = extractVideoId(videoId);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const playerInitializedRef = useRef(false);

  // 加载 YouTube IFrame API
  useEffect(() => {
    let isMounted = true;
    
    const loadAPI = async () => {
      try {
        // 使用全局 Promise 避免重复加载
        if (!apiLoadPromise) {
          apiLoadPromise = loadYouTubeIframeAPI();
        }
        
        await apiLoadPromise;
        
        if (isMounted) {
          setApiLoaded(true);
        }
      } catch (error) {
        console.error('加载 YouTube IFrame API 失败:', error);
      }
    };
    
    loadAPI();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // 初始化播放器
  useEffect(() => {
    // 添加调试日志
    console.log('YouTubePlayer useEffect 开始执行', { 
      videoId, 
      actualVideoId, 
      width, 
      height, 
      apiLoaded,
      playerInitialized: playerInitializedRef.current
    });
    
    // 只有在 API 加载完成后才初始化播放器
    if (!apiLoaded) {
      console.log('YouTube IFrame API 尚未加载完成，等待中...');
      return;
    }
    
    // Only load the YouTube player if we're in the browser
    if (typeof window === 'undefined' || !containerRef.current) {
      console.log('YouTubePlayer: window 未定义或 containerRef.current 为空');
      return;
    }

    // 如果播放器已经初始化，则不再重复初始化
    if (playerInitializedRef.current && playerRef.current) {
      console.log('YouTubePlayer: 播放器已经初始化，不再重复创建');
      return;
    }

    // 设置容器 ID
    containerRef.current.id = playerIdRef.current;
    console.log('YouTubePlayer: 创建播放器容器 ID', playerIdRef.current);

    // 确保容器是空的
    if (containerRef.current.children.length > 0) {
      containerRef.current.innerHTML = '';
    }

    let player: any = null;

    const initializePlayer = () => {
      try {
        // 检查视频 ID 是否有效
        if (!actualVideoId) {
          console.error('YouTubePlayer: 无效的视频 ID');
          if (onError) {
            onError({ data: 'invalid_video_id', target: null });
          }
          return;
        }

        // 确保 YT API 已完全加载
        if (!window.YT || !window.YT.Player) {
          console.log('YouTubePlayer: YT API 尚未完全加载，等待 100ms 后重试');
          setTimeout(initializePlayer, 100);
          return;
        }

        // 检查容器是否存在
        if (!document.getElementById(playerIdRef.current)) {
          console.error('YouTubePlayer: 容器元素不存在，无法初始化播放器');
          return;
        }

        // Initialize the player
        console.log('YouTubePlayer: 开始初始化播放器', { videoId: actualVideoId, width, height, playerVars });
        
        // 使用原生 YT.Player 构造函数
        player = new window.YT.Player(playerIdRef.current, {
          videoId: actualVideoId,
          width: typeof width === 'number' ? width : '100%',
          height: typeof height === 'number' ? height : 400,
          playerVars: {
            // Default player vars
            autoplay: 0,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            ...playerVars,
          },
          events: {
            onReady: (event: any) => {
              console.log('YouTubePlayer: 播放器准备就绪');
              setIsPlayerReady(true);
              playerRef.current = event.target;
              playerInitializedRef.current = true;
              setCurrentVideoId(actualVideoId);
              if (onReady) {
                console.log('YouTubePlayer: 调用 onReady 回调');
                onReady(event.target);
              }
            },
            onStateChange: (event: any) => {
              if (onStateChange) {
                console.log('YouTubePlayer: 状态变化', event.data);
                onStateChange(event);
              }
            },
            onError: (event: any) => {
              console.error('YouTubePlayer: 播放器错误', event.data);
              if (onError) {
                onError(event);
              }
            }
          }
        });
        
        console.log('YouTubePlayer: 播放器初始化成功', player);
      } catch (error) {
        console.error('YouTubePlayer: 初始化播放器时出错', error);
        if (onError) {
          onError({ data: 'initialization_error', target: null, error });
        }
      }
    };

    // 开始初始化播放器
    initializePlayer();

    // Clean up on unmount
    return () => {
      // 在开发环境中，React 严格模式会导致组件多次挂载和卸载
      // 我们只在组件真正卸载时清理资源，而不是在每次重新渲染时
      if (process.env.NODE_ENV === 'development') {
        console.log('YouTubePlayer: 开发环境下组件卸载，暂不销毁播放器');
        return;
      }
      
      console.log('YouTubePlayer: 组件卸载，销毁播放器');
      if (playerRef.current && playerRef.current.destroy) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.error('销毁播放器时出错:', e);
        }
      }
      
      // 清空容器
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      
      playerRef.current = null;
      playerInitializedRef.current = false;
      setIsPlayerReady(false);
    };
  }, [actualVideoId, width, height, playerVars, onReady, onStateChange, onError, apiLoaded]); // 移除 playerId 依赖

  // 当视频 ID 变化时加载新视频
  useEffect(() => {
    console.log('YouTubePlayer: videoId 变化检测', { 
      videoId: actualVideoId, 
      currentVideoId, 
      isPlayerReady, 
      hasPlayer: !!playerRef.current 
    });
    
    // 只有当播放器准备好、当前视频 ID 与新视频 ID 不同时才加载新视频
    if (isPlayerReady && playerRef.current && actualVideoId && actualVideoId !== currentVideoId) {
      console.log('YouTubePlayer: 加载新视频', actualVideoId);
      
      try {
        // 使用 setTimeout 确保播放器已完全初始化
        setTimeout(() => {
          if (playerRef.current && playerRef.current.loadVideoById) {
            playerRef.current.loadVideoById(actualVideoId);
            setCurrentVideoId(actualVideoId);
          } else {
            console.error('YouTubePlayer: 播放器实例不可用或缺少 loadVideoById 方法');
            if (onError) {
              onError({ data: 'player_not_available', target: playerRef.current });
            }
          }
        }, 100);
      } catch (error) {
        console.error('YouTubePlayer: 加载新视频时出错', error);
        if (onError) {
          onError({ data: 'load_video_error', target: playerRef.current, error });
        }
      }
    }
  }, [actualVideoId, currentVideoId, isPlayerReady, onError]);

  // 在组件卸载时清理资源
  useEffect(() => {
    return () => {
      console.log('YouTubePlayer: 组件最终卸载，清理资源');
      if (playerRef.current && playerRef.current.destroy) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.error('销毁播放器时出错:', e);
        }
      }
      playerRef.current = null;
      playerInitializedRef.current = false;
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      id={playerIdRef.current}
      className="youtube-player-container" 
      style={{ width, height, position: 'relative' }}
    />
  );
}

// 为 TypeScript 添加全局声明
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
} 