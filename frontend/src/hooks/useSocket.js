import { useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

let socketInstance = null

export function getSocket() {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })
  }
  return socketInstance
}

/**
 * Hook to subscribe to Socket.IO events
 * @param {string} event - event name
 * @param {function} callback - handler
 */
export function useSocket(event, callback) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    const socket = getSocket()
    const handler = (...args) => callbackRef.current(...args)
    socket.on(event, handler)
    return () => socket.off(event, handler)
  }, [event])
}

/**
 * Hook to emit socket events
 */
export function useSocketEmit() {
  return useCallback((event, data) => {
    getSocket().emit(event, data)
  }, [])
}

export default getSocket
