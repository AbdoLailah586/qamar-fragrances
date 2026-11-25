import React, { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed } from 'lucide-react';
import { GOVERNORATE_COORDS } from '../utils/egyptLocation';

const PIN_ICON = L.divIcon({
  className: 'qamar-map-pin-wrapper',
  html: `<div style="position:relative;width:36px;height:44px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.32));">
    <svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 1C8.163 1 1 8.163 1 17C1 28.5 17 41 17 41C17 41 33 28.5 33 17C33 8.163 25.837 1 17 1Z" fill="#fe9931" stroke="#ffffff" stroke-width="2.5"/>
      <circle cx="17" cy="17" r="6" fill="#ffffff"/>
    </svg>
  </div>`,
  iconSize: [36, 44],
  iconAnchor: [18, 42]
});

interface LocationPickerMapProps {
  governorate: string;
  latitude?: number;
  longitude?: number;
  onSelectCoords: (lat: number, lng: number) => void;
}

/** Interactive OpenStreetMap/Leaflet pin picker for manual and GPS-assisted delivery coordinates. */
export const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  governorate,
  latitude,
  longitude,
  onSelectCoords
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onSelectRef = useRef(onSelectCoords);
  onSelectRef.current = onSelectCoords;

  const fallbackCenter = useMemo<[number, number]>(
    () => GOVERNORATE_COORDS[governorate] || GOVERNORATE_COORDS['الدقهلية - المنصورة'],
    [governorate]
  );

  const hasExactCoords =
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter: [number, number] = hasExactCoords ? [latitude!, longitude!] : fallbackCenter;
    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: hasExactCoords ? 16 : 13,
      scrollWheelZoom: false,
      zoomControl: false,
      attributionControl: true
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const placeMarker = (lat: number, lng: number, pan = false) => {
      if (!markerRef.current) {
        const marker = L.marker([lat, lng], { icon: PIN_ICON, draggable: true }).addTo(map);
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onSelectRef.current(pos.lat, pos.lng);
        });
        markerRef.current = marker;
      } else {
        markerRef.current.setLatLng([lat, lng]);
      }
      if (pan) {
        map.setView([lat, lng], Math.max(map.getZoom(), 15), { animate: true });
      }
    };

    if (hasExactCoords) {
      placeMarker(latitude!, longitude!, false);
    }

    map.on('click', (e: L.LeafletMouseEvent) => {
      placeMarker(e.latlng.lat, e.latlng.lng, true);
      onSelectRef.current(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    const timer = window.setTimeout(() => map.invalidateSize(), 160);

    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (hasExactCoords) {
      if (!markerRef.current) {
        const marker = L.marker([latitude!, longitude!], { icon: PIN_ICON, draggable: true }).addTo(map);
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onSelectRef.current(pos.lat, pos.lng);
        });
        markerRef.current = marker;
      } else {
        markerRef.current.setLatLng([latitude!, longitude!]);
      }
      map.setView([latitude!, longitude!], Math.max(map.getZoom(), 15), { animate: true });
    } else {
      map.setView(fallbackCenter, 13, { animate: true });
    }
  }, [hasExactCoords, latitude, longitude, fallbackCenter]);

  return (
    <div className="space-y-2">
      <div className="relative rounded-2xl overflow-hidden border border-orange-200 bg-gray-100 shadow-inner">
        <div ref={containerRef} data-testid="checkout-location-map" className="w-full h-64 sm:h-72 z-0" />
        <button
          type="button"
          onClick={() => mapRef.current?.setView(fallbackCenter, 13, { animate: true })}
          title="تركيز الخريطة على المحافظة المختارة"
          className="absolute top-3 left-3 z-[400] px-3 py-1.5 rounded-full bg-white/95 hover:bg-white text-[#252a31] border border-gray-200 shadow-sm text-[11px] font-bold flex items-center gap-1.5"
        >
          <LocateFixed className="w-3.5 h-3.5 text-[#fe9931]" />
          <span>مركز {governorate.split(' - ')[0]}</span>
        </button>
      </div>
      <p className="text-[11px] text-gray-500 font-medium">
        اضغط على أي نقطة بالخريطة أو اسحب الدبوس البرتقالي لتحديد موقع التوصيل بدقة.
      </p>
    </div>
  );
};

export default LocationPickerMap;
