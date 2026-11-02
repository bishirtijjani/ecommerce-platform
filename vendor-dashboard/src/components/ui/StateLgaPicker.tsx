import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import SearchableSelect from './SearchableSelect';
import { getLgas, getStates } from '../../api/vendor';

/**
 * Searchable State + LGA fields for Nigerian locations. Backed by the public
 * /geo endpoints (same data the Second Hand seed uses), so they can never drift.
 * The LGA field is disabled until a State is chosen and lists that State's LGAs.
 *
 * Uses SearchableSelect (a type-to-filter dropdown) rather than a native
 * <datalist>, which is unreliable on iOS/Safari - essential with 774 LGAs.
 */
export default function StateLgaPicker({
  state,
  lga,
  onChange,
}: {
  state: string;
  lga: string;
  onChange: (patch: { state?: string; lga?: string }) => void;
}) {
  const { t } = useTranslation();

  const { data: states = [] } = useQuery({
    queryKey: ['geo-states'],
    queryFn: getStates,
    staleTime: Infinity,
  });

  const { data: lgas = [] } = useQuery({
    queryKey: ['geo-lgas', state],
    queryFn: () => getLgas(state),
    enabled: !!state,
    staleTime: Infinity,
  });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <SearchableSelect
        label={t('geo.state')}
        value={state}
        options={states}
        placeholder={t('geo.selectState')}
        searchPlaceholder={t('geo.searchState', { defaultValue: 'Search states' })}
        onSelect={(value) => onChange({ state: value, lga: '' })}
      />
      <SearchableSelect
        label={t('geo.lga')}
        value={lga}
        options={lgas}
        placeholder={state ? t('geo.selectLga') : t('geo.selectStateFirst')}
        searchPlaceholder={t('geo.searchLga', { defaultValue: 'Search LGAs' })}
        disabled={!state}
        onSelect={(value) => onChange({ lga: value })}
      />
    </div>
  );
}
