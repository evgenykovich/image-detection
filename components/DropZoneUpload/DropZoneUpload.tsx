import React from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { AIAction } from '@/util/enums'
import './DropZone.styles.css'

interface DropZoneUploadProps {
  onDrop: (files: File[], event?: any) => void
  selectedFiles: File[] | undefined
  preview?: string | null
  handleSubmit?: (action: string) => void
  handleClear?: () => void
  renderGetMeasurments?: () => React.ReactNode
  accept?: string
  maxFiles?: number
}

export const DropZoneUpload = ({
  onDrop,
  selectedFiles,
  preview,
  handleSubmit,
  handleClear,
  renderGetMeasurments,
  accept,
  maxFiles = 1,
}: DropZoneUploadProps) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept ? { [accept]: [] } : undefined,
    maxFiles,
  })

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p className="text-white">Drop the files here ...</p>
        ) : (
          <p className="text-white">
            Drag and drop files here, or click to select files
          </p>
        )}
        {selectedFiles && (
          <div className="mt-4">
            <p className="text-white">
              Selected file: {selectedFiles[0]?.name}
            </p>
          </div>
        )}
        {preview && (
          <div className="mt-4">
            <img
              src={preview}
              alt="Preview"
              style={{ maxWidth: '200px', margin: '0 auto' }}
            />
          </div>
        )}
      </div>

      {selectedFiles && handleSubmit && (
        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-4">
          <Button
            className="w-full sm:w-auto mb-2 sm:mb-0 text-white bg-blue-500 border-0 py-2 px-4 focus:outline-none hover:bg-blue-600 hover:cursor-pointer rounded text-lg"
            onClick={() => handleSubmit(AIAction.DETECT)}
          >
            Detect Items
          </Button>
          {renderGetMeasurments && renderGetMeasurments()}
          {handleClear && (
            <Button
              className="w-full sm:w-auto text-white bg-red-500 border-0 py-2 px-4 focus:outline-none hover:bg-red-600 hover:cursor-pointer rounded text-lg"
              onClick={handleClear}
            >
              Clear
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
