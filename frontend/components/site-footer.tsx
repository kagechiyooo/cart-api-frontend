import { apiConfig } from '@/lib/api/config'

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-6">
        <p>Cartwise, a Software Testing course project.</p>
        <p data-testid="api-mode">
          API mode: <span className="font-mono font-medium text-foreground">{apiConfig.mode}</span>
        </p>
      </div>
    </footer>
  )
}
