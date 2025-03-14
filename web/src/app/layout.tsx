import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'YouTube 字幕下载器',
  description: '一个简单实用的工具，可以帮助您轻松下载 YouTube 视频的字幕文件',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="bg-secondary text-white p-4">
            <div className="container mx-auto flex items-center">
              <h1 className="text-xl font-bold">YouTube 字幕下载器</h1>
            </div>
          </header>
          <main className="flex-grow container mx-auto p-4">
            {children}
          </main>
          <footer className="bg-gray-100 p-4 text-center text-gray-600 text-sm">
            <div className="container mx-auto">
              <p>© {new Date().getFullYear()} YouTube 字幕下载器 | 使用 Next.js 构建</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
} 