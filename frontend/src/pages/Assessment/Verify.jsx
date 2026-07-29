import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Camera, Mail, CheckCircle, AlertCircle, RefreshCw, Shield, Clock, FileText, Monitor, Mic, Wifi, ArrowRight, User, Video, VideoOff, Volume2, VolumeX, Smartphone } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAssessment, sendOTP, verifyOTP, capturePhoto, startAssessment } from '../../api/assessments'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'

export default function AssessmentVerify() {
  const { accessToken } = useParams()
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const audioRef = useRef(null)
  const [assessment, setAssessment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [photoCaptured, setPhotoCaptured] = useState(false)
  const [photoData, setPhotoData] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [micReady, setMicReady] = useState(false)
  const [internetReady, setInternetReady] = useState(false)
  const [candidateName, setCandidateName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [cameraStream, setCameraStream] = useState(null)
  const [audioStream, setAudioStream] = useState(null)
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false)

  useEffect(() => {
    const fetchAssessment = async () => {
      setLoading(true)
      setError('')
      try {
        if (!accessToken) {
          setError('No access token provided')
          setLoading(false)
          return
        }
        
        const data = await getAssessment(accessToken)
        console.log('Assessment data:', data)
        setAssessment(data)
        setCandidateName(data.candidate_name || 'Candidate')
        setEmail(data.candidate_email || '')

        if (data.status === 'completed') {
          navigate(`/assessment/${accessToken}/thankyou`)
          return
        }

        if (data.status === 'expired') {
          setError('This assessment has expired. Please contact support.')
          toast.error('Assessment expired')
          return
        }

        checkInternetConnectivity()
      } catch (error) {
        console.error('Assessment fetch error:', error)
        const message = error.response?.data?.detail || 'Invalid or expired assessment link'
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }
    fetchAssessment()

    return () => {
      stopCamera()
      stopMicrophone()
    }
  }, [accessToken, navigate])

  const checkInternetConnectivity = async () => {
    try {
      const response = await fetch('/health', { method: 'HEAD', cache: 'no-cache' })
      setInternetReady(response.ok)
    } catch {
      setInternetReady(false)
    }
  }

  const startCamera = async () => {
    try {
      console.log('Starting camera...')
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user', 
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      })
      
      console.log('Camera stream obtained:', stream)
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded')
          videoRef.current.play()
            .then(() => {
              console.log('Video playing')
              setCameraReady(true)
              setCameraStream(stream)
            })
            .catch(err => {
              console.error('Video play error:', err)
              toast.error('Failed to play video stream')
            })
        }
      }
    } catch (error) {
      console.error('Camera error:', error)
      toast.error('Unable to access camera. Please allow camera permissions.')
      setError('Camera access required for verification')
    }
  }

  const startMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      })
      if (audioRef.current) {
        audioRef.current.srcObject = stream
        await audioRef.current.play()
        setMicReady(true)
        setAudioStream(stream)
      }
    } catch (error) {
      toast.error('Unable to access microphone. Please allow microphone permissions.')
      setMicReady(false)
    }
  }

  const stopCamera = () => {
    console.log('Stopping camera...')
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        track.stop()
        console.log('Track stopped:', track.kind)
      })
      setCameraStream(null)
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraReady(false)
  }

  const stopMicrophone = () => {
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop())
      setAudioStream(null)
    }
    setMicReady(false)
  }

  const enterFullscreen = async () => {
    try {
      const elem = document.documentElement
      if (elem.requestFullscreen) {
        await elem.requestFullscreen()
        setShowFullscreenPrompt(false)
      }
    } catch (error) {
      toast.error('Unable to enter fullscreen. Please manually enter fullscreen mode.')
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && step === 'instructions') {
        setShowFullscreenPrompt(true)
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [step])

  const handleSendOTP = async () => {
    if (!email) {
      toast.error('Please enter your email')
      return
    }
    setIsLoading(true)
    try {
      await sendOTP(accessToken, email)
      setOtpSent(true)
      toast.success('OTP sent to your email')
      setStep('otp')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send OTP')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP')
      return
    }
    setIsLoading(true)
    try {
      await verifyOTP(accessToken, email, otp)
      setOtpVerified(true)
      toast.success('Email verified')
      await startCamera()
      await startMicrophone()
      setStep('photo')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid OTP')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCapturePhoto = () => {
    console.log('Capturing photo...')
    if (!videoRef.current || !canvasRef.current) {
      console.error('Video or canvas ref is null')
      return
    }
    
    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95)
    console.log('Photo captured')
    setPhotoData(dataUrl)
    setPhotoCaptured(true)
    
    stopCamera()
  }

  const handleRetakePhoto = () => {
    setPhotoCaptured(false)
    setPhotoData(null)
    startCamera()
  }

  const handlePhotoConfirm = async () => {
    setIsLoading(true)
    try {
      await capturePhoto(accessToken, photoData)
      toast.success('Photo captured successfully')
      stopMicrophone()
      setStep('instructions')
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to save photo'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartAssessment = async () => {
    if (!agreed) {
      toast.error('Please agree to the proctoring guidelines')
      return
    }

    if (!document.fullscreenElement) {
      await enterFullscreen()
      if (!document.fullscreenElement) {
        toast.error('Please enter fullscreen mode to start the assessment')
        return
      }
    }

    setIsLoading(true)
    try {
      await startAssessment(accessToken)
      navigate(`/assessment/${accessToken}/take`)
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to start assessment'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const resendOTP = async () => {
    setIsLoading(true)
    try {
      await sendOTP(accessToken, email)
      toast.success('OTP resent to your email')
    } catch (error) {
      toast.error('Failed to resend OTP')
    } finally {
      setIsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-navy-800 mb-2">Verification Failed</h2>
          <p className="text-gray-600">{error}</p>
          <Button className="mt-4" onClick={() => window.location.href = '/'}>Go Home</Button>
        </div>
      </div>
    )
  }

  if (step === 'instructions') {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-navy-800">{assessment?.template_name}</h1>
              <p className="text-gray-500 mt-2">{assessment?.job_role}</p>
              <p className="text-sm text-green-600 mt-2">Welcome, {candidateName}! Verification complete.</p>
            </div>

            <div className="border-t border-b border-gray-200 py-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <Clock className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="font-semibold text-navy-800">{assessment?.duration_minutes} minutes</p>
                </div>
                <div className="text-center">
                  <FileText className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Questions</p>
                  <p className="font-semibold text-navy-800">{assessment?.questions?.length || 0}</p>
                </div>
                <div className="text-center">
                  <Shield className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Pass Threshold</p>
                  <p className="font-semibold text-navy-800">{assessment?.pass_threshold}%</p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold text-navy-800 mb-3 text-lg">Important Instructions</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Monitor className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-navy-800">Webcam Required</p>
                    <p className="text-xs text-gray-500">Camera must be on throughout the assessment</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Mic className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-navy-800">Microphone Required</p>
                    <p className="text-xs text-gray-500">Audio will be monitored for proctoring</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Wifi className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-navy-800">Stable Internet</p>
                    <p className="text-xs text-gray-500">Ensure uninterrupted connection</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-navy-800">Full Screen Mode</p>
                    <p className="text-xs text-gray-500">Assessment must be in full screen</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Smartphone className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-navy-800">No Mobile Devices</p>
                    <p className="text-xs text-gray-500">Mobile phone detection is active</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Volume2 className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-navy-800">Voice Monitoring</p>
                    <p className="text-xs text-gray-500">Loud voices and multiple voices are detected</p>
                  </div>
                </div>
              </div>

              <ul className="space-y-2 text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">.</span>
                  <span>You cannot pause or stop the timer once started.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">.</span>
                  <span>Answers are auto-saved as you progress.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">.</span>
                  <span>Do not refresh the page during the assessment.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">.</span>
                  <span>Switching tabs or windows will be recorded as a violation.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">.</span>
                  <span>Looking away from the camera repeatedly will be flagged.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">.</span>
                  <span>Multiple faces detected will result in automatic termination.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">.</span>
                  <span>Mobile phone usage will be detected and flagged.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">.</span>
                  <span>You will receive results via email after assessment completion.</span>
                </li>
              </ul>
            </div>

            {showFullscreenPrompt && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-700">
                  Please enter fullscreen mode to continue. Click the button below or press F11.
                </p>
                <Button onClick={enterFullscreen} className="mt-2" size="sm">
                  <Monitor className="w-4 h-4 mr-2" />
                  Enter Fullscreen
                </Button>
              </div>
            )}

            <div className="mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  I have read and agree to the proctoring guidelines and consent to recording
                </span>
              </label>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleStartAssessment}
                isLoading={isLoading}
                className="flex-1"
              >
                Start Assessment <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step === 'email' || step === 'otp' || step === 'photo' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-500'
              }`}>1</div>
              <div className={`w-16 h-0.5 ${step === 'otp' || step === 'photo' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step === 'otp' || step === 'photo' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-500'
              }`}>2</div>
              <div className={`w-16 h-0.5 ${step === 'photo' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step === 'photo' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-500'
              }`}>3</div>
            </div>
            <p className="text-sm text-gray-500">
              {step === 'email' ? 'Verify Email' : step === 'otp' ? 'Enter OTP' : 'Capture Photo'}
            </p>
          </div>

          {step === 'email' && (
            <div className="space-y-6">
              <div className="text-center">
                <Mail className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-navy-800">Verify Your Email</h2>
                <p className="text-gray-500 mt-2">Enter your registered email address to verify your identity</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
              </div>
              <Button
                onClick={handleSendOTP}
                isLoading={isLoading}
                fullWidth
              >
                Send OTP
              </Button>
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-6">
              <div className="text-center">
                <Shield className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-navy-800">Enter OTP</h2>
                <p className="text-gray-500 mt-2">We sent a 6-digit OTP to <strong>{email}</strong></p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">OTP Code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit OTP"
                  maxLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest"
                  disabled={isLoading}
                />
              </div>
              <Button
                onClick={handleVerifyOTP}
                isLoading={isLoading}
                fullWidth
              >
                Verify OTP
              </Button>
              <div className="text-center">
                <button
                  onClick={resendOTP}
                  className="text-sm text-blue-500 hover:text-blue-600 flex items-center justify-center gap-1"
                >
                  <RefreshCw className="w-4 h-4" />
                  Resend OTP
                </button>
              </div>
            </div>
          )}

          {step === 'photo' && (
            <div className="space-y-6">
              <div className="text-center">
                <Camera className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-navy-800">Capture Your Photo</h2>
                <p className="text-gray-500 mt-2">Take a clear photo of your face for verification</p>
              </div>

              <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
                {!photoCaptured ? (
                  <>
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      autoPlay
                      playsInline
                      muted
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {!cameraReady && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gray-900">
                        <Spinner className="mx-auto mb-4" />
                        <p className="text-sm">Initializing camera...</p>
                        <button
                          onClick={startCamera}
                          className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white text-sm transition-colors"
                        >
                          Retry Camera
                        </button>
                      </div>
                    )}
                    
                    {cameraReady && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
                        <button
                          onClick={handleCapturePhoto}
                          className="px-6 py-2 bg-white text-navy-800 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                        >
                          Capture
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <img src={photoData} alt="Captured" className="w-full h-full object-cover" />
                )}
              </div>

              <div className="flex items-center gap-3 justify-center">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${cameraReady ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm text-gray-600">Camera</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${micReady ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm text-gray-600">Microphone</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${internetReady ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm text-gray-600">Internet</span>
                </div>
              </div>

              {photoCaptured && (
                <div className="flex gap-3">
                  <Button
                    onClick={handlePhotoConfirm}
                    isLoading={isLoading}
                    fullWidth
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirm Photo
                  </Button>
                  <Button
                    onClick={handleRetakePhoto}
                    variant="outline"
                    className="flex-1"
                  >
                    Retake
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}