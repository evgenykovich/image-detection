import Image from 'next/image'
import Dropzone from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { AIAction } from '@/util/enums'
import './DropZone.styles.css'

interface DropZoneUploadProps {
  onDrop: (files: File[]) => void
  selectedFiles: File[] | undefined
  preview: string | null
  handleSubmit: (action: AIAction) => void
  handleClear: () => void
  renderGetMeasurments?: () => React.ReactNode
}

export const DropZoneUpload = ({
  onDrop,
  selectedFiles,
  preview,
  handleSubmit,
  handleClear,
  renderGetMeasurments,
}: DropZoneUploadProps) => {
  return (
    <Dropzone
      onDrop={onDrop}
      multiple={false}
      disabled={Boolean(selectedFiles?.[0])}
    >
      {({ getRootProps, getInputProps }) => (
        <section className="w-full">
          <div {...getRootProps({ className: 'dropzone' })}>
            <input {...getInputProps()} />
            {preview ? (
              <div className="selected-file">
                <Image height={350} width={350} src={preview} alt="Image" />
              </div>
            ) : (
              'Drag and drop file here, or click to select file'
            )}
          </div>
          <aside className="flex flex-col sm:flex-row items-center justify-between w-full">
            <div className="flex flex-col sm:flex-row items-center sm:space-x-4 w-full sm:w-auto">
              <Button
                className="w-full sm:w-auto mb-2 sm:mb-0 text-white bg-blue-500 border-0 py-2 px-4 focus:outline-none hover:bg-blue-600 hover:cursor-pointer rounded text-lg"
                disabled={!selectedFiles}
                onClick={() => handleSubmit(AIAction.DETECT)}
              >
                Detect
              </Button>
              {renderGetMeasurments && renderGetMeasurments()}
            </div>
            {selectedFiles && selectedFiles.length > 0 && (
              <Button
                className="w-full sm:w-auto text-white bg-red-500 border-0 py-2 px-4 focus:outline-none hover:bg-blue-600 hover:cursor-pointer rounded text-lg mt-2 sm:mt-0"
                onClick={handleClear}
              >
                Clear
              </Button>
            )}
          </aside>
        </section>
      )}
    </Dropzone>
  )
}
