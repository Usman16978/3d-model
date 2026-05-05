/**
 * Bind logical Curax behaviours → glTF animation clip indices (order in Box.glb).
 * Reload once after export; use DevTools console.table (printed on load) to match names.
 *
 * Example clip names from your file (index → name):
 * 0–6   Cube.032_slice…006Action … 012Action
 * 7–10  Cube.002Action … 006Action
 * 11    Sphere.003Action
 * 12–13 Plastic_black-material…Action
 * 14–19 pick pointAction … pick pointAction.005
 *
 * Replace numbers below with the correct index for each behaviour.
 */
export const CURAX_ANIM_MAP = {
  /** Back power: device turns on (LED/boot path). */
  powerOn: 14,
  /** Power off / standby pose (null if no clip). */
  powerOff: 19,

  screenInitializing: 7,
  screenSystemReady: 8,
  screenEnterPin: 9,
  /** Keypad entry feedback (stars / masked PIN on LCD). */
  screenPinStars: 10,
  /** Temp / humidity on screen. */
  screenReadings: 11,

  /**
   * Six compartment slide/eject animations (middle bays), index 0 = compartment 1 … 5.
   */
  compartments: [0, 1, 2, 3, 4, 5],
};

/** Set true to replay the old “play every clip in order” kiosk demo instead of manual bindings. */
export const CURAX_AUTO_DEMO_ALL_CLIPS = false;
