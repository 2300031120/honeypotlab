import React from "react";
import Globe from "react-globe.gl";

export default function ThreatGlobe({ globeData, arcsData }) {
  return (
    <Globe
      width={800}
      height={450}
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
      bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
      backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
      pointsData={globeData}
      pointLat="lat"
      pointLng="lng"
      pointColor="color"
      pointAltitude="size"
      pointRadius={0.5}
      pointsMerge={true}
      arcsData={arcsData}
      arcColor="color"
      arcDashLength={0.4}
      arcDashGap={4}
      arcDashAnimateTime={1000}
      arcStroke={0.5}
      atmosphereColor="#3a4454"
      atmosphereAltitude={0.15}
    />
  );
}
