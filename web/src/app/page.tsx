'use client';

import { useState } from 'react';
import SubtitleForm from '@/components/SubtitleForm';
import FeatureList from '@/components/FeatureList';
import YouTubeDemo from '@/components/YouTubeDemo';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-2xl font-bold mb-6 text-center">下载 YouTube 字幕</h2>
        
        <SubtitleForm 
          setError={setError}
          setSuccess={setSuccess}
        />
        
        {error && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mt-4 p-3 bg-green-100 text-green-700 rounded">
            {success}
          </div>
        )}
      </div>
      
      <YouTubeDemo />
      
      <FeatureList />
    </div>
  );
} 