'use client';

import React, { useState, useEffect } from 'react';
import YouTubePlayer from './YouTubePlayer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function YouTubeDemo() {
  const [videoId, setVideoId] = useState('M7lc1UVf-VE'); // Default Google API example video
  const [inputVideoId, setInputVideoId] = useState('');
  const [playerState, setPlayerState] = useState<string>('未开始');
  const [playerRef, setPlayerRef] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // 添加调试日志
  useEffect(() => {
    console.log('YouTubeDemo 组件已加载');
    
    // 检查 youtube-player 模块是否可用
    try {
      console.log('检查 YT API 是否可用:', !!window.YT);
    } catch (error) {
      console.error('检查 YT API 时出错', error);
      setError('加载 YouTube 播放器模块失败，请刷新页面重试');
    }
    
    return () => {
      console.log('YouTubeDemo 组件已卸载');
    };
  }, []);

  const handleStateChange = (event: any) => {
    console.log('状态变化事件', event);
    const stateMap: Record<number, string> = {
      '-1': '未开始',
      '0': '已结束',
      '1': '正在播放',
      '2': '已暂停',
      '3': '正在缓冲',
      '5': '已插入视频'
    };
    
    const newState = stateMap[event.data] || '未知状态';
    setPlayerState(newState);
    
    // 如果状态是"正在缓冲"，设置 loading 为 true
    if (event.data === 3) {
      setLoading(true);
    } else {
      setLoading(false);
    }
    
    // 如果状态是"已结束"，清除错误
    if (event.data === 0) {
      setError(null);
    }
  };

  const handleReady = (player: any) => {
    console.log('播放器准备就绪', player);
    setPlayerRef(player);
    setError(null);
    setLoading(false);
  };

  const handleError = (event: any) => {
    console.error('播放器错误', event);
    setLoading(false);
    
    // 根据错误类型设置不同的错误消息
    if (event.data === 'invalid_video_id') {
      setError('无效的视频 ID，请检查输入的 URL 或 ID 是否正确');
    } else if (event.data === 'initialization_error') {
      setError('初始化播放器失败，请刷新页面重试');
    } else if (event.data === 'load_video_error') {
      setError('加载视频失败，请检查视频 ID 是否正确');
    } else if (event.data === 'player_not_available') {
      setError('播放器不可用，请刷新页面重试');
    } else if (event.data === 2) {
      setError('无效的视频 ID 或参数');
    } else if (event.data === 5) {
      setError('HTML5 播放器错误');
    } else if (event.data === 100) {
      setError('找不到视频或已被删除');
    } else if (event.data === 101 || event.data === 150) {
      setError('视频所有者不允许在嵌入播放器中播放');
    } else {
      setError('播放视频时出错，请尝试其他视频');
    }
  };

  const handleLoadVideo = () => {
    if (!inputVideoId.trim()) {
      setError('请输入 YouTube 视频 ID 或 URL');
      return;
    }
    
    console.log('加载视频', inputVideoId);
    setError(null);
    setLoading(true);
    
    // 使用新的视频 ID 更新状态
    setVideoId(inputVideoId.trim());
  };

  const handlePlayVideo = () => {
    console.log('播放视频', playerRef);
    if (playerRef) {
      setError(null);
      try {
        playerRef.playVideo();
      } catch (error) {
        console.error('播放视频时出错', error);
        setError('播放视频时出错，请刷新页面重试');
      }
    } else {
      setError('播放器尚未准备好，请等待或刷新页面');
    }
  };

  const handlePauseVideo = () => {
    console.log('暂停视频', playerRef);
    if (playerRef) {
      try {
        playerRef.pauseVideo();
      } catch (error) {
        console.error('暂停视频时出错', error);
        setError('暂停视频时出错，请刷新页面重试');
      }
    } else {
      setError('播放器尚未准备好，请等待或刷新页面');
    }
  };

  const handleStopVideo = () => {
    console.log('停止视频', playerRef);
    if (playerRef) {
      try {
        playerRef.stopVideo();
      } catch (error) {
        console.error('停止视频时出错', error);
        setError('停止视频时出错，请刷新页面重试');
      }
    } else {
      setError('播放器尚未准备好，请等待或刷新页面');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLoadVideo();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <h2 className="text-2xl font-bold mb-4 text-center">YouTube 视频播放器</h2>
      
      <div className="mb-6 relative" style={{ minHeight: '400px' }}>
        <YouTubePlayer 
          videoId={videoId}
          width="100%"
          height={400}
          onStateChange={handleStateChange}
          onReady={handleReady}
          onError={handleError}
          playerVars={{
            autoplay: 0,
            controls: 1,
            modestbranding: 1,
            rel: 0,
          }}
        />
        
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
            <div className="text-white">加载中...</div>
          </div>
        )}
      </div>
      
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">当前状态: {playerState}</p>
        
        {error && (
          <div className="mt-2 p-2 bg-red-100 text-red-700 rounded text-sm">
            错误: {error}
          </div>
        )}
      </div>
      
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="flex-grow">
          <Input
            type="text"
            placeholder="输入 YouTube 视频 ID 或 URL"
            value={inputVideoId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputVideoId(e.target.value)}
            onKeyPress={handleKeyPress}
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-1">
            例如: https://www.youtube.com/watch?v=M7lc1UVf-VE 或 M7lc1UVf-VE
          </p>
        </div>
        <Button onClick={handleLoadVideo} disabled={loading}>加载视频</Button>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <Button onClick={handlePlayVideo} variant="outline" disabled={!playerRef || loading}>播放</Button>
        <Button onClick={handlePauseVideo} variant="outline" disabled={!playerRef || loading}>暂停</Button>
        <Button onClick={handleStopVideo} variant="outline" disabled={!playerRef || loading}>停止</Button>
      </div>
    </div>
  );
} 