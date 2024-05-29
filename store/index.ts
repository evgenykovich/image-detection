import { atom } from 'jotai'
import { AISelectorEnum } from '@/util/enums'

const INITIAL_AI = AISelectorEnum.ALL_AI
export const aiInUse = atom(INITIAL_AI)
