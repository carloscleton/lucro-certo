export {};

declare global {
  interface Window {
    __CURRENCY_CODE__?: string;
    __CURRENCY_LOCALE__?: string;
  }
}
