/**
 * gsap-observer.ts
 * Wires GSAP Observer to the Navigator pure functions.
 * Handles mouse wheel, drag, pinch-to-zoom, keyboard, and momentum.
 */

import { gsap } from 'gsap';
import { Observer } from 'gsap/Observer';
import {
  applyPan,
  applyZoom,
  resetView,
  DEFAULT_CONFIG,
  type NavigatorConfig,
} from './navigator.js';
import type { ViewState } from '$lib/math/axis.js';

gsap.registerPlugin(Observer);

export interface NavigatorOptions {
  container: HTMLElement;
  getViewState: () => ViewState;
  setViewState: (state: ViewState) => void;
  getViewportWidth: () => number;
  config?: NavigatorConfig;
  onReset?: () => void;
}

export function createNavigator(opts: NavigatorOptions): () => void {
  const config = opts.config ?? DEFAULT_CONFIG;
  let velocityX = 0;
  let momentumTween: gsap.core.Tween | null = null;
  let lastPointerX = 0;
  let isPinching = false;
  let pinchStartDist = 0;
  let pinchStartZoom = 0;
  let pinchMidX = 0;

  // ── Momentum helpers ──────────────────────────────────────────────────────

  function stopMomentum() {
    if (momentumTween) {
      momentumTween.kill();
      momentumTween = null;
    }
  }

  function startMomentum(initialVelocity: number) {
    stopMomentum();
    const proxy = { v: initialVelocity };
    momentumTween = gsap.to(proxy, {
      v: 0,
      duration: config.momentumDecay,
      ease: 'power2.out',
      onUpdate() {
        const vw = opts.getViewportWidth();
        opts.setViewState(applyPan(opts.getViewState(), proxy.v, config, vw));
      },
    });
  }

  // ── GSAP Observer ─────────────────────────────────────────────────────────

  const observer = Observer.create({
    target: opts.container,
    type: 'wheel,touch,pointer',
    preventDefault: true,

    // Wheel without modifier = pan
    onWheel(self) {
      stopMomentum();
      const vw = opts.getViewportWidth();
      const isZoom = self.event instanceof WheelEvent &&
        ((self.event as WheelEvent).ctrlKey || (self.event as WheelEvent).metaKey);

      if (isZoom) {
        const delta = (self.event as WheelEvent).deltaY;
        const factor = delta > 0 ? 0.92 : 1 / 0.92;
        const originX = (self.event as WheelEvent).clientX;
        opts.setViewState(applyZoom(opts.getViewState(), factor, originX, config, vw));
      } else {
        const delta = -(self.event as WheelEvent).deltaX || -(self.event as WheelEvent).deltaY;
        opts.setViewState(applyPan(opts.getViewState(), delta, config, vw));
      }
    },

    // Drag = pan
    onDrag(self) {
      if (isPinching) return;
      stopMomentum();
      const vw = opts.getViewportWidth();
      opts.setViewState(applyPan(opts.getViewState(), self.deltaX, config, vw));
      velocityX = self.velocityX;
    },

    onDragEnd() {
      if (isPinching) return;
      if (Math.abs(velocityX) > 5) {
        startMomentum(velocityX * 0.3);
      }
      velocityX = 0;
    },

    onPress(self) {
      stopMomentum();
      lastPointerX = self.x;
    },
  });

  // ── Touch pinch-to-zoom ───────────────────────────────────────────────────

  function getTouchDist(e: TouchEvent): number {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  function getTouchMidX(e: TouchEvent): number {
    return (e.touches[0].clientX + e.touches[1].clientX) / 2;
  }

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      isPinching = true;
      pinchStartDist = getTouchDist(e);
      pinchStartZoom = opts.getViewState().zoomScale;
      pinchMidX = getTouchMidX(e);
      stopMomentum();
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (!isPinching || e.touches.length < 2) return;
    e.preventDefault();
    const dist = getTouchDist(e);
    const factor = dist / pinchStartDist;
    const vw = opts.getViewportWidth();
    const current = opts.getViewState();
    const newZoom = Math.max(config.minZoom, Math.min(config.maxZoom, pinchStartZoom * factor));
    opts.setViewState(applyZoom(
      { ...current, zoomScale: pinchStartZoom },
      newZoom / pinchStartZoom,
      pinchMidX,
      config,
      vw
    ));
  }

  function onTouchEnd(e: TouchEvent) {
    if (e.touches.length < 2) isPinching = false;
  }

  opts.container.addEventListener('touchstart', onTouchStart, { passive: false });
  opts.container.addEventListener('touchmove', onTouchMove, { passive: false });
  opts.container.addEventListener('touchend', onTouchEnd);

  // ── Keyboard navigation ───────────────────────────────────────────────────

  const PAN_STEP = 80;
  const ZOOM_STEP = 1.2;

  function onKeyDown(e: KeyboardEvent) {
    // Don't intercept if focus is inside an input/textarea/button
    const tag = (e.target as HTMLElement).tagName;
    if (['INPUT', 'TEXTAREA', 'BUTTON', 'A'].includes(tag)) return;

    const vw = opts.getViewportWidth();
    const state = opts.getViewState();

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        opts.setViewState(applyPan(state, PAN_STEP, config, vw));
        break;
      case 'ArrowRight':
        e.preventDefault();
        opts.setViewState(applyPan(state, -PAN_STEP, config, vw));
        break;
      case '+':
      case '=':
        e.preventDefault();
        opts.setViewState(applyZoom(state, ZOOM_STEP, vw / 2, config, vw));
        break;
      case '-':
        e.preventDefault();
        opts.setViewState(applyZoom(state, 1 / ZOOM_STEP, vw / 2, config, vw));
        break;
      case 'Home':
        e.preventDefault();
        opts.setViewState(resetView(vw));
        opts.onReset?.();
        break;
    }
  }

  window.addEventListener('keydown', onKeyDown);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  return function destroy() {
    observer.kill();
    stopMomentum();
    opts.container.removeEventListener('touchstart', onTouchStart);
    opts.container.removeEventListener('touchmove', onTouchMove);
    opts.container.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('keydown', onKeyDown);
  };
}
