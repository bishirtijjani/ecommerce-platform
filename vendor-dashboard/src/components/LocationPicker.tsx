import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Loader2, LocateFixed, Search } from 'lucide-react';
import { Button } from './ui/Button';
import { searchPlaces, type PlaceSearchResult } from '../api/vendor';

// Vite doesn't resolve Leaflet's default marker asset URLs automatically.
const icon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Neutral fallback centre until the user drops/moves the pin (Nigeria centroid).
const DEFAULT_CENTER: [number, number] = [9.082, 8.6753];

const STREET_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const SATELLITE_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

const ClickHandler = ({ onPick }: { onPick: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

/** Slides the map to a searched point. Clicking the map already moves it. */
const Recenter = ({ lat, lng, recenterKey }: { lat: number | null; lng: number | null; recenterKey: number }) => {
  const map = useMap();
  useEffect(() => {
    if (recenterKey === 0 || lat == null || lng == null) return;
    map.setView([lat, lng], Math.max(map.getZoom(), 15), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);
  return null;
};

export const LocationPicker = ({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}) => {
  const { t } = useTranslation();
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [basemap, setBasemap] = useState<'streets' | 'satellite'>('streets');
  const [recenterKey, setRecenterKey] = useState(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasPin = lat != null && lng != null && !(lat === 0 && lng === 0);
  const center: [number, number] = hasPin ? [lat as number, lng as number] : DEFAULT_CENTER;

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  const handleSearch = (text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 2) {
      setPredictions([]);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        setPredictions(await searchPlaces(text.trim()));
      } catch (_) {
        setPredictions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const selectPrediction = (result: PlaceSearchResult) => {
    setQuery('');
    setPredictions([]);
    onChange(result.lat, result.lng);
    setRecenterKey((k) => k + 1);
  };

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [onChange]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t('common.searchPlace', { defaultValue: 'Search for an address or landmark…' })}
            className="w-full rounded-md border border-border bg-bg-surface py-2 pl-9 pr-3 text-sm text-text-primary outline-none focus:border-brand"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-text-muted" />
          )}
        </div>
        {predictions.length > 0 && (
          <ul className="absolute z-[1100] left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-bg-surface shadow-popover">
            {predictions.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => selectPrediction(p)}
                  className="w-full px-3 py-2 text-left hover:bg-bg-muted"
                >
                  <div className="text-sm font-medium text-text-primary">{p.label}</div>
                  <div className="text-xs text-text-muted">{p.address}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <div className="relative h-72 w-full">
          <MapContainer center={center} zoom={hasPin ? 15 : 12} className="h-full w-full" scrollWheelZoom>
            <TileLayer
              key={basemap}
              attribution={
                basemap === 'satellite'
                  ? 'Tiles &copy; Esri'
                  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              }
              url={basemap === 'satellite' ? SATELLITE_TILES : STREET_TILES}
              maxZoom={19}
            />
            <ClickHandler onPick={onChange} />
            <Recenter lat={lat} lng={lng} recenterKey={recenterKey} />
            {hasPin && <Marker position={[lat as number, lng as number]} icon={icon} />}
          </MapContainer>

          <div className="absolute right-2 top-2 z-[1000] flex overflow-hidden rounded-md border border-border bg-bg-surface shadow">
            {(['streets', 'satellite'] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBasemap(b)}
                className={`px-2.5 py-1 text-xs font-semibold ${
                  basemap === b ? 'bg-brand text-text-onBrand' : 'text-text-muted hover:bg-bg-muted'
                }`}
              >
                {b === 'streets' ? t('common.map', { defaultValue: 'Map' }) : t('common.satellite', { defaultValue: 'Satellite' })}
              </button>
            ))}
          </div>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={useMyLocation}
            loading={locating}
            icon={<LocateFixed className="h-4 w-4" />}
            className="absolute bottom-3 right-3 z-[1000] shadow-popover"
          >
            {t('common.useMyLocation')}
          </Button>
        </div>
        <div className="flex items-center justify-between bg-bg-muted px-3 py-2 text-xs text-text-muted">
          <span>{t('common.tapMapPin')}</span>
          {hasPin && (
            <span className="font-mono">
              {(lat as number).toFixed(4)}, {(lng as number).toFixed(4)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
