import { createLuxuryScene } from './luxury-scene';

const host = document.querySelector<HTMLElement>('#office-wrap');
if (host) {
  createLuxuryScene({ element: host }).catch((error: unknown) => {
    console.error('PixiJS scene failed to initialize', error);
  });
}
