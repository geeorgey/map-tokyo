export const SCENES = [
  { id: 'brick-evening', title: '夕映えの赤レンガ', view: 1, period: 'evening', roofHidden: false },
  { id: 'platform-day', title: '昼のホームを見渡す', view: 2, period: 'day', roofHidden: true },
  { id: 'city-night', title: '街の灯りを空から', view: 3, period: 'night', roofHidden: false },
  { id: 'brick-night', title: '夜の丸の内駅舎', view: 1, period: 'night', roofHidden: false },
  { id: 'panorama-day', title: '青空の東京駅全景', view: 0, period: 'day', roofHidden: false },
  { id: 'platform-evening', title: '夕暮れの線路をたどる', view: 2, period: 'evening', roofHidden: true },
];

// A shuffled bag visits every scene before repeating and avoids a repeat at its boundary.
export function createSceneDraw(random = Math.random) {
  let bag = [], last = null;
  return () => {
    if (!bag.length) {
      bag = [...SCENES];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (bag.at(-1).id === last) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    }
    const scene = bag.pop(); last = scene.id;
    return scene;
  };
}
