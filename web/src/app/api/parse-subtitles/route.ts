import { NextRequest, NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

interface SubtitleEntry {
  start: number;
  duration: number;
  text: string;
}

export async function POST(request: NextRequest) {
  try {
    const { xmlData } = await request.json();

    if (!xmlData) {
      return NextResponse.json(
        { success: false, error: '缺少字幕数据' },
        { status: 400 }
      );
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });

    const result = parser.parse(xmlData);
    
    if (!result.transcript || !Array.isArray(result.transcript.text)) {
      throw new Error('无效的字幕格式');
    }

    const subtitles: SubtitleEntry[] = result.transcript.text.map((entry: any) => ({
      start: parseFloat(entry['@_start']),
      duration: parseFloat(entry['@_dur']),
      text: entry['#text'] || ''
    }));

    // 后处理字幕数据
    const processedSubtitles = processSubtitles(subtitles);

    return NextResponse.json({
      success: true,
      subtitles: processedSubtitles
    });
  } catch (error) {
    console.error('解析字幕失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}

/**
 * 处理字幕数据，清理和优化字幕文本
 */
function processSubtitles(subtitles: SubtitleEntry[]): SubtitleEntry[] {
  return subtitles
    .filter(subtitle => subtitle.text.trim() !== '') // 移除空字幕
    .map(subtitle => ({
      ...subtitle,
      text: cleanSubtitleText(subtitle.text)
    }))
    .sort((a, b) => a.start - b.start); // 按时间排序
}

/**
 * 清理字幕文本
 */
function cleanSubtitleText(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ') // 合并多个空格
    .replace(/\\n/g, ' ') // 替换换行符为空格
    .trim();
} 