import { OverviewScreen } from '@/components/overview/OverviewScreen'

// The front desk takes the money, so it sees the same numbers the owner does.
export default function DeskOverview() {
  return <OverviewScreen base="/desk" />
}
