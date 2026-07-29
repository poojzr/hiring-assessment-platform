export async function detectMobile(videoElement) {
    try {
        const canvas = document.createElement('canvas')
        canvas.width = 320
        canvas.height = 240
        const ctx = canvas.getContext('2d')
        ctx.drawImage(videoElement, 0, 0, 320, 240)
        const imageData = ctx.getImageData(0, 0, 320, 240)
        return await detectMobileFromImageData(imageData)
    } catch (error) {
        return { detected: false, confidence: 0 }
    }
}

export async function detectMobileFromImageData(imageData) {
    try {
        const data = imageData.data
        let brightPixels = 0
        let totalPixels = data.length / 4
        
        for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] + data[i+1] + data[i+2]) / 3
            if (brightness > 200) {
                brightPixels++
            }
        }
        
        const brightRatio = brightPixels / totalPixels
        const confidence = Math.min(brightRatio / 0.1, 1)
        
        return {
            detected: confidence > 0.3,
            confidence: confidence,
            brightRatio: brightRatio
        }
    } catch (error) {
        return { detected: false, confidence: 0 }
    }
}

export function detectMobileShape(imageData) {
    try {
        const data = imageData.data
        let edgePixels = 0
        let totalPixels = data.length / 4
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i]
            const g = data[i+1]
            const b = data[i+2]
            const brightness = (r + g + b) / 3
            if (brightness > 200 && brightness < 230) {
                edgePixels++
            }
        }
        
        const edgeRatio = edgePixels / totalPixels
        const confidence = Math.min(edgeRatio / 0.05, 1)
        
        return {
            hasRectangle: confidence > 0.3,
            confidence: confidence
        }
    } catch (error) {
        return { hasRectangle: false, confidence: 0 }
    }
}