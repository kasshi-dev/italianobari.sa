// SPDX-License-Identifier: Apache-2.0
import { useSyncExternalStore } from 'react'

export type StaffLang = 'ar' | 'en'

const KEY = 'ib-staff-lang'
const listeners = new Set<() => void>()

function readInitial(): StaffLang {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'ar' || v === 'en') return v
  } catch {
    /* ignore */
  }
  return 'ar'
}

let current: StaffLang = readInitial()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function setStaffLang(next: StaffLang) {
  current = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn())
}

export function useStaffLang() {
  const lang = useSyncExternalStore(
    subscribe,
    () => current,
    () => 'ar' as StaffLang,
  )
  return {
    lang,
    dir: (lang === 'en' ? 'ltr' : 'rtl') as 'ltr' | 'rtl',
    /** t(arabic, english). Any extra arguments are ignored. */
    t: <T,>(ar: T, en: T, ..._ignored: unknown[]): T => (lang === 'ar' ? ar : en),
  }
}
