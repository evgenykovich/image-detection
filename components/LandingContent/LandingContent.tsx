import { UploadFiles } from '../UploadFiles'

export const LandingContent = async () => {
  return (
    <div className="px-10 pb-6">
      <div className="flex items-center justify-center">
        <UploadFiles />
      </div>
    </div>
  )
}
