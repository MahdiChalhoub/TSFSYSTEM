import { Metadata } from 'next'
import HROverviewPage from './page-client'

export const metadata: Metadata = {
 title: 'HR Overview | Human Resources',
 description: 'Manage attendance, leave approvals, departments, and payroll summaries.',
}

export default function Page() {
 return <HROverviewPage />
}
