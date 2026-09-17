import React from 'react';
import { mapPose } from './walk-map.mjs';

export default function WalkMap({ pose }) {
  const marker = pose ? mapPose(pose) : null;
  return <aside id="walk-map" className="walk-map glass" aria-label="散策マップ">
    <header><strong>散策マップ</strong><span>北 ↑</span></header>
    <svg viewBox="0 0 200 200" role="img" aria-label="東京駅周辺の概略図。上が北。青い矢印が現在地と向き。">
      <rect width="200" height="200" rx="8" fill="#e7ecdf" />
      <path d="M20 0V200M0 100H200" stroke="#fafaf4" strokeWidth="12" />
      <path d="M95 0V200" stroke="#bdc7b0" strokeWidth="7" />
      <rect x="69" y="20" width="16" height="160" rx="3" fill="#ac7155" />
      <circle cx="77" cy="51.4" r="9" fill="#785749" />
      <circle cx="77" cy="148.6" r="9" fill="#785749" />
      <g fill="#40503c" fontSize="12" fontFamily="sans-serif">
        <text x="104" y="55">北ドーム</text><text x="104" y="105">東京駅</text><text x="104" y="153">南ドーム</text>
        <text x="28" y="184" fontSize="10">丸の内側</text>
      </g>
      {marker && <g className="walk-map-marker" transform={`translate(${marker.x} ${marker.y}) rotate(${marker.angle})`}>
        <circle r="10" fill="white" stroke="#176d82" strokeWidth="1.5" />
        <path d="M0 -8L6 6L0 3L-6 6Z" fill="#08758f" />
      </g>}
    </svg>
    <p>{marker?.outside ? '現在地は地図の外側' : '▲ 現在地・向き'}<small>散策用の概略図</small></p>
  </aside>;
}
