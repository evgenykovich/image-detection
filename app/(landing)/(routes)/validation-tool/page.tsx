import { PageLayout } from '@/components/layouts/PageLayout'
import { UploadZip } from '@/components/UploadZip/UploadZip'

const title = 'Image Validation Tool'
const description =
  'Upload a zip file containing good and bad images for automated validation and analysis '

const ValidationToolPage = () => {
  return (
    <PageLayout title={title} description={description}>
      <UploadZip />
    </PageLayout>
  )
}

export default ValidationToolPage
