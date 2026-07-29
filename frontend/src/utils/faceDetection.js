import * as tf from '@tensorflow/tfjs'
import * as faceDetection from '@tensorflow-models/face-detection'

let detector = null
let isInitialized = false

export async function initFaceDetection() {
    if (isInitialized) return detector
    
    try {
        await tf.ready()
        const model = faceDetection.SupportedModels.MediaPipeFaceDetector
        detector = await faceDetection.createDetector(model, {
            runtime: 'tfjs',
            maxFaces: 5,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        })
        isInitialized = true
        return detector
    } catch (error) {
        console.error('Face detection init error:', error)
        return null
    }
}

export async function detectFaces(videoElement) {
    if (!detector) return { faces: [], hasFace: false, multipleFaces: false, faceCount: 0 }
    
    try {
        const faces = await detector.estimateFaces(videoElement)
        return {
            faces: faces,
            hasFace: faces.length > 0,
            multipleFaces: faces.length > 1,
            faceCount: faces.length
        }
    } catch (error) {
        return { faces: [], hasFace: false, multipleFaces: false, faceCount: 0 }
    }
}

export async function detectMouthOpen(videoElement) {
    const result = await detectFaces(videoElement)
    if (!result.hasFace) return { mouthOpen: false, confidence: 0 }
    
    try {
        const face = result.faces[0]
        const keypoints = face.keypoints || []
        if (keypoints.length === 0) return { mouthOpen: false, confidence: 0 }
        
        const topLip = keypoints.find(k => k.name === 'mouthTop' || k.name === 'upperLip')
        const bottomLip = keypoints.find(k => k.name === 'mouthBottom' || k.name === 'lowerLip')
        
        if (topLip && bottomLip) {
            const distance = Math.abs(topLip.y - bottomLip.y)
            return { mouthOpen: distance > 0.03, confidence: Math.min(distance / 0.05, 1) }
        }
        return { mouthOpen: false, confidence: 0 }
    } catch (error) {
        return { mouthOpen: false, confidence: 0 }
    }
}

export function isDetectionSupported() {
    return 'MediaPipeFaceDetector' in faceDetection.SupportedModels
}