import { useCallback, useEffect, useRef, useState } from 'react'
import { scrollParent } from '@/lib/utils'

// Distance from the bottom still treated as "at the bottom".
const THRESHOLD = 80

// Chat-like scrolling on the page scroller: open at the latest message, follow new content
// (streamed answers) while the reader is at the bottom, and stop following once they scroll up.
// Waits until the messages are loaded so the first jump to the bottom is instant.
export function useFollowBottom(ready: boolean) {
  const [content, setContent] = useState<HTMLElement | null>(null)
  const [atBottom, setAtBottom] = useState(true)
  const following = useRef(true)
  const scrollerRef = useRef<HTMLElement | null>(null)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    following.current = true
    const scroller = scrollerRef.current
    scroller?.scrollTo({ top: scroller.scrollHeight, behavior })
  }, [])

  useEffect(() => {
    if (!content || !ready) return
    const scroller = scrollParent(content)
    scrollerRef.current = scroller
    let lastTop = scroller.scrollTop
    let first = true

    const onScroll = () => {
      const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
      if (distance < THRESHOLD) following.current = true
      else if (scroller.scrollTop < lastTop) following.current = false
      lastTop = scroller.scrollTop
      setAtBottom(distance < THRESHOLD)
    }

    // Fires once when observed (opening the tab) and whenever messages grow.
    const observer = new ResizeObserver(() => {
      if (following.current) scroller.scrollTo({ top: scroller.scrollHeight, behavior: first ? 'instant' : 'smooth' })
      first = false
      onScroll()
    })
    observer.observe(content)
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      observer.disconnect()
      scroller.removeEventListener('scroll', onScroll)
    }
  }, [content, ready])

  return { contentRef: setContent, atBottom, scrollToBottom }
}
