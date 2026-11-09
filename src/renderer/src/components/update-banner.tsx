import { useState } from 'react'
import { ArrowsClockwise, X } from '@phosphor-icons/react'
import { BRAND } from '@shared/brand'
import { Button } from '@/components/ui/button'
import { useUpdates } from '@/store/updates'

/** A slim bar under the title bar: new version found, downloading, or the update failed. */
export function UpdateBanner(): React.JSX.Element | null {
  const { state, installing, startInstall } = useUpdates()
  const [dismissed, setDismissed] = useState<string | null>(null)

  const bar = 'bg-primary/10 flex h-9 shrink-0 items-center gap-3 border-b px-4 text-xs'

  if (state.status === 'available' && dismissed !== state.version) {
    return (
      <div className={bar} role="status">
        <ArrowsClockwise className="text-primary" />
        <span>
          sdterm <strong className="font-semibold">{state.version}</strong> is available.
        </span>
        <Button size="xs" onClick={startInstall}>
          Update and restart
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Remind me later"
          className="ml-auto"
          onClick={() => setDismissed(state.version ?? null)}
        >
          <X />
        </Button>
      </div>
    )
  }

  if (state.status === 'downloading') {
    const percent = state.percent ?? 0
    return (
      <div className={bar} role="status">
        <ArrowsClockwise className="text-primary animate-spin" />
        <span>
          Downloading sdterm {state.version}:{' '}
          <span className="font-mono tabular-nums">{percent}%</span>
        </span>
        <div className="bg-border h-1 w-40 overflow-hidden rounded-full">
          <div className="bg-primary h-full transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      </div>
    )
  }

  if (state.status === 'ready') {
    return (
      <div className={bar} role="status">
        <ArrowsClockwise className="text-primary" />
        <span>Restarting to finish the update...</span>
      </div>
    )
  }

  if (state.status === 'error' && installing) {
    return (
      <div
        className="bg-destructive/10 flex h-9 shrink-0 items-center gap-3 border-b px-4 text-xs"
        role="alert"
      >
        <span className="truncate">Could not update: {state.message}</span>
        <Button size="xs" variant="outline" onClick={startInstall}>
          Try again
        </Button>
        <a
          href={`${BRAND.website}/sdterm`}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline-offset-4 hover:underline"
        >
          Download it from our site
        </a>
      </div>
    )
  }

  return null
}
