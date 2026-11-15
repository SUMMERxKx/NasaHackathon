// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
import { useEffect } from 'react'
import { Link, useRouteError } from 'react-router-dom'

// A plain fallback when a screen fails. The shell and every other screen keep working.
export function RouteError({ standalone = false }: { standalone?: boolean }) {
  const error = useRouteError()
  useEffect(() => {
    if (error) console.error(error)
  }, [error])
  return (
    <div className={`page ${standalone ? 'flex min-h-screen flex-col justify-center' : ''}`}>
      <h1 id="page-title" tabIndex={-1} className="text-[28px]">
        This screen could not be shown
      </h1>
      <p className="mt-3 text-muted">The rest of EMBER still works.</p>
      <p className="mt-4">
        <Link to="/dashboard" className="btn btn-primary">
          Go to the dashboard
        </Link>
      </p>
    </div>
  )
}
