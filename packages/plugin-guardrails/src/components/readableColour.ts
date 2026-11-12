import {
  darken,
  getContrastRatio,
  getLuminance,
  lighten,
} from '@material-ui/core/styles/colorManipulator';

const STEP = 0.05;
const MAX_STEPS = 20;

/**
 * The given theme colour, moved towards white (on a dark surface) or black (on
 * a light one) in small steps until it reaches `minRatio` against every
 * surface. A colour that already reads well is returned unchanged, so the
 * result always comes from the theme and is readable in both themes.
 */
export function readableColour(
  colour: string,
  surfaces: string[],
  minRatio: number,
): string {
  const worstRatio = (candidate: string) =>
    Math.min(...surfaces.map(surface => getContrastRatio(candidate, surface)));
  const darkSurfaces =
    surfaces.reduce((sum, surface) => sum + getLuminance(surface), 0) /
      surfaces.length <
    0.5;
  const shift = darkSurfaces ? lighten : darken;

  let result = colour;
  for (
    let step = 1;
    step <= MAX_STEPS && worstRatio(result) < minRatio;
    step++
  ) {
    result = shift(colour, step * STEP);
  }
  return result;
}
