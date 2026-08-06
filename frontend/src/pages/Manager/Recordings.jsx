import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Eye, Trash2, VideoOff, Download, RefreshCw, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '../../api/client'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'

export default function Recordings() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  const [recordings, setRecordings] = useState([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const [sessionInfo, setSessionInfo] = useState(null)
  const [sessionChunks, setSessionChunks] = useState([])
  const [loadingSessionChunks, setLoadingSessionChunks] = useState(false)
  const [sessionLookupDone, setSessionLookupDone] = useState(false)

  const [selectedSession, setSelectedSession] = useState(null)
  const [chunkVideos, setChunkVideos] = useState([])
  const [loadingChunks, setLoadingChunks] = useState(false)
  const [videoModalOpen, setVideoModalOpen] = useState(false)

  useEffect(() => {
    fetchRecordings()
  }, [])

  useEffect(() => {
    if (!sessionId) {
      revokeChunkUrls(sessionChunks)
      setSessionInfo(null)
      setSessionChunks([])
      setSessionLookupDone(false)
      return
    }

    if (isLoading) return

    const match = recordings.find(r => String(r.session_id) === String(sessionId))
    if (match) {
      loadSessionChunks(match)
    } else {
      revokeChunkUrls(sessionChunks)
      setSessionInfo(null)
      setSessionChunks([])
      setSessionLookupDone(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, recordings, isLoading])

  const fetchRecordings = async () => {
    setIsLoading(true)
    try {
      const response = await apiClient.get('/recordings/sessions')
      setRecordings(response.data.recordings || [])
      setTotal(response.data.total || 0)
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error('Recordings endpoint not found')
      } else if (error.response?.status === 500) {
        toast.error('Server error loading recordings')
      } else {
        toast.error('Failed to load recordings')
      }
      setRecordings([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDuration = (seconds) => {
    const value = Math.round(seconds || 0)
    const mins = Math.floor(value / 60)
    const secs = value % 60
    return `${mins}m ${secs}s`
  }

  const formatDate = (date) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  const revokeChunkUrls = (chunks) => {
    chunks.forEach(c => {
      if (c.objectUrl) URL.revokeObjectURL(c.objectUrl)
    })
  }

  const loadSessionChunks = async (recording) => {
    revokeChunkUrls(sessionChunks)
    setSessionInfo(recording)
    setLoadingSessionChunks(true)
    setSessionChunks([])
    setSessionLookupDone(false)
    try {
      const response = await apiClient.get(`/recordings/sessions/${recording.session_id}`)
      const chunks = response.data.recordings || []
      const loaded = []
      for (const chunk of chunks) {
        try {
          const videoResponse = await apiClient.get(`/recordings/${chunk.id}/stream`, {
            responseType: 'blob'
          })
          const objectUrl = URL.createObjectURL(videoResponse.data)
          loaded.push({ ...chunk, objectUrl })
        } catch (error) {
          loaded.push({ ...chunk, objectUrl: null })
        }
      }
      setSessionChunks(loaded)
    } catch (error) {
      toast.error('Failed to load recording chunks')
    } finally {
      setLoadingSessionChunks(false)
      setSessionLookupDone(true)
    }
  }

  const downloadSessionChunk = (chunk, index) => {
    if (!chunk.objectUrl) {
      toast.error('Video not available')
      return
    }
    const a = document.createElement('a')
    a.href = chunk.objectUrl
    a.download = `session_${sessionId}_chunk_${index + 1}.webm`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const deleteSessionRecordings = async (sid) => {
    if (!confirm('Are you sure you want to delete all recordings for this session?')) return
    try {
      await apiClient.delete(`/recordings/sessions/${sid}`)
      toast.success('Recordings deleted successfully')
      revokeChunkUrls(sessionChunks)
      setSessionChunks([])
      setSessionInfo(null)
      fetchRecordings()
    } catch (error) {
      toast.error('Failed to delete recordings')
    }
  }

  const viewRecording = async (recording) => {
    revokeChunkUrls(chunkVideos)
    setSelectedSession(recording)
    setVideoModalOpen(true)
    setLoadingChunks(true)
    setChunkVideos([])
    try {
      const response = await apiClient.get(`/recordings/sessions/${recording.session_id}`)
      const chunks = response.data.recordings || []
      const loaded = []
      for (const chunk of chunks) {
        try {
          const videoResponse = await apiClient.get(`/recordings/${chunk.id}/stream`, {
            responseType: 'blob'
          })
          const objectUrl = URL.createObjectURL(videoResponse.data)
          loaded.push({ ...chunk, objectUrl })
        } catch (error) {
          loaded.push({ ...chunk, objectUrl: null })
        }
      }
      setChunkVideos(loaded)
    } catch (error) {
      toast.error('Failed to load recording chunks')
    } finally {
      setLoadingChunks(false)
    }
  }

  const closeModal = () => {
    revokeChunkUrls(chunkVideos)
    setChunkVideos([])
    setSelectedSession(null)
    setVideoModalOpen(false)
  }

  const deleteRecording = async (sid) => {
    if (!confirm('Are you sure you want to delete all recordings for this session?')) return
    try {
      await apiClient.delete(`/recordings/sessions/${sid}`)
      toast.success('Recordings deleted successfully')
      if (selectedSession && String(selectedSession.session_id) === String(sid)) {
        revokeChunkUrls(chunkVideos)
        setChunkVideos([])
        setSelectedSession(null)
        setVideoModalOpen(false)
      }
      fetchRecordings()
    } catch (error) {
      toast.error('Failed to delete recordings')
    }
  }

  const downloadChunk = (chunk, index) => {
    if (!chunk.objectUrl) {
      toast.error('Video not available')
      return
    }
    const a = document.createElement('a')
    a.href = chunk.objectUrl
    a.download = `session_${selectedSession.session_id}_chunk_${index + 1}.webm`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  if (sessionId) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg sm:text-2xl font-bold text-navy-800 break-all">Session {sessionId} Recordings</h1>
          </div>
          <Button variant="outline" onClick={fetchRecordings} className="w-full sm:w-auto">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {!sessionLookupDone || loadingSessionChunks ? (
          <div className="flex items-center justify-center h-64 bg-white rounded-lg shadow-sm border border-gray-100">
            <Spinner />
          </div>
        ) : !sessionInfo ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-8 sm:p-12 text-center">
            <VideoOff className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-600 font-medium text-sm sm:text-base">No recordings found for this session</p>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              This session hasn't been taken with camera access yet, or no chunks have uploaded.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-sm border-b border-gray-100 pb-4">
              <div>
                <span className="text-gray-500">Candidate:</span>
                <span className="ml-2 font-medium">{sessionInfo.candidate_name || 'Unknown'}</span>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>
                <span className="ml-2">{sessionInfo.status || 'unknown'}</span>
              </div>
              <div>
                <span className="text-gray-500">Total Chunks:</span>
                <span className="ml-2">{sessionInfo.total_chunks || 0}</span>
              </div>
              <div>
                <span className="text-gray-500">Total Duration:</span>
                <span className="ml-2">{formatDuration(sessionInfo.total_duration)}</span>
              </div>
            </div>

            {sessionChunks.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-400">
                <div className="text-center">
                  <VideoOff className="w-12 h-12 mx-auto mb-2" />
                  <p>No video chunks available</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-[65vh] overflow-y-auto">
                {sessionChunks.map((chunk, index) => (
                  <div key={chunk.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 flex items-center justify-between text-sm gap-2">
                      <span className="font-medium">Chunk {index + 1}</span>
                      <span className="text-gray-500">{formatDuration(chunk.duration)}</span>
                      <button
                        onClick={() => downloadSessionChunk(chunk, index)}
                        className="p-2 -m-1 text-green-600 hover:text-green-800 flex-shrink-0"
                        title="Download Chunk"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="bg-black">
                      {chunk.objectUrl ? (
                        <video controls className="w-full max-h-[40vh]" src={chunk.objectUrl}>
                          Your browser does not support the video tag.
                        </video>
                      ) : (
                        <div className="flex items-center justify-center h-32 text-gray-400">
                          <p>Video unavailable</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <Button variant="danger" onClick={() => deleteSessionRecordings(sessionId)} className="w-full sm:w-auto">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete This Session's Recordings
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-navy-800">Recordings</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchRecordings} className="w-full sm:w-auto">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Session ID</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Candidate</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Total Chunks</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Duration</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Uploaded</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recordings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500 text-sm">
                    No recordings found. Start an assessment to create recordings.
                  </td>
                </tr>
              ) : (
                recordings.map((recording) => (
                  <tr key={recording.session_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-sm font-mono">{recording.session_id}</td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-sm text-gray-600 whitespace-nowrap">{recording.candidate_name || 'Unknown'}</td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                        recording.status === 'completed' ? 'bg-green-100 text-green-700' : 
                        recording.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {recording.status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-sm text-gray-600">{recording.total_chunks || 0}</td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-sm text-gray-600 whitespace-nowrap">{formatDuration(recording.total_duration)}</td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-sm text-gray-500 whitespace-nowrap">{formatDate(recording.uploaded_at)}</td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-sm">
                      <div className="flex gap-1">
                        <button
                          onClick={() => viewRecording(recording)}
                          className="p-2 -m-1 text-blue-600 hover:text-blue-800 min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="View Recording"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteRecording(recording.session_id)}
                          className="p-2 -m-1 text-red-600 hover:text-red-800 min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="Delete Recordings"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 text-sm text-gray-500">
          Total: {total} sessions
        </div>
      </div>

      <Modal
        isOpen={videoModalOpen}
        onClose={closeModal}
        title="Recording Playback"
        className="max-w-4xl"
      >
        {selectedSession && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm">
              <div>
                <span className="text-gray-500">Session ID:</span>
                <span className="ml-2 font-mono break-all">{selectedSession.session_id}</span>
              </div>
              <div>
                <span className="text-gray-500">Candidate:</span>
                <span className="ml-2">{selectedSession.candidate_name || 'Unknown'}</span>
              </div>
              <div>
                <span className="text-gray-500">Total Chunks:</span>
                <span className="ml-2">{selectedSession.total_chunks || 0}</span>
              </div>
              <div>
                <span className="text-gray-500">Total Duration:</span>
                <span className="ml-2">{formatDuration(selectedSession.total_duration)}</span>
              </div>
            </div>

            {loadingChunks ? (
              <div className="flex items-center justify-center h-32">
                <Spinner />
              </div>
            ) : chunkVideos.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-400">
                <div className="text-center">
                  <VideoOff className="w-12 h-12 mx-auto mb-2" />
                  <p>No video chunks available</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {chunkVideos.map((chunk, index) => (
                  <div key={chunk.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 flex items-center justify-between text-sm gap-2">
                      <span className="font-medium">Chunk {index + 1}</span>
                      <span className="text-gray-500">{formatDuration(chunk.duration)}</span>
                      <button
                        onClick={() => downloadChunk(chunk, index)}
                        className="p-2 -m-1 text-green-600 hover:text-green-800 flex-shrink-0"
                        title="Download Chunk"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="bg-black">
                      {chunk.objectUrl ? (
                        <video controls className="w-full max-h-[40vh]" src={chunk.objectUrl}>
                          Your browser does not support the video tag.
                        </video>
                      ) : (
                        <div className="flex items-center justify-center h-32 text-gray-400">
                          <p>Video unavailable</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={closeModal}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}