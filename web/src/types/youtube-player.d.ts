declare module 'youtube-player' {
  interface PlayerVars {
    autoplay?: 0 | 1;
    cc_load_policy?: 1;
    color?: 'red' | 'white';
    controls?: 0 | 1;
    disablekb?: 0 | 1;
    enablejsapi?: 0 | 1;
    end?: number;
    fs?: 0 | 1;
    h1?: string;
    iv_load_policy?: 1 | 3;
    list?: string;
    listType?: 'playlist' | 'search' | 'user_uploads';
    loop?: 0 | 1;
    modestbranding?: 0 | 1;
    origin?: string;
    playlist?: string;
    playsinline?: 0 | 1;
    rel?: 0 | 1;
    showinfo?: 0 | 1;
    start?: number;
    [key: string]: any;
  }

  interface Options {
    videoId?: string;
    width?: number | string;
    height?: number | string;
    playerVars?: PlayerVars;
    events?: {
      [eventName: string]: (event: any) => void;
    };
  }

  interface YouTubePlayer {
    on(eventName: string, listener: (event: any) => void): void;
    off(eventName: string, listener: (event: any) => void): void;
    loadVideoById(videoId: string, startSeconds?: number): Promise<void>;
    cueVideoById(videoId: string, startSeconds?: number): Promise<void>;
    playVideo(): Promise<void>;
    pauseVideo(): Promise<void>;
    stopVideo(): Promise<void>;
    seekTo(seconds: number, allowSeekAhead?: boolean): Promise<void>;
    mute(): Promise<void>;
    unMute(): Promise<void>;
    isMuted(): Promise<boolean>;
    setVolume(volume: number): Promise<void>;
    getVolume(): Promise<number>;
    getVideoLoadedFraction(): Promise<number>;
    getPlayerState(): Promise<number>;
    getCurrentTime(): Promise<number>;
    getDuration(): Promise<number>;
    getVideoUrl(): Promise<string>;
    getVideoEmbedCode(): Promise<string>;
    destroy(): void;
  }

  function YouTubePlayerFactory(
    elementId: string | HTMLElement,
    options?: Options
  ): YouTubePlayer;

  export default YouTubePlayerFactory;
} 