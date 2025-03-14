/**
 * Validates if a given URL is a valid YouTube video URL
 * 
 * @param url - The URL to validate
 * @returns Whether the URL is a valid YouTube video URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname.match(/^(www\.)?(youtube\.com|youtu\.be)$/)) {
      return false;
    }
    
    const videoId = extractVideoId(url);
    
    // Validate video ID format (11 characters: letters, numbers, underscores, or hyphens)
    return videoId !== null && /^[a-zA-Z0-9_-]{11}$/.test(videoId);
  } catch (e) {
    return false;
  }
}

/**
 * Extracts the video ID from a YouTube URL
 * 
 * @param url - The YouTube URL
 * @returns The video ID or null if not found
 */
export function extractVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    
    // Handle youtu.be short links
    if (urlObj.hostname.includes('youtu.be')) {
      return urlObj.pathname.split('/')[1];
    } 
    // Handle youtube.com links
    else if (urlObj.hostname.includes('youtube.com')) {
      // Handle live video format
      if (urlObj.pathname.includes('/live/')) {
        const pathParts = urlObj.pathname.split('/live/');
        return pathParts[1]?.split('?')[0] || null;
      } 
      // Handle standard video format
      else {
        const params = new URLSearchParams(urlObj.search);
        return params.get('v');
      }
    }
    return null;
  } catch (e) {
    return null;
  }
} 