import { env } from '../../config/env'
import { forwardGateMock } from '../../data/mock/forwardGate'
import { get } from '../../lib/http'
import type { ForwardGatePayload, ForwardGateSummaryResponse } from '../../types/forwardGate'
import { endpoints } from '../endpoints'
import { mapForwardGateSummaryToPayload } from '../mappers/forwardGateMapper'

export async function getForwardGateData(): Promise<ForwardGatePayload> {
  if (env.useMockApi) {
    return forwardGateMock
  }

  try {
    const response = await get<ForwardGateSummaryResponse>(endpoints.forwardGate.summary)
    return mapForwardGateSummaryToPayload(response)
  } catch {
    return forwardGateMock
  }
}
