import { Metadata } from 'next'
import ReportBuilderPage from './page-client'

export const metadata: Metadata = {
    title: 'Report Builder | Finance',
    description: 'Create, manage, and run custom financial reports with Excel/CSV exports.',
}

export default function Page() {
    return <ReportBuilderPage />
}
