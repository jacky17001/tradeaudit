import { Link } from 'react-router-dom'
import SectionCard from '../components/SectionCard'
import Button from '../components/ui/Button'
import { useLanguage } from '../i18n/LanguageContext'

function HomePage() {
  const { t } = useLanguage()

  return (
    <div className="space-y-6">
      <SectionCard
        title="TradeAudit"
        subtitle={t('home.subtitle')}
      >
        <p className="max-w-3xl text-sm leading-7 text-slate-300">
          {t('home.description')}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/dashboard">
            <Button>{t('home.openDashboard')}</Button>
          </Link>
          <Link to="/account-audit">
            <Button variant="secondary">{t('home.investorAccountAudit')}</Button>
          </Link>
        </div>
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-3">
        <SectionCard title={t('home.backtestsTitle')} subtitle={t('home.backtestsSubtitle')}>
          <p className="text-sm text-slate-300">{t('home.backtestsDesc')}</p>
        </SectionCard>
        <SectionCard title={t('home.forwardValidationTitle')} subtitle={t('home.forwardValidationSubtitle')}>
          <p className="text-sm text-slate-300">{t('home.forwardValidationDesc')}</p>
        </SectionCard>
        <SectionCard title={t('home.gateDecisionTitle')} subtitle={t('home.gateDecisionSubtitle')}>
          <p className="text-sm text-slate-300">{t('home.gateDecisionDesc')}</p>
        </SectionCard>
      </div>
    </div>
  )
}

export default HomePage
