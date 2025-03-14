'use client';

import { useState, FormEvent, useEffect } from 'react';
import { FaDownload, FaPaste } from 'react-icons/fa';
import { downloadSubtitles } from '@/services/subtitleService';

interface SubtitleFormProps {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSuccess: (success: string | null) => void;
}

export default function SubtitleForm({ 
  isLoading, 
  setIsLoading, 
  setError, 
  setSuccess 
}: SubtitleFormProps) {
  const [videoUrl, setVideoUrl] = useState('https://www.youtube.com/watch?v=oc6RV5c1yd0');
  const [subtitleType, setSubtitleType] = useState<'auto' | 'manual'>('auto');
  const [format, setFormat] = useState<'vtt' | 'srt' | 'txt'>('txt');
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;
  const [isVercelEnvironment, setIsVercelEnvironment] = useState(false);

  // 记录环境信息，帮助调试
  useEffect(() => {
    // 检测Vercel环境
    const hostname = window.location.hostname;
    const isVercel = hostname.includes('vercel') || 
                     hostname.endsWith('.vercel.app') || 
                     hostname === 'youtube-subtitle-downloader-web.vercel.app';
    
    setIsVercelEnvironment(isVercel);
    
    console.log('Environment:', {
      isDevelopment: process.env.NODE_ENV === 'development',
      isProduction: process.env.NODE_ENV === 'production',
      baseUrl: window.location.origin,
      userAgent: navigator.userAgent,
      isVercelEnvironment: isVercel,
      hostname
    });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!videoUrl.trim()) {
      setError('请输入 YouTube 视频链接');
      return;
    }
    
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    
    try {
      console.log('Submitting form with:', { videoUrl, subtitleType, format });
      console.time('downloadSubtitles');
      
      const result = await downloadSubtitles(videoUrl, subtitleType, format);
      
      console.timeEnd('downloadSubtitles');
      console.log('Download result:', result);
      
      if (result && result.success) {
        if (result.isInlineData) {
          // 如果是内联数据，显示特殊消息
          setSuccess('演示字幕已下载。由于API限制，无法获取实际YouTube字幕。');
        } else {
          setSuccess('字幕下载成功！');
        }
        // 重置重试计数
        setRetryCount(0);
      } else if (result && !result.success) {
        throw new Error(result.error || '下载字幕失败');
      }
    } catch (error) {
      console.error('下载字幕失败:', error);
      
      // 提供更友好的错误信息
      let errorMessage = '下载字幕时出错';
      if (error instanceof Error) {
        if (error.message.includes('该视频没有可用的字幕') || 
            error.message.includes('找不到所选类型的英文字幕')) {
          errorMessage = `该视频没有${subtitleType === 'auto' ? '自动生成的' : ''}英文字幕，请尝试其他选项`;
        } else if (error.message.includes('无效的 YouTube 视频链接')) {
          errorMessage = '请输入有效的 YouTube 视频链接';
        } else if (error.message.includes('无法获取视频 ID')) {
          errorMessage = '无法从链接中获取视频 ID，请检查链接格式';
        } else if (error.message.includes('timeout') || error.message.includes('超时')) {
          errorMessage = '请求超时，请稍后再试';
          
          // 如果是超时错误，尝试自动重试
          if (retryCount < maxRetries) {
            setRetryCount(prev => prev + 1);
            setError(`请求超时，正在自动重试 (${retryCount + 1}/${maxRetries})...`);
            
            // 延迟2秒后重试
            setTimeout(() => {
              handleSubmit(e);
            }, 2000);
            
            return;
          }
        } else if (error.message.includes('network') || error.message.includes('网络')) {
          errorMessage = '网络错误，请检查您的网络连接';
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
      // 重置重试计数
      setRetryCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setVideoUrl(text);
    } catch (error) {
      setError('无法访问剪贴板');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isVercelEnvironment && (
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4 rounded" role="alert">
          <p className="font-bold">提示</p>
          <p>
            在Vercel环境中，由于API限制，可能无法获取真实的字幕数据。在这种情况下，系统会下载演示字幕以展示功能。
            如需获取真实字幕，请<a href="https://github.com/jackhanyuan/ytbs" className="underline" target="_blank" rel="noopener noreferrer">下载代码</a>并在本地运行。
          </p>
        </div>
      )}
      
      <div className="space-y-2">
        <label htmlFor="videoUrl" className="block font-medium">
          YouTube 视频链接
        </label>
        <div className="flex">
          <input
            id="videoUrl"
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="input-field flex-grow"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={handlePaste}
            className="ml-2 bg-gray-200 p-2 rounded hover:bg-gray-300"
            disabled={isLoading}
            title="粘贴"
          >
            <FaPaste />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <p className="font-medium">选择字幕</p>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="subtitleType"
                value="auto"
                checked={subtitleType === 'auto'}
                onChange={() => setSubtitleType('auto')}
                disabled={isLoading}
                className="h-4 w-4 text-primary"
              />
              <span>英文（自动生成）</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="subtitleType"
                value="manual"
                checked={subtitleType === 'manual'}
                onChange={() => setSubtitleType('manual')}
                disabled={isLoading}
                className="h-4 w-4 text-primary"
              />
              <span>英文</span>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <p className="font-medium">选择格式</p>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="format"
                value="vtt"
                checked={format === 'vtt'}
                onChange={() => setFormat('vtt')}
                disabled={isLoading}
                className="h-4 w-4 text-primary"
              />
              <span>VTT</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="format"
                value="srt"
                checked={format === 'srt'}
                onChange={() => setFormat('srt')}
                disabled={isLoading}
                className="h-4 w-4 text-primary"
              />
              <span>SRT</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="format"
                value="txt"
                checked={format === 'txt'}
                onChange={() => setFormat('txt')}
                disabled={isLoading}
                className="h-4 w-4 text-primary"
              />
              <span>TXT</span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          type="submit"
          className="btn-primary flex items-center justify-center space-x-2 w-full md:w-auto"
          disabled={isLoading}
        >
          {isLoading ? (
            <span>处理中{retryCount > 0 ? ` (重试 ${retryCount}/${maxRetries})` : '...'}</span>
          ) : (
            <>
              <FaDownload />
              <span>下载字幕</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
} 