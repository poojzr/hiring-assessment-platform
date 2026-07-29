export function generateThumbnail(videoBlob, timeInSeconds = 1) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video')
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        video.onloadedmetadata = () => {
            canvas.width = 320
            canvas.height = 180
            video.currentTime = Math.min(timeInSeconds, video.duration || 1)
        }

        video.onseeked = () => {
            try {
                ctx.drawImage(video, 0, 0, 320, 180)
                resolve(canvas.toDataURL('image/jpeg', 0.8))
            } catch (error) {
                reject(error)
            }
        }

        video.onerror = () => {
            reject(new Error('Failed to load video'))
        }

        video.src = URL.createObjectURL(videoBlob)
        video.load()
    })
}

export function getVideoDuration(videoBlob) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video')
        video.preload = 'metadata'
        const objectUrl = URL.createObjectURL(videoBlob)

        const cleanup = () => {
            video.removeAttribute('src')
            video.load()
            URL.revokeObjectURL(objectUrl)
        }

        const resolveSafe = (value) => {
            const safeValue = (typeof value === 'number' && isFinite(value) && value >= 0) ? value : 0
            cleanup()
            resolve(safeValue)
        }

        video.onloadedmetadata = () => {
            if (isFinite(video.duration)) {
                resolveSafe(video.duration)
                return
            }
            video.currentTime = Number.MAX_SAFE_INTEGER
            video.ontimeupdate = () => {
                video.ontimeupdate = null
                resolveSafe(video.duration)
            }
        }

        video.onerror = () => {
            cleanup()
            reject(new Error('Failed to load video'))
        }

        video.src = objectUrl
        video.load()
    })
}