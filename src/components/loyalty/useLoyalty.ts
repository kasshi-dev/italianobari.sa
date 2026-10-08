// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useState } from 'react'
import {
  ApiError,
  getCustomerToken,
  loyalty,
  setCustomerToken,
  type GuestPayload,
} from '@/lib/loyalty'

/**
 * Owns the guest's loyalty session for the whole menu app, so the hero
 * button can show the live points balance while the panel is closed.
 */
export function useLoyalty() {
  const [token, setToken] = useState<string | null>(() => getCustomerToken())
  const [data, setData] = useState<GuestPayload | null>(null)
  const [loading, setLoading] = useState<boolean>(Boolean(getCustomerToken()))
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!token) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setData(await loyalty.me(token))
      setError(null)
    } catch (e) {
      const err = e as ApiError
      if (err.status === 401) {
        // session expired or revoked — drop it quietly
        setCustomerToken(null)
        setToken(null)
        setData(null)
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const acceptSession = useCallback(
    (newToken: string, payload?: GuestPayload | null) => {
      setCustomerToken(newToken)
      setToken(newToken)
      if (payload) setData(payload)
    },
    [],
  )

  const signOut = useCallback(async () => {
    if (token) await loyalty.logout(token).catch(() => {})
    setCustomerToken(null)
    setToken(null)
    setData(null)
  }, [token])

  return {
    token,
    customer: data?.customer ?? null,
    payload: data,
    loading,
    error,
    refresh,
    acceptSession,
    signOut,
    isSignedIn: Boolean(token && data),
  }
}

export type Loyalty = ReturnType<typeof useLoyalty>
