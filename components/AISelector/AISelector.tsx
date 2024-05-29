'use client'

import { useAtom } from 'jotai'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { aiInUse } from '@/store'
import { AISelectorEnum } from '@/util/enums'

export const AISelector = () => {
  const [ai, setAI] = useAtom(aiInUse)
  const handleAIChange = (value: AISelectorEnum) => {
    setAI(value)
  }

  return (
    <div className="text-white w-full">
      <RadioGroup
        defaultValue={AISelectorEnum.ALL_AI}
        className="flex justify-between items-center max-sm:flex-col max-sm:items-start"
        onValueChange={(value) => handleAIChange(value as AISelectorEnum)}
      >
        <div className="flex items-center space-x-2 ">
          <RadioGroupItem value={AISelectorEnum.ALL_AI} id="r2" />
          <Label htmlFor="r1">{AISelectorEnum.ALL_AI}</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value={AISelectorEnum.OPEN_AI} id="r1" />
          <Label htmlFor="r1">{AISelectorEnum.OPEN_AI}</Label>
        </div>
        <div className="flex items-center space-x-2 ">
          <RadioGroupItem value={AISelectorEnum.GEMINI} id="r2" />
          <Label htmlFor="r1">{AISelectorEnum.GEMINI}</Label>
        </div>
        <div className="flex items-center space-x-2 ">
          <RadioGroupItem value={AISelectorEnum.CLAUDE} id="r2" />
          <Label htmlFor="r1">{AISelectorEnum.CLAUDE}</Label>
        </div>
      </RadioGroup>
    </div>
  )
}
