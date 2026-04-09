export default defineBackground(() => {
  console.log('Contexta background service worker started', { id: browser.runtime.id });
});
