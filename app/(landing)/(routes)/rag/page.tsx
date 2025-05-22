import { PageLayout } from '@/components/layouts/PageLayout'
import { UploadPDF } from '@/components/UploadPDF'

const title = 'Sitetracker skunkworks KB'
const description =
  'upload a pdf file and ask a question, we will answer it referancing data from the pdf'

const RagPage = () => {
  return (
    <PageLayout title={title} description={description}>
      <UploadPDF />
    </PageLayout>
  )
}

export default RagPage
