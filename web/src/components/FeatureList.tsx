'use client';

import { FaCheck } from 'react-icons/fa';

export default function FeatureList() {
  const features = [
    '支持下载 YouTube 自动生成的英文字幕和手动添加的英文字幕',
    '提供多种字幕格式选择（VTT, SRT 和 TXT）',
    '支持一键粘贴视频链接',
    '简洁易用的界面设计',
    '完全免费，无需安装任何软件',
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6">功能特点</h2>
      
      <ul className="space-y-3">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <span className="text-green-500 mr-2 mt-1">
              <FaCheck />
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      
      <div className="mt-8 p-4 bg-gray-100 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">使用说明</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>在输入框中粘贴 YouTube 视频链接</li>
          <li>选择字幕类型（自动生成或手动添加的英文字幕）</li>
          <li>选择输出格式（VTT、SRT 或 TXT）</li>
          <li>点击"下载字幕"按钮</li>
          <li>字幕文件将自动下载到您的计算机</li>
        </ol>
      </div>
    </div>
  );
} 