'use client'

import { useAtom } from 'jotai'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { aiInUse } from '@/store'
import { AISelectorEnum } from '@/util/enums'

export const AISelector = () => {
  const [_, setAI] = useAtom(aiInUse)
  const handleAIChange = (value: AISelectorEnum) => {
    setAI(value)
  }
  const aiAvailableList = Object.values(AISelectorEnum)

  return (
    <div className="text-white w-full">
      <RadioGroup
        defaultValue={AISelectorEnum.ALL_AI}
        className="flex justify-between items-center max-sm:flex-col max-sm:items-start"
        onValueChange={(value) => handleAIChange(value as AISelectorEnum)}
      >
        {aiAvailableList.length > 0 &&
          aiAvailableList.map((ai) => (
            <div key={ai} className="flex items-center space-x-2">
              <RadioGroupItem value={ai} id={ai} />
              <Label htmlFor={ai}>{ai}</Label>
            </div>
          ))}
      </RadioGroup>
    </div>
  )
}
