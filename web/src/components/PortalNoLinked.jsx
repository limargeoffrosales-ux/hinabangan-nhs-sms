import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { EmptyState } from './ui';

export default function PortalNoLinked() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isParent = user?.role === 'parent';
  return (
    <EmptyState
      icon={UserRound}
      text={isParent
        ? t('portal.noLinkedParent', 'Ask the school registrar to link your child to your portal account. Once linked, their grades, attendance and school records will appear here.')
        : t('portal.noLinkedStudent', 'Ask the school registrar to link your portal account to your student record. Once linked, your school records will appear here.')}
    >
      <Link className="btn" style={{ marginTop: 12 }} to="/portal/enroll">{t('portal.qEnroll', 'Apply for enrollment')}</Link>
    </EmptyState>
  );
}