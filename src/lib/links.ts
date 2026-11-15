// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The evidence file names each item's home by the address it had before the redesign.
// This maps those addresses to the screens that hold the content now.
export function appHref(href: string): string {
  if (href === '/') return '/about?section=overview'
  if (href.startsWith('/?')) return `/dashboard${href.slice(1)}`
  return href
}
