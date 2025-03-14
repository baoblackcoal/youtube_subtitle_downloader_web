'use client';

import { useState, FormEvent, useEffect } from 'react';
import { FaDownload, FaPaste } from 'react-icons/fa';
import { YouTubeApiService } from '../services/youtubeApiService';
import { downloadSubtitles } from '@/services/subtitleService';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { SubtitleOption } from './subtitleOption';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download } from 'lucide-react';

interface SubtitleFormProps {
  setError: (error: string | null) => void;
  setSuccess: (success: string | null) => void;
}

export interface SubtitleResponse {
  url?: string;
  content?: string;
  fileName?: string;
  error?: string;
}

export default function SubtitleForm({ 
  setError,
  setSuccess
}: SubtitleFormProps) {
  const [videoUrl, setVideoUrl] = useState('');
  const [subtitleType, setSubtitleType] = useState<'auto' | 'manual'>('auto');
  const [format, setFormat] = useState<'vtt' | 'srt' | 'txt'>('srt');
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;
  const [debugInfo, setDebugInfo] = useState('');
  const [showDebug, setShowDebug] = useState(false);

  // 记录环境信息，帮助调试
  useEffect(() => {
    console.log('环境信息:', {
      userAgent: navigator.userAgent,
      isSecureContext: window.isSecureContext,
      protocol: window.location.protocol,
      host: window.location.host
    });
  }, []);

  const addDebugInfo = (message: string) => {
    console.log('[Debug]', message);
    setDebugInfo(prev => `${prev}\n${new Date().toISOString()}: ${message}`);
  };

  const logError = (error: any) => {
    console.error('[SubtitleForm Error]', error);
    if (error instanceof Error) {
      setError(error.message);
      addDebugInfo(`错误: ${error.message}\n${error.stack || ''}`);
    } else if (typeof error === 'string') {
      setError(error);
      addDebugInfo(`错误字符串: ${error}`);
    } else if (error && typeof error === 'object') {
      const errorMsg = error.message || JSON.stringify(error);
      setError(errorMsg);
      addDebugInfo(`错误对象: ${JSON.stringify(error, null, 2)}`);
    } else {
      setError('下载字幕时出现未知错误');
      addDebugInfo(`未知错误类型: ${error}`);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setRetryCount(0);
    setDebugInfo('');

    try {
      // 检查是否输入了视频URL
      if (!videoUrl.trim()) {
        throw new Error('请输入YouTube视频链接');
      }

      addDebugInfo(`开始处理视频: ${videoUrl}, 字幕类型: ${subtitleType}, 格式: ${format}`);

      // 使用原有的下载功能
      console.log('Submitting form with:', { videoUrl, subtitleType, format });
      console.time('downloadSubtitles');
       
      const result = await downloadSubtitles(videoUrl, subtitleType, format);
       
      console.timeEnd('downloadSubtitles');
      console.log('Download result:', result);
      addDebugInfo(`下载结果: ${JSON.stringify(result, null, 2)}`);
        
      if (result && result.success) {
        setSuccess('字幕下载成功！');
        // 重置重试计数
        setRetryCount(0);
        addDebugInfo('下载成功');
      } else if (result && !result.success) {
        throw new Error(result.error || '下载字幕失败');
      }
    } catch (error: any) {
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
      addDebugInfo(`最终错误信息: ${errorMessage}`);
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
    } catch (err) {
      console.error('无法访问剪贴板:', err);
    }
  };

  const toggleDebug = () => {
    setShowDebug(!showDebug);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      <div className="text-right">
        <button
          type="button"
          onClick={toggleDebug}
          className="text-xs text-gray-500 underline"
        >
          {showDebug ? '隐藏调试信息' : '显示调试信息'}
        </button>
      </div>

      {showDebug && debugInfo && (
        <div className="bg-gray-100 border border-gray-200 text-gray-800 rounded p-3 text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[300px]">
          <p className="font-semibold">调试信息:</p>
          {debugInfo}
        </div>
      )}
    </form>
  );
} 