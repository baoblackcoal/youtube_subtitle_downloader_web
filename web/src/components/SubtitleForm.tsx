'use client';

import { useState, FormEvent } from 'react';
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
      await downloadSubtitles(videoUrl, subtitleType, format);
      setSuccess('字幕下载成功！');
    } catch (error) {
      setError(error instanceof Error ? error.message : '下载字幕时出错');
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
            <span>处理中...</span>
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