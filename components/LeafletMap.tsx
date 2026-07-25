"use client";

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function LeafletMap({ hotspots }: { hotspots: { lat: number; lon: number; areaName: string; score: number; cases: number }[] }) {
  return (
    <MapContainer center={[13.1, 76.4]} zoom={7} scrollWheelZoom className="h-[520px] overflow-hidden rounded-2xl border">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {hotspots.map((spot, index) => (
        <CircleMarker key={`${spot.lat}-${spot.lon}-${index}`} center={[spot.lat, spot.lon]}
          radius={Math.min(8 + spot.score * 2, 30)} pathOptions={{ color: "#b91c1c", fillColor: "#ef4444", fillOpacity: 0.45 }}>
          <Popup><b>{spot.areaName}</b><br />Weighted score: {spot.score}<br />Cases: {spot.cases}</Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
