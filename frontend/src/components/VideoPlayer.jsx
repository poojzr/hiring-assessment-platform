import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react'

export default function VideoPlayer({ 
  src, 
  violations = [], 
  onSeek, 
  onPlay, 
  onPause,
  autoPlay = false,
  className = ''
}) {
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
    }

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      if (autoPlay) {
        video.play()
      }
    }

    const handlePlay = () => {
      setIsPlaying(true)
      if (onPlay) onPlay()
    }

    const handlePause = () => {
      setIsPlaying(false)
      if (onPause) onPause()
    }

    const handleEnded = () => {
      setIsPlaying(false)
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
    }
  }, [autoPlay, onPlay, onPause])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) {
      video.pause()
    } else {
      video.play()
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  const toggleFullscreen = () => {
    const container = containerRef.current
    if (!container) return
    if (!document.fullscreenElement) {
      container.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const handleSeek = (e) => {
    const video = videoRef.current
    if (!video) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    video.currentTime = percentage * duration
    setCurrentTime(video.currentTime)
    if (onSeek) onSeek(video.currentTime)
  }

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const getSeverityColor = (severity) => {
    const map = {
      critical: 'bg-red-500',
      high: 'bg-orange-500',
      medium: 'bg-yellow-500',
      low: 'bg-blue-500'
    }
    return map[severity] || 'bg-gray-500'
  }

  if (!src) {
    return (
      <div className={`bg-black rounded-lg flex items-center justify-center ${className}`}>
        <p className="text-white text-sm">No video source available</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`relative bg-black rounded-lg overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        src={src}
        className="w-full aspect-video"
        onClick={togglePlay}
        playsInline
      />

      {violations.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {violations.map((v, i) => {
            const leftPercent = (v.time / duration) * 100
            if (isNaN(leftPercent) || !duration) return null
            return (
              <div
                key={i}
                className={`absolute top-0 w-1 h-full ${getSeverityColor(v.severity)} pointer-events-auto cursor-pointer`}
                style={{ left: `${leftPercent}%` }}
                onClick={() => {
                  const video = videoRef.current
                  if (!video) return
                  video.currentTime = v.time
                  setCurrentTime(v.time)
                  if (onSeek) onSeek(v.time)
                  if (!isPlaying) {
                    video.play()
                  }
                }}
                title={`${v.type} - ${v.severity}`}
              />
            )
          })}
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlay}
            className="text-white hover:text-gray-300 transition-colors"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleMute}
            className="text-white hover:text-gray-300 transition-colors"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          <div className="flex-1 relative h-1 bg-gray-600 rounded cursor-pointer" onClick={handleSeek}>
            <div
              className="h-1 bg-accent-500 rounded"
              style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-accent-500 rounded-full"
              style={{ left: `${(currentTime / duration) * 100 || 0}%` }}
            />
          </div>

          <span className="text-white text-sm font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {violations.length > 0 && (
            <span className="text-white text-xs bg-red-500/80 px-2 py-0.5 rounded">
              {violations.length} violation{violations.length > 1 ? 's' : ''}
            </span>
          )}

          <button
            onClick={toggleFullscreen}
            className="text-white hover:text-gray-300 transition-colors"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  )
}