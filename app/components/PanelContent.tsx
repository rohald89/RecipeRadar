import { useMatches } from '@remix-run/react'

interface HandleWithPanel {
	handle: {
		panel?: React.ComponentType
	}
}

export function PanelContent() {
	const matches = useMatches()
	const route = matches[matches.length - 1] as HandleWithPanel

	// Each route can export a panel component
	const PanelComponent = route?.handle?.panel

	if (!PanelComponent) return null

	return <PanelComponent />
}