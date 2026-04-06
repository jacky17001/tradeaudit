import { env } from '../../config/env'
import { auditMock } from '../../data/mock/audit'
import { get } from '../../lib/http'
import type { AuditPayload, AuditSummaryResponse } from '../../types/audit'
import { endpoints } from '../endpoints'
import { mapAuditSummaryToPayload } from '../mappers/auditMapper'

export async function getAuditData(): Promise<AuditPayload> {
  if (env.useMockApi) {
    return auditMock
  }

  try {
    const summary = await get<AuditSummaryResponse>(endpoints.audit.summary)
    return mapAuditSummaryToPayload(summary)
  } catch {
    return auditMock
  }
}
