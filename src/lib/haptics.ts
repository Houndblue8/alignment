// A short tap of vibration on success. Android uses the Vibration API. iPhone Safari (iOS 18+) has no
// vibration API, but it plays a system haptic when a "switch" checkbox is toggled by a tap, so we toggle a
// hidden one. Must run inside a tap handler. Silently does nothing where neither works.
export function haptic(): void {
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(18);
      return;
    }
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    label.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;';
    document.body.appendChild(label);
    label.click();
    label.remove();
  } catch {
    // No haptics on this device.
  }
}
