"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Copy, Check } from "lucide-react"

export default function VideoCallApp() {
  const [myId, setMyId] = useState("")
  const [peerId, setPeerId] = useState("")
  const [isRegistered, setIsRegistered] = useState(false)
  const [isCalling, setIsCalling] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [connectionStatus, setConnectionStatus] = useState("Disconnected")
  const [copied, setCopied] = useState(false)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastMessageIdRef = useRef<number>(0)

  // Generate a random ID on first load
  useEffect(() => {
    const randomId = Math.random().toString(36).substring(2, 8)
    setMyId(randomId)
  }, [])

  // Initialize polling for messages
  useEffect(() => {
    const startPolling = async () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }

      // Poll for messages every 1 second
      pollingIntervalRef.current = setInterval(async () => {
        if (!isRegistered || !myId) return

        try {
          const response = await fetch(`/api/messages?userId=${myId}&lastId=${lastMessageIdRef.current}`)

          if (!response.ok) {
            console.error("Error polling for messages:", response.statusText)
            return
          }

          const data = await response.json()

          if (data.messages && data.messages.length > 0) {
            console.log(`Received ${data.messages.length} new messages`)

            // Update last message ID
            if (data.lastId) {
              lastMessageIdRef.current = data.lastId
            }

            // Process messages
            for (const message of data.messages) {
              await handleMessage(message)
            }
          }
        } catch (error) {
          console.error("Error polling for messages:", error)
        }
      }, 1000)

      console.log("Started polling for messages")
      setConnectionStatus("Online - Waiting for calls")
    }

    if (isRegistered && myId) {
      startPolling()
      registerUser()
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [isRegistered, myId])

  // Handle incoming messages
  const handleMessage = async (message: any) => {
    try {
      console.log("Processing message:", message.type, "from:", message.from)

      // Set the peer ID if not already set
      if (message.from && !peerId && message.from !== myId) {
        setPeerId(message.from)
        console.log("Set peer ID to:", message.from)
      }

      switch (message.type) {
        case "call-request":
          await handleCallRequest(message)
          break

        case "call-accepted":
          await handleCallAccepted(message)
          break

        case "call-rejected":
          handleCallRejected(message)
          break

        case "offer":
          await handleOffer(message)
          break

        case "answer":
          await handleAnswer(message)
          break

        case "ice-candidate":
          await handleIceCandidate(message)
          break

        case "hang-up":
          handleHangUp()
          break
      }
    } catch (error) {
      console.error("Error handling message:", error)
    }
  }

  // Handle call request
  const handleCallRequest = async (message: any) => {
    // Show UI to accept/reject call
    if (confirm(`Incoming call from ${message.from}. Accept?`)) {
      // Accept the call
      await sendMessage({
        type: "call-accepted",
        to: message.from,
        from: myId,
      })

      setPeerId(message.from)
      setIsCalling(true)
      setConnectionStatus("Call accepted, waiting for connection...")
    } else {
      // Reject the call
      await sendMessage({
        type: "call-rejected",
        to: message.from,
        from: myId,
      })
    }
  }

  // Handle call accepted
  const handleCallAccepted = async (message: any) => {
    console.log("Call accepted by:", message.from)
    setConnectionStatus("Call accepted, establishing connection...")

    // Create and send offer
    await createAndSendOffer()
  }

  // Handle call rejected
  const handleCallRejected = (message: any) => {
    console.log("Call rejected by:", message.from)
    setConnectionStatus("Call rejected")
    setErrorMessage("Call was rejected")
    setPeerId("")
    setIsCalling(false)
  }

  // Register user
  const registerUser = async () => {
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: myId }),
      })

      if (!response.ok) {
        throw new Error(`Failed to register: ${response.statusText}`)
      }

      const data = await response.json()
      console.log("Registration response:", data)

      if (data.error) {
        setErrorMessage(data.error)
        setIsRegistered(false)
        return
      }

      setConnectionStatus("Online - Waiting for calls")
    } catch (error) {
      console.error("Error registering user:", error)
      setErrorMessage("Failed to register. Please try again.")
      setIsRegistered(false)
    }
  }

  // Unregister user
  const unregisterUser = async () => {
    if (!myId) return

    try {
      await fetch("/api/unregister", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: myId }),
      })

      console.log("Unregistered user")
    } catch (error) {
      console.error("Error unregistering user:", error)
    }
  }

  // Send message to server
  const sendMessage = async (message: any) => {
    try {
      const response = await fetch("/api/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      })

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`)
      }

      console.log("Message sent:", message.type, "to:", message.to)
    } catch (error) {
      console.error("Error sending message:", error)
      setErrorMessage("Failed to send message. Please try again.")
    }
  }

  // Create and send offer
  const createAndSendOffer = async () => {
    try {
      console.log("Creating offer")

      if (!peerConnectionRef.current) {
        await createPeerConnection()
      }

      const offer = await peerConnectionRef.current!.createOffer()
      console.log("Setting local description")
      await peerConnectionRef.current!.setLocalDescription(offer)

      console.log("Sending offer to peer:", peerId)
      await sendMessage({
        type: "offer",
        offer: offer,
        to: peerId,
        from: myId,
      })

      setConnectionStatus("Offer sent, waiting for answer...")
    } catch (error) {
      console.error("Error creating offer:", error)
      setErrorMessage("Failed to create offer. Please try again.")
    }
  }

  // Handle WebRTC offer
  const handleOffer = async (message: any) => {
    try {
      console.log("Received offer, creating answer")
      setConnectionStatus("Received offer, creating answer...")

      if (!peerConnectionRef.current) {
        await createPeerConnection()
      }

      const rtcSessionDescription = new RTCSessionDescription(message.offer)
      console.log("Setting remote description from offer")
      await peerConnectionRef.current!.setRemoteDescription(rtcSessionDescription)

      console.log("Creating answer")
      const answer = await peerConnectionRef.current!.createAnswer()
      console.log("Setting local description")
      await peerConnectionRef.current!.setLocalDescription(answer)

      console.log("Sending answer to:", message.from)
      await sendMessage({
        type: "answer",
        answer: answer,
        to: message.from,
        from: myId,
      })

      setConnectionStatus("Answer sent, establishing connection...")
    } catch (error) {
      console.error("Error handling offer:", error)
      setErrorMessage("Failed to process offer. Please try again.")
    }
  }

  // Handle WebRTC answer
  const handleAnswer = async (message: any) => {
    try {
      console.log("Received answer from:", message.from)
      setConnectionStatus("Received answer, establishing connection...")

      const rtcSessionDescription = new RTCSessionDescription(message.answer)
      console.log("Setting remote description from answer")
      await peerConnectionRef.current!.setRemoteDescription(rtcSessionDescription)
      console.log("Remote description set successfully")
    } catch (error) {
      console.error("Error handling answer:", error)
      setErrorMessage("Failed to establish connection. Please try again.")
    }
  }

  // Handle ICE candidate
  const handleIceCandidate = async (message: any) => {
    try {
      if (peerConnectionRef.current && message.candidate) {
        console.log("Adding ICE candidate from:", message.from)
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(message.candidate))
        console.log("ICE candidate added successfully")
      }
    } catch (error) {
      console.error("Error adding ICE candidate:", error)
    }
  }

  // Handle hang up
  const handleHangUp = () => {
    console.log("Peer hung up")
    setConnectionStatus("Call ended by peer")
    handleDisconnect()
  }

  // Initialize local media stream
  const initLocalStream = async () => {
    try {
      console.log("Requesting media permissions...")
      setConnectionStatus("Requesting camera and microphone access...")

      // Request permissions
      const constraints = {
        video: true, // Always request video first, we'll handle enabling/disabling later
        audio: true,
      }

      console.log("Requesting media with constraints:", constraints)
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      console.log(
        "Media access granted:",
        stream
          .getTracks()
          .map((t) => `${t.kind}: ${t.label}`)
          .join(", "),
      )

      localStreamRef.current = stream

      // Set video tracks enabled state based on user preference
      stream.getVideoTracks().forEach((track) => {
        track.enabled = videoEnabled
      })

      // Set audio tracks enabled state based on user preference
      stream.getAudioTracks().forEach((track) => {
        track.enabled = audioEnabled
      })

      if (localVideoRef.current) {
        console.log("Setting local video source")
        localVideoRef.current.srcObject = stream

        // Force play on the video element
        try {
          await localVideoRef.current.play()
          console.log("Local video playing successfully")
        } catch (e) {
          console.error("Error playing local video:", e)
          // Try again with user interaction
          localVideoRef.current.onloadedmetadata = () => {
            localVideoRef
              .current!.play()
              .then(() => console.log("Local video playing after metadata loaded"))
              .catch((e) => console.error("Still couldn't play local video:", e))
          }
        }
      } else {
        console.error("Local video ref is null")
      }

      setConnectionStatus("Camera and microphone connected")
      return stream
    } catch (error) {
      console.error("Error accessing media devices:", error)
      setErrorMessage("Could not access camera or microphone. Please check permissions and try again.")
      setConnectionStatus("Media access denied")
      return null
    }
  }

  // Create and configure RTCPeerConnection
  const createPeerConnection = async () => {
    try {
      console.log("Creating peer connection")
      setConnectionStatus("Setting up connection...")

      const configuration = {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
        ],
        iceCandidatePoolSize: 10,
      }

      // Close any existing peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
      }

      peerConnectionRef.current = new RTCPeerConnection(configuration)
      console.log("Peer connection created")

      // Get local stream if not already available
      if (!localStreamRef.current) {
        console.log("No local stream, initializing...")
        const stream = await initLocalStream()
        if (!stream) {
          throw new Error("Failed to get local stream")
        }
      }

      // Add local tracks to peer connection
      localStreamRef.current!.getTracks().forEach((track) => {
        console.log("Adding track to peer connection:", track.kind)
        peerConnectionRef.current!.addTrack(track, localStreamRef.current!)
      })

      // Handle ICE candidates
      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(
            "New ICE candidate:",
            event.candidate.candidate ? event.candidate.candidate.substring(0, 50) + "..." : "null candidate",
          )
          sendMessage({
            type: "ice-candidate",
            candidate: event.candidate,
            to: peerId,
            from: myId,
          })
        } else {
          console.log("ICE candidate gathering complete")
        }
      }

      // Log ICE gathering state changes
      peerConnectionRef.current.onicegatheringstatechange = () => {
        console.log("ICE gathering state:", peerConnectionRef.current?.iceGatheringState)
      }

      // Log ICE connection state changes
      peerConnectionRef.current.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", peerConnectionRef.current?.iceConnectionState)
        setConnectionStatus("ICE state: " + peerConnectionRef.current?.iceConnectionState)

        if (
          peerConnectionRef.current?.iceConnectionState === "connected" ||
          peerConnectionRef.current?.iceConnectionState === "completed"
        ) {
          console.log("ICE connection established!")
        }
      }

      // Handle connection state changes
      peerConnectionRef.current.onconnectionstatechange = () => {
        console.log("Connection state:", peerConnectionRef.current?.connectionState)

        if (peerConnectionRef.current?.connectionState === "connected") {
          console.log("Peer connection established!")
          setIsConnected(true)
          setConnectionStatus("Connected to peer")
        } else if (["disconnected", "failed", "closed"].includes(peerConnectionRef.current?.connectionState || "")) {
          console.log("Peer connection lost or failed")
          setIsConnected(false)
          setConnectionStatus("Peer connection " + peerConnectionRef.current?.connectionState)
        }
      }

      // Handle incoming tracks
      peerConnectionRef.current.ontrack = (event) => {
        console.log("Received remote track:", event.track.kind)

        if (remoteVideoRef.current) {
          console.log("Setting remote stream to video element")

          // Always use the first stream
          const stream = event.streams[0]
          if (stream) {
            remoteVideoRef.current.srcObject = stream

            // Force play on the video element
            try {
              remoteVideoRef.current
                .play()
                .then(() => console.log("Remote video playing successfully"))
                .catch((e) => console.error("Error playing remote video:", e))
            } catch (e) {
              console.error("Error playing remote video:", e)

              // Try again with user interaction
              remoteVideoRef.current.onloadedmetadata = () => {
                remoteVideoRef
                  .current!.play()
                  .then(() => console.log("Remote video playing after metadata loaded"))
                  .catch((e) => console.error("Still couldn't play remote video:", e))
              }
            }
          } else {
            console.error("No stream received with track")
          }
        } else {
          console.error("Remote video ref is null")
        }
      }

      console.log("Peer connection setup complete")
      return peerConnectionRef.current
    } catch (error) {
      console.error("Error creating peer connection:", error)
      setErrorMessage("Failed to establish connection. Please try again.")
      setConnectionStatus("Connection setup failed")
      return null
    }
  }

  // Register and initialize
  const register = async () => {
    setErrorMessage("")
    setConnectionStatus("Initializing...")

    try {
      // Initialize local stream
      const stream = await initLocalStream()
      if (!stream) {
        throw new Error("Failed to get local stream")
      }

      setIsRegistered(true)
    } catch (error) {
      console.error("Error registering:", error)
      setErrorMessage("Failed to initialize. Please check your camera and microphone permissions.")
      setConnectionStatus("Initialization failed")
    }
  }

  // Start a call
  const startCall = async () => {
    if (!peerId.trim()) {
      setErrorMessage("Please enter a peer ID")
      return
    }

    try {
      console.log("Starting call to:", peerId)
      setConnectionStatus("Calling peer...")
      setIsCalling(true)

      // Send call request
      await sendMessage({
        type: "call-request",
        to: peerId,
        from: myId,
      })

      setConnectionStatus("Call request sent, waiting for response...")
    } catch (error) {
      console.error("Error starting call:", error)
      setErrorMessage("Failed to start call. Please try again.")
      setConnectionStatus("Call initiation failed")
      setIsCalling(false)
    }
  }

  // Handle disconnection
  const handleDisconnect = () => {
    console.log("Disconnecting call")

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    setIsCalling(false)
    setIsConnected(false)
    setPeerId("")
    setConnectionStatus("Call ended")
  }

  // Hang up the call
  const hangUp = async () => {
    console.log("Hanging up call to:", peerId)

    // Notify peer
    if (peerId) {
      await sendMessage({
        type: "hang-up",
        to: peerId,
        from: myId,
      })
    }

    handleDisconnect()
  }

  // Unregister and clean up
  const unregister = () => {
    console.log("Unregistering")

    // Hang up any active call
    if (isCalling) {
      hangUp()
    }

    // Unregister from server
    unregisterUser()

    // Stop all tracks in the local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        console.log("Stopping track:", track.kind)
        track.stop()
      })
      localStreamRef.current = null
    }

    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }

    // Stop polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }

    setIsRegistered(false)
    setConnectionStatus("Disconnected")
    lastMessageIdRef.current = 0
  }

  // Toggle video
  const toggleVideo = async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]

      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setVideoEnabled(videoTrack.enabled)
        console.log("Video track enabled:", videoTrack.enabled)
      }
    }
  }

  // Toggle audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]

      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setAudioEnabled(audioTrack.enabled)
        console.log("Audio track enabled:", audioTrack.enabled)
      }
    }
  }

  // Copy ID to clipboard
  const copyIdToClipboard = () => {
    navigator.clipboard
      .writeText(myId)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch((err) => {
        console.error("Failed to copy ID:", err)
      })
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <h1 className="text-3xl font-bold mb-4">WebRTC Video Call</h1>

      <div className="w-full max-w-3xl mb-4">
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-sm text-blue-800">
          Status: {connectionStatus}
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 p-3 mb-4 text-red-800 bg-red-100 rounded-md w-full max-w-3xl">
          <AlertCircle className="h-5 w-5" />
          <p>{errorMessage}</p>
        </div>
      )}

      {!isRegistered ? (
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Start Video Call</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="myId" className="block text-sm font-medium mb-1">
                  Your ID
                </label>
                <div className="flex">
                  <Input
                    id="myId"
                    type="text"
                    value={myId}
                    onChange={(e) => setMyId(e.target.value)}
                    placeholder="Your ID"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  This is your unique ID. You can share it with others to receive calls.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={register} className="w-full">
              Start
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="w-full max-w-5xl">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-sm">
                  Your ID: {myId}
                </Badge>
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={copyIdToClipboard}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              {isConnected && (
                <Badge variant="success" className="bg-green-500 text-white">
                  Connected
                </Badge>
              )}
            </div>
            <Button variant="destructive" onClick={unregister}>
              Disconnect
            </Button>
          </div>

          {!isCalling && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Call Someone</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={peerId}
                    onChange={(e) => setPeerId(e.target.value)}
                    placeholder="Enter peer ID"
                    className="flex-1"
                  />
                  <Button onClick={startCall}>
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">You</div>
              {!localStreamRef.current && (
                <div className="absolute inset-0 flex items-center justify-center text-white bg-black/70">
                  Loading camera...
                </div>
              )}
            </div>

            <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              {!isConnected && isCalling && (
                <div className="absolute inset-0 flex items-center justify-center text-white">Connecting...</div>
              )}
              {!isConnected && !isCalling && (
                <div className="absolute inset-0 flex items-center justify-center text-white">No one connected</div>
              )}
              {isConnected && (
                <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">Peer</div>
              )}
            </div>
          </div>

          <div className="flex justify-center gap-3">
            {isCalling && (
              <Button variant="destructive" onClick={hangUp} className="flex items-center gap-2">
                <PhoneOff className="h-4 w-4" />
                Hang Up
              </Button>
            )}

            <Button
              variant={videoEnabled ? "default" : "outline"}
              onClick={toggleVideo}
              className="flex items-center gap-2"
            >
              {videoEnabled ? (
                <>
                  <Video className="h-4 w-4" />
                  Video On
                </>
              ) : (
                <>
                  <VideoOff className="h-4 w-4" />
                  Video Off
                </>
              )}
            </Button>

            <Button
              variant={audioEnabled ? "default" : "outline"}
              onClick={toggleAudio}
              className="flex items-center gap-2"
            >
              {audioEnabled ? (
                <>
                  <Mic className="h-4 w-4" />
                  Mic On
                </>
              ) : (
                <>
                  <MicOff className="h-4 w-4" />
                  Mic Off
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

