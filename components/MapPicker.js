'use client';

import { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Polygon,
  Polyline,
  CircleMarker,
  LayersControl,
  ZoomControl,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';

const markerIcon = new L.DivIcon({
  className: 'agropulse-marker',
  html: `
    <div style="position:relative;width:20px;height:20px;">
      <span style="position:absolute;inset:0;border-radius:9999px;background:#10B981;opacity:0.35;animation:pulseRing 1.6s ease-out infinite;"></span>
      <span style="position:absolute;inset:4px;border-radius:9999px;background:#10B981;box-shadow:0 0 0 2px #0B101B;"></span>
    </div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function ClickHandler({ mode, onPointClick, onPolygonClick, onPolygonFinish }) {
  useMapEvents({
    click(e) {
      if (mode === 'point') onPointClick({ lat: e.latlng.lat, lon: e.latlng.lng });
      else if (mode === 'polygon') onPolygonClick({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
    dblclick() {
      if (mode === 'polygon') onPolygonFinish?.();
    },
  });
  return null;
}

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && Number.isFinite(center[0]) && Number.isFinite(center[1])) {
      map.setView(center, Math.max(map.getZoom(), 13));
    }
  }, [center, map]);
  return null;
}

function DisableDoubleClickZoom({ enabled }) {
  const map = useMap();
  useEffect(() => {
    if (enabled) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
  }, [enabled, map]);
  return null;
}

export default function MapPicker({
  mode,
  point,
  bufferMeters,
  polygonDraft,
  polygonFinal,
  tileUrl,
  onPointClick,
  onPolygonClick,
  onPolygonFinish,
  recenterTo,
}) {
  const initialCenter = useMemo(() => {
    if (recenterTo) return recenterTo;
    if (point && Number.isFinite(point.lat) && Number.isFinite(point.lon)) {
      return [point.lat, point.lon];
    }
    return [-34.6, -60.5];
  }, [point, recenterTo]);

  const draftLatLng = (polygonDraft || []).map(([lon, lat]) => [lat, lon]);
  const finalLatLng = (polygonFinal || []).map(([lon, lat]) => [lat, lon]);

  return (
    <MapContainer
      center={initialCenter}
      zoom={6}
      scrollWheelZoom
      className="h-full w-full"
      zoomControl={false}
    >
      <ZoomControl position="topright" />

      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Satélite híbrido">
          <TileLayer
            attribution="Imágenes &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Oscuro (Carto)">
          <TileLayer
            attribution="&copy; OpenStreetMap &copy; CARTO"
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        pane="overlayPane"
        opacity={0.85}
      />

      {tileUrl && (
        <TileLayer
          key={tileUrl}
          url={tileUrl}
          opacity={0.78}
          zIndex={400}
          attribution="NDVI · Sentinel-2 / Earth Engine"
        />
      )}

      {mode === 'point' && point && Number.isFinite(point.lat) && Number.isFinite(point.lon) && (
        <>
          <Marker position={[point.lat, point.lon]} icon={markerIcon} />
          {bufferMeters > 0 && (
            <Circle
              center={[point.lat, point.lon]}
              radius={bufferMeters}
              pathOptions={{ color: '#10B981', weight: 1.5, fillOpacity: 0.08, dashArray: '4 4' }}
            />
          )}
        </>
      )}

      {mode === 'polygon' && draftLatLng.length > 0 && (
        <>
          <Polyline
            positions={draftLatLng}
            pathOptions={{ color: '#34D399', weight: 2, dashArray: '4 4' }}
          />
          {draftLatLng.map((pos, idx) => (
            <CircleMarker
              key={idx}
              center={pos}
              radius={4}
              pathOptions={{ color: '#34D399', fillColor: '#0B101B', fillOpacity: 1, weight: 2 }}
            />
          ))}
        </>
      )}

      {finalLatLng.length > 0 && (
        <Polygon
          positions={finalLatLng}
          pathOptions={{ color: '#10B981', weight: 2, fillOpacity: 0.15 }}
        />
      )}

      <ClickHandler
        mode={mode}
        onPointClick={onPointClick}
        onPolygonClick={onPolygonClick}
        onPolygonFinish={onPolygonFinish}
      />
      <DisableDoubleClickZoom enabled={mode === 'polygon'} />
      {recenterTo && <Recenter center={recenterTo} />}
    </MapContainer>
  );
}
