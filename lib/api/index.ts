import { apiConfig } from '@/lib/api/config'
import { mockServices } from '@/lib/api/mock/services'
import { restServices } from '@/lib/api/rest/services'
import type { ApiServices } from '@/lib/api/types'

export const api: ApiServices = apiConfig.mode === 'rest' ? restServices : mockServices

export { ApiError, getErrorMessage } from '@/lib/api/errors'
export type * from '@/lib/api/types'
