// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The small robot at the bottom right. It opens the chat panel. The panel and everything it
// needs load on the first open, so the rest of the site never pays for them.
import { lazy, Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bot } from 'lucide-react'

const loadPanel = () => import('./ChatPanel.tsx')
const ChatPanel = lazy(loadPanel)

export function ChatLauncher() {
  const [params] = useSearchParams()
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  // A question in the address opens the panel and asks it.
  const asked = params.get('ask')
  const wanted = asked != null || params.get('chat') === '1'
  useEffect(() => {
    if (wanted) {
      setLoaded(true)
      setOpen(true)
    }
  }, [wanted, asked])
  return (
    <>
      {!open ? (
        <button
          type="button"
          className="chat-launcher no-print"
          aria-label="Ask EMBER"
          title="Ask EMBER"
          onPointerEnter={() => void loadPanel().catch(() => {})}
          onFocus={() => void loadPanel().catch(() => {})}
          onClick={() => {
            setLoaded(true)
            setOpen(true)
          }}
        >
          <Bot size={22} aria-hidden="true" />
        </button>
      ) : null}
      {loaded ? (
        <Suspense fallback={null}>
          <ChatPanel open={open} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  )
}
