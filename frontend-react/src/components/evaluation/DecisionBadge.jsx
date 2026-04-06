import Badge from '../ui/Badge'
import { useLanguage } from '../../i18n/LanguageContext'

const DECISION_TONE = {
  PASS: 'success',
  NEEDS_IMPROVEMENT: 'warning',
  FAIL: 'danger',
}

function DecisionBadge({ decision }) {
  const { language, t } = useLanguage()

  const label =
    language === 'zh'
      ? decision === 'PASS'
        ? t('evaluation.decisionPass')
        : decision === 'FAIL'
          ? t('evaluation.decisionFail')
          : t('evaluation.decisionNeedsImprovement')
      : decision

  return <Badge tone={DECISION_TONE[decision] ?? 'default'}>{label}</Badge>
}

export default DecisionBadge