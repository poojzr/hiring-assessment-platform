export function detectLoudVoice(audioData) {
    if (!audioData || audioData.length === 0) {
        return { isLoud: false, level: 0, db: -100 }
    }
    
    try {
        let sum = 0
        for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i] * audioData[i]
        }
        const rms = Math.sqrt(sum / audioData.length)
        const db = 20 * Math.log10(rms + 0.0001)
        
        return {
            isLoud: rms > 0.1,
            isVeryLoud: rms > 0.2,
            level: rms,
            db: db
        }
    } catch (error) {
        return { isLoud: false, level: 0, db: -100 }
    }
}

export function detectMultipleVoices(audioData) {
    if (!audioData || audioData.length < 1024) {
        return { multipleVoices: false, confidence: 0 }
    }
    
    try {
        const audioArray = new Float32Array(audioData)
        let peaks = 0
        const threshold = 0.3
        
        for (let i = 2; i < audioArray.length - 2; i++) {
            const val = Math.abs(audioArray[i])
            if (val > threshold && val > Math.abs(audioArray[i-1]) && val > Math.abs(audioArray[i+1])) {
                peaks++
            }
        }
        
        const confidence = Math.min(peaks / 5, 1)
        return {
            multipleVoices: confidence > 0.5,
            confidence: confidence
        }
    } catch (error) {
        return { multipleVoices: false, confidence: 0 }
    }
}

export function processAudioChunk(audioChunk) {
    if (!audioChunk) return null
    
    try {
        const audioArray = new Float32Array(audioChunk)
        let sum = 0
        for (let i = 0; i < audioArray.length; i++) {
            sum += audioArray[i] * audioArray[i]
        }
        const rms = Math.sqrt(sum / audioArray.length)
        return {
            rms: rms,
            db: 20 * Math.log10(rms + 0.0001),
            isSilent: rms < 0.01,
            isLoud: rms > 0.1
        }
    } catch (error) {
        return null
    }
}