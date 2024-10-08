'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AIAction, Languages } from '@/util/enums'
import { ProgressBar } from 'primereact/progressbar'

export const TranslateComponent = () => {
  const [inputText, setInputText] = useState('')
  const [sourceLang, setSourceLang] = useState('en')
  const [targetLang, setTargetLang] = useState('es')
  const [translatedText, setTranslatedText] = useState('')
  const [progress, setProgress] = useState<number>(0)
  const [glossaryFile, setGlossaryFile] = useState<File | null>(null)

  const handleTranslate = async () => {
    setProgress(10)
    const formData = new FormData()
    formData.append('text', inputText)
    formData.append('sourceLang', sourceLang)
    formData.append('targetLang', targetLang)
    if (glossaryFile) {
      formData.append('glossary', glossaryFile)
    }

    try {
      setProgress(50)
      const response = await fetch(`/api/${AIAction.TRANSLATE}`, {
        method: 'POST',
        body: formData,
      })
      setProgress(75)
      const { translatedText } = await response.json()
      setProgress(100)
      setTranslatedText(translatedText)
    } catch (error) {
      console.error('Error translating text', error)
      setProgress(0)
    }
  }

  const handleClear = () => {
    setProgress(0)
    setInputText('')
    setTranslatedText('')
    setGlossaryFile(null)
  }

  const handleTargetLanguageSelect = (value: string) => {
    setTargetLang(value)
  }

  const handleSourceLanguageSelect = (value: string) => {
    setSourceLang(value)
  }

  return (
    <div>
      {progress !== 0 && (
        <div className="mt-6 mb-6">
          <ProgressBar value={progress}></ProgressBar>
        </div>
      )}
      <div className="mb-6">
        <Textarea
          className="text-black/80"
          placeholder="Enter text to translate"
          value={inputText}
          rows={5}
          onChange={(e) => setInputText(e.target.value)}
        ></Textarea>
      </div>
      <div className="flex mb-4 space-x-4">
        <Select
          onValueChange={(value) => handleSourceLanguageSelect(value)}
          defaultValue={sourceLang}
        >
          <SelectTrigger className="min-w-[180px] text-black/80 bg-white">
            <SelectValue placeholder="Source language" />
          </SelectTrigger>
          <SelectContent className="text-black/80 bg-white">
            <SelectGroup>
              {Object.entries(Languages).map(([key, value]) => {
                return (
                  <SelectItem key={key} value={key}>
                    {value}
                  </SelectItem>
                )
              })}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          onValueChange={(value) => handleTargetLanguageSelect(value)}
          defaultValue={targetLang}
        >
          <SelectTrigger className="min-w-[180px] text-black/80 bg-white">
            <SelectValue placeholder="Target language" />
          </SelectTrigger>
          <SelectContent className="text-black/80 bg-white">
            <SelectGroup>
              {Object.entries(Languages).map(([key, value]) => {
                return (
                  <SelectItem key={key} value={key}>
                    {value}
                  </SelectItem>
                )
              })}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="mb-6">
        <Input
          type="file"
          accept=".xlsx"
          className="bg-white text-black/80"
          onChange={(e) => setGlossaryFile(e.target.files?.[0] || null)}
        ></Input>
      </div>
      <div className="flex space-x-4">
        <Button
          className="w-full sm:w-auto mb-2 sm:mb-0 text-white bg-blue-500 border-0 py-2 px-4 focus:outline-none hover:bg-blue-600 hover:cursor-pointer rounded text-lg"
          disabled={!inputText}
          onClick={handleTranslate}
        >
          Translate
        </Button>
        <Button
          className="w-full sm:w-auto text-white bg-red-500 border-0 py-2 px-4 focus:outline-none hover:bg-red-600 hover:cursor-pointer rounded text-lg"
          onClick={handleClear}
        >
          Clear
        </Button>
      </div>
      <div className="mt-6">
        {translatedText && (
          <div className="text-white">
            <h2>Translated Text:</h2>
            <div>{translatedText}</div>
          </div>
        )}
      </div>
    </div>
  )
}
