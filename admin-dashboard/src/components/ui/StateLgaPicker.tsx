import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import { Select } from './Input';

const getStates = () => api.get<unknown, { data: string[] }>('/geo/states').then((r) => r.data);

const getLgas = (state: string) =>
  api
    .get<unknown, { data: string[] }>(`/geo/states/${encodeURIComponent(state)}/lgas`)
    .then((r) => r.data);

/**
 * State + LGA selectors backed by the public /geo endpoints. The LGA list is
 * scoped to the selected state and disabled until one is chosen.
 */
export const StateLgaPicker = ({
  state,
  lga,
  onChange,
}: {
  state: string;
  lga: string;
  onChange: (patch: { state?: string; lga?: string }) => void;
}) => {
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
      <Select
        label="State"
        value={state}
        onChange={(e) => onChange({ state: e.target.value, lga: '' })}
      >
        <option value="">Select state</option>
        {states.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </Select>
      <Select
        label="LGA"
        value={lga}
        onChange={(e) => onChange({ lga: e.target.value })}
        disabled={!state}
      >
        <option value="">{state ? 'Select LGA' : 'Select state first'}</option>
        {lgas.map((l) => (
          <option key={l} value={l}>{l}</option>
        ))}
      </Select>
    </div>
  );
};
