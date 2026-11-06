import { useState } from 'react'
import { Star } from '@phosphor-icons/react'
import { BRAND } from '@shared/brand'
import { Button } from '@/components/ui/button'

/** The same ask as in the ERP: a 5-star Google review. Any star opens the review page. */
export function RateUs(): React.JSX.Element {
  const [hover, setHover] = useState(0)
  return (
    <section className="from-primary/10 to-card flex flex-col gap-3 rounded-md border bg-gradient-to-br p-4">
      <div className="flex flex-col gap-0.5">
        <h3 className="font-display text-sm font-semibold tracking-tight">Enjoying sdterm?</h3>
        <p className="text-muted-foreground text-xs">
          A 5-star review on Google helps us a lot and takes less than a minute.
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div role="group" aria-label="Rate us" className="flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <a
              key={n}
              href={BRAND.reviewUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`${n} ${n === 1 ? 'star' : 'stars'}: leave a review`}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(0)}
              className="focus-visible:ring-ring/60 rounded-sm p-0.5 outline-none focus-visible:ring-2"
            >
              <Star
                size={22}
                weight={n <= hover ? 'fill' : 'regular'}
                className={n <= hover ? 'text-primary' : 'text-muted-foreground'}
              />
            </a>
          ))}
        </div>
        <Button asChild size="sm">
          <a href={BRAND.reviewUrl} target="_blank" rel="noreferrer">
            <Star weight="fill" />
            Leave a review
          </a>
        </Button>
      </div>
    </section>
  )
}
